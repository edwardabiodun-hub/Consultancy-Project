import { NextResponse } from "next/server";
import { and, eq, gt, isNotNull, isNull, lt, lte, or } from "drizzle-orm";
import type { assessmentRecords } from "../../../../../db/schema";
import { toAssessmentRecord } from "../../../../../lib/assessment/record";
import { buildAssessmentResult } from "../../../../../lib/assessment/result";
import { parseAssessmentPayload } from "../../../../../lib/assessment/validation";
import {
  generateValidatedNarrative,
  resolveNarrativeOutcome,
  restoreNarrativeSelection,
  type NarrativeGeneration,
  type NarrativeOutcome,
  type NarrativeSelection,
} from "../../../../../lib/assessment/narrative";
import {
  fingerprintInternalAssessmentEmail,
  sendInternalAssessmentEmail,
} from "../../../../../lib/email/internal-assessment";

import { createAssessmentReportRecord } from "../../../../../lib/report/pdf";
import {
  createReportStorage,
  persistFullReportSnapshot as persistReportSnapshot,
  type PersistFullReportSnapshotInput,
  type ReportStorageMetadata,
} from "../../../../../lib/report/storage";
type AssessmentRecord = typeof assessmentRecords.$inferSelect;
type RouteContext = { params: Promise<{ id: string }> };
type NotificationClaim = "claimed" | "sent" | "busy";
type NotificationOutcome = "sent" | "failed" | "indeterminate";
type NarrativeAttemptClaim = "claimed" | "already_attempted";
type NotificationInput = Parameters<typeof sendInternalAssessmentEmail>[0];
type HandlerDependencies = {
  findRecord: (id: string) => Promise<AssessmentRecord | null>;
  checkRateLimit: (id: string) => Promise<boolean>;
  checkGlobalRateLimit: () => Promise<boolean>;
  isNarrativeModelConfigured: () => boolean;
  claimNarrativeAttempt: (id: string) => Promise<NarrativeAttemptClaim>;
  generateNarrative: typeof generateValidatedNarrative;
  updateNarrativeSource: (
    id: string,
    source: NarrativeOutcome["source"],
    selection: NarrativeSelection | null,
    expectedStatus: "pending" | "generating",
  ) => Promise<boolean | void>;
  finalizeStaleNarrativeAttempt: (
    id: string,
    attemptedAt: string,
  ) => Promise<boolean>;
  now: () => Date;
  fingerprintInternalNotification: (input: NotificationInput) => Promise<string>;
  claimInternalNotification: (id: string, payloadHash: string) => Promise<NotificationClaim>;
  finalizeInternalNotification: (id: string, outcome: NotificationOutcome) => Promise<void>;
  sendInternalNotification: typeof sendInternalAssessmentEmail;
  persistFullReportSnapshot: (
    input: PersistFullReportSnapshotInput,
  ) => Promise<unknown>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_HEADERS = { "cache-control": "private, no-store" };
const notFound = () => new Response("Assessment record not found.", { status: 404, headers: PRIVATE_HEADERS });
const unavailable = () => new Response("Assessment narrative is temporarily unavailable.", { status: 503, headers: PRIVATE_HEADERS });
const rateLimited = () => new Response("Too many narrative requests.", {
  status: 429,
  headers: { ...PRIVATE_HEADERS, "retry-after": "60" },
});

const findAssessmentRecord = async (id: string): Promise<AssessmentRecord | null> => {
  const [{ getDb }, { assessmentRecords }] = await Promise.all([
    import("../../../../../db"), import("../../../../../db/schema"),
  ]);
  const [record] = await getDb().select().from(assessmentRecords).where(eq(assessmentRecords.id, id)).limit(1);
  return record ?? null;
};

type ReportsBucket = {
  put(key: string, value: string | Uint8Array): Promise<unknown>;
  delete(keys: string[]): Promise<unknown>;
};

const persistStoredFullReportSnapshot = async (
  input: PersistFullReportSnapshotInput,
): Promise<void> => {
  const [{ getDb }, { assessmentRecords }, { env }] = await Promise.all([
    import("../../../../../db"),
    import("../../../../../db/schema"),
    import("cloudflare:workers"),
  ]);
  const updateMetadata = async (metadata: ReportStorageMetadata) => {
    await getDb()
      .update(assessmentRecords)
      .set(metadata)
      .where(eq(assessmentRecords.id, input.assessmentId));
  };
  const bucket = (env as unknown as { REPORTS?: ReportsBucket }).REPORTS;
  if (!bucket) {
    await updateMetadata({
      reportStorageStatus: "storage_failed",
      reportStoredAt: null,
    });
    throw new Error("REPORTS binding unavailable");
  }
  await persistReportSnapshot(input, {
    reportStorage: createReportStorage(bucket),
    updateMetadata,
  });
};

const limiterBinding = async (name: "NARRATIVE_RATE_LIMITER" | "NARRATIVE_GLOBAL_RATE_LIMITER") => {
  const { env } = await import("cloudflare:workers");
  return (env as unknown as Record<string, { limit(input: { key: string }): Promise<{ success: boolean }> } | undefined>)[name];
};

const checkAssessmentRateLimit = async (id: string): Promise<boolean> => {
  const limiter = await limiterBinding("NARRATIVE_RATE_LIMITER");
  if (!limiter) throw new Error("NARRATIVE_RATE_LIMITER binding unavailable");
  return (await limiter.limit({ key: id })).success;
};

const checkGlobalNarrativeRateLimit = async (): Promise<boolean> => {
  const limiter = await limiterBinding("NARRATIVE_GLOBAL_RATE_LIMITER");
  if (!limiter) throw new Error("NARRATIVE_GLOBAL_RATE_LIMITER binding unavailable");
  return (await limiter.limit({ key: "narrative-service" })).success;
};

const updateStoredNarrativeSource = async (
  id: string,
  source: NarrativeOutcome["source"],
  selection: NarrativeSelection | null,
  expectedStatus: "pending" | "generating",
): Promise<boolean> => {
  const [{ getDb }, { assessmentRecords }] = await Promise.all([
    import("../../../../../db"), import("../../../../../db/schema"),
  ]);
  const updated = await getDb().update(assessmentRecords).set({
    narrativeSource: source,
    narrativeSelectionJson: selection ? JSON.stringify(selection) : null,
    narrativeAttemptStatus: "completed",
  }).where(and(
    eq(assessmentRecords.id, id),
    eq(assessmentRecords.narrativeAttemptStatus, expectedStatus),
  )).run();
  return changedRows(updated) === 1;
};

const changedRows = (result: unknown): number =>
  Number((result as { meta?: { changes?: number } })?.meta?.changes ?? 0);

const claimStoredNarrativeAttempt = async (id: string): Promise<NarrativeAttemptClaim> => {
  const [{ getDb }, { assessmentRecords }] = await Promise.all([
    import("../../../../../db"), import("../../../../../db/schema"),
  ]);
  const claimed = await getDb().update(assessmentRecords).set({
    narrativeAttemptStatus: "generating",
    narrativeAttemptedAt: new Date().toISOString(),
  }).where(and(
    eq(assessmentRecords.id, id),
    eq(assessmentRecords.narrativeAttemptStatus, "pending"),
    isNull(assessmentRecords.narrativeAttemptedAt),
  )).run();
  return changedRows(claimed) === 1 ? "claimed" : "already_attempted";
};

export const NARRATIVE_ATTEMPT_LEASE_MS = 30 * 1000;

export const isStaleNarrativeAttempt = (
  status: string | null | undefined,
  attemptedAt: string | null | undefined,
  now: Date = new Date(),
): boolean => {
  if (status !== "generating" || !attemptedAt) return false;
  const attemptedAtMs = Date.parse(attemptedAt);
  if (!Number.isFinite(attemptedAtMs)) return false;
  return now.getTime() - attemptedAtMs > NARRATIVE_ATTEMPT_LEASE_MS;
};

const finalizeStoredStaleNarrativeAttempt = async (
  id: string,
  attemptedAt: string,
): Promise<boolean> => {
  const [{ getDb }, { assessmentRecords }] = await Promise.all([
    import("../../../../../db"), import("../../../../../db/schema"),
  ]);
  const cutoff = new Date(Date.now() - NARRATIVE_ATTEMPT_LEASE_MS).toISOString();
  const finalized = await getDb().update(assessmentRecords).set({
    narrativeSource: "rules",
    narrativeSelectionJson: null,
    narrativeAttemptStatus: "failed",
  }).where(and(
    eq(assessmentRecords.id, id),
    eq(assessmentRecords.narrativeAttemptStatus, "generating"),
    eq(assessmentRecords.narrativeAttemptedAt, attemptedAt),
    lt(assessmentRecords.narrativeAttemptedAt, cutoff),
  )).run();
  return changedRows(finalized) === 1;
};

export const INTERNAL_NOTIFICATION_LEASE_MS = 10 * 60 * 1000;
export const INTERNAL_NOTIFICATION_RECLAIM_WINDOW_MS = 23 * 60 * 60 * 1000;

export const isReclaimableInternalNotificationLease = (
  status: string | null | undefined,
  claimedAt: string | null | undefined,
  now: Date = new Date(),
): boolean => {
  if (status !== "sending" || !claimedAt) return false;
  const claimedAtMs = Date.parse(claimedAt);
  if (!Number.isFinite(claimedAtMs)) return false;
  const age = now.getTime() - claimedAtMs;
  return age > INTERNAL_NOTIFICATION_LEASE_MS
    && age < INTERNAL_NOTIFICATION_RECLAIM_WINDOW_MS;
};

export const isStaleInternalNotificationLease = isReclaimableInternalNotificationLease;

const claimStoredInternalNotification = async (
  id: string,
  payloadHash: string,
): Promise<NotificationClaim> => {
  const [{ getDb }, { assessmentRecords }] = await Promise.all([
    import("../../../../../db"), import("../../../../../db/schema"),
  ]);
  const db = getDb();
  const now = new Date();
  const nowIso = now.toISOString();
  const staleLeaseCutoff = new Date(now.getTime() - INTERNAL_NOTIFICATION_LEASE_MS).toISOString();
  const safeWindowCutoff = new Date(now.getTime() - INTERNAL_NOTIFICATION_RECLAIM_WINDOW_MS).toISOString();

  await db.update(assessmentRecords).set({ internalNotificationStatus: "indeterminate" }).where(and(
    eq(assessmentRecords.id, id),
    eq(assessmentRecords.internalNotificationStatus, "sending"),
    or(
      isNull(assessmentRecords.internalNotificationFirstAttemptAt),
      isNull(assessmentRecords.internalNotificationPayloadHash),
      lte(assessmentRecords.internalNotificationFirstAttemptAt, safeWindowCutoff),
    ),
  )).run();

  const initial = await db.update(assessmentRecords).set({
    internalNotificationStatus: "sending",
    internalNotificationClaimedAt: nowIso,
    internalNotificationFirstAttemptAt: nowIso,
    internalNotificationPayloadHash: payloadHash,
  }).where(and(
    eq(assessmentRecords.id, id),
    eq(assessmentRecords.internalNotificationStatus, "pending"),
  )).run();
  if (changedRows(initial) === 1) return "claimed";

  const retry = await db.update(assessmentRecords).set({
    internalNotificationStatus: "sending",
    internalNotificationClaimedAt: nowIso,
  }).where(and(
    eq(assessmentRecords.id, id),
    eq(assessmentRecords.internalNotificationPayloadHash, payloadHash),
    isNotNull(assessmentRecords.internalNotificationFirstAttemptAt),
    gt(assessmentRecords.internalNotificationFirstAttemptAt, safeWindowCutoff),
    or(
      eq(assessmentRecords.internalNotificationStatus, "failed"),
      and(
        eq(assessmentRecords.internalNotificationStatus, "sending"),
        isNotNull(assessmentRecords.internalNotificationClaimedAt),
        lt(assessmentRecords.internalNotificationClaimedAt, staleLeaseCutoff),
      ),
    ),
  )).run();
  if (changedRows(retry) === 1) return "claimed";

  const [record] = await db.select({ status: assessmentRecords.internalNotificationStatus })
    .from(assessmentRecords).where(eq(assessmentRecords.id, id)).limit(1);
  return record?.status === "sent" ? "sent" : "busy";
};

const finalizeStoredInternalNotification = async (id: string, outcome: NotificationOutcome) => {
  const [{ getDb }, { assessmentRecords }] = await Promise.all([
    import("../../../../../db"), import("../../../../../db/schema"),
  ]);
  await getDb().update(assessmentRecords).set({
    internalNotificationStatus: outcome,
    internalNotificationSentAt: outcome === "sent" ? new Date().toISOString() : null,
  }).where(and(
    eq(assessmentRecords.id, id),
    eq(assessmentRecords.internalNotificationStatus, "sending"),
  ));
};

const IMMUTABLE_FIELDS = [
  "assessmentVersion", "name", "workEmail", "company", "role", "phone",
  "reportConsent", "marketingConsent", "overallScore", "ownerIndependenceScore",
  "operatingSystemScore", "informationVisibilityScore", "scoreCoverage",
  "scoreConfidence", "impactConfidence", "estimateType", "capacityInputSource",
  "ownerGrossHours", "reportingGrossHours", "reworkGrossHours", "grossCapacityValue",
  "realizationFactorLow", "realizationFactorHigh", "recoverableHoursLow",
  "recoverableHoursHigh", "annualValueLow", "annualValueHigh", "findingsJson",
  "capacityAssumptionCodesJson", "capacityExclusionCodesJson", "riskCodesJson",
  "priorityIdsJson", "leadRoute",
] as const;

const payloadMatchesRecord = (
  record: AssessmentRecord,
  expected: ReturnType<typeof toAssessmentRecord>,
): boolean => IMMUTABLE_FIELDS.every((field) => Object.is(record[field], expected[field]));

export function createAssessmentNarrativeHandler(dependencies: Partial<HandlerDependencies> = {}) {
  const findRecord = dependencies.findRecord ?? findAssessmentRecord;
  const checkRateLimit = dependencies.checkRateLimit ?? checkAssessmentRateLimit;
  const checkGlobalRateLimit = dependencies.checkGlobalRateLimit ?? checkGlobalNarrativeRateLimit;
  const isNarrativeModelConfigured = dependencies.isNarrativeModelConfigured
    ?? (() => Boolean(process.env.OPENAI_API_KEY && process.env.ASSESSMENT_NARRATIVE_MODEL));
  const claimNarrativeAttempt = dependencies.claimNarrativeAttempt ?? claimStoredNarrativeAttempt;
  const generateNarrative = dependencies.generateNarrative ?? generateValidatedNarrative;
  const updateNarrativeSource = dependencies.updateNarrativeSource ?? updateStoredNarrativeSource;
  const finalizeStaleNarrativeAttempt = dependencies.finalizeStaleNarrativeAttempt
    ?? finalizeStoredStaleNarrativeAttempt;
  const now = dependencies.now ?? (() => new Date());
  const fingerprintInternalNotification = dependencies.fingerprintInternalNotification ?? fingerprintInternalAssessmentEmail;
  const claimInternalNotification = dependencies.claimInternalNotification ?? claimStoredInternalNotification;
  const finalizeInternalNotification = dependencies.finalizeInternalNotification ?? finalizeStoredInternalNotification;
  const sendInternalNotification = dependencies.sendInternalNotification ?? sendInternalAssessmentEmail;
  const persistFullReportSnapshot = dependencies.persistFullReportSnapshot
    ?? persistStoredFullReportSnapshot;

  return async function postAssessmentNarrative(request: Request, context: RouteContext) {
    const { id } = await context.params;
    if (!UUID.test(id)) return notFound();

    const parsed = parseAssessmentPayload(await request.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json(parsed, { status: 422, headers: PRIVATE_HEADERS });

    const result = buildAssessmentResult(parsed.answers);
    const expected = toAssessmentRecord({ id, lead: parsed.lead, result, role: parsed.answers.role });
    let record: AssessmentRecord | null;
    try {
      record = await findRecord(id);
    } catch {
      return unavailable();
    }
    if (!record || !payloadMatchesRecord(record, expected)) return notFound();

    try {
      if (!(await checkRateLimit(id))) return rateLimited();
    } catch {
      return unavailable();
    }

    const rulesNarrative: NarrativeGeneration = {
      source: "rules",
      text: result.narrative.summary,
      selection: null,
    };
    let narrativeState = rulesNarrative;
    let definitiveOutcome = false;
    let persistenceAvailable = true;

    const terminalNarrative = (candidate: AssessmentRecord): NarrativeGeneration | null => {
      if (!["attempted", "completed", "failed"].includes(candidate.narrativeAttemptStatus)) {
        return null;
      }
      if (candidate.narrativeSource === "ai") {
        return restoreNarrativeSelection(candidate.narrativeSelectionJson, result) ?? rulesNarrative;
      }
      return rulesNarrative;
    };
    const refreshTerminalNarrative = async (): Promise<void> => {
      const refreshed = await findRecord(id);
      if (!refreshed) return;
      const terminal = terminalNarrative(refreshed);
      if (terminal) {
        narrativeState = terminal;
        definitiveOutcome = true;
      }
    };

    const existingTerminal = terminalNarrative(record);
    if (existingTerminal) {
      narrativeState = existingTerminal;
      definitiveOutcome = true;
    } else if (record.narrativeAttemptStatus === "generating") {
      if (isStaleNarrativeAttempt(
        record.narrativeAttemptStatus,
        record.narrativeAttemptedAt,
        now(),
      ) && record.narrativeAttemptedAt) {
        try {
          definitiveOutcome = await finalizeStaleNarrativeAttempt(
            id,
            record.narrativeAttemptedAt,
          );
          if (!definitiveOutcome) await refreshTerminalNarrative();
        } catch {
          persistenceAvailable = false;
        }
      }
    } else if (record.narrativeAttemptStatus === "pending") {
      let useOpenAi = false;
      if (isNarrativeModelConfigured()) {
        try {
          useOpenAi = await checkGlobalRateLimit();
        } catch {
          useOpenAi = false;
        }
      }

      if (useOpenAi) {
        try {
          if ((await claimNarrativeAttempt(id)) === "claimed") {
            let generated = rulesNarrative;
            try {
              const candidate = await generateNarrative(result);
              generated = candidate.source === "ai"
                ? resolveNarrativeOutcome(candidate.selection, result) ?? rulesNarrative
                : rulesNarrative;
            } catch {
              generated = rulesNarrative;
            }
            const published = await updateNarrativeSource(
              id,
              generated.source,
              generated.selection,
              "generating",
            );
            if (published !== false) {
              narrativeState = generated;
              definitiveOutcome = true;
            } else {
              await refreshTerminalNarrative();
            }
          } else {
            await refreshTerminalNarrative();
          }
        } catch {
          persistenceAvailable = false;
        }
      } else {
        try {
          const published = await updateNarrativeSource(
            id,
            rulesNarrative.source,
            null,
            "pending",
          );
          if (published !== false) {
            definitiveOutcome = true;
          } else {
            await refreshTerminalNarrative();
          }
        } catch {
          persistenceAvailable = false;
        }
      }
    }

    const narrative: NarrativeOutcome = {
      source: narrativeState.source,
      text: narrativeState.text,
    };
    if (
      definitiveOutcome
      && persistenceAvailable
      && parsed.lead?.reportConsent === true
      && record.reportStorageStatus !== "stored"
    ) {
      const reportRecord = createAssessmentReportRecord({
        id,
        createdAt: record.createdAt,
        lead: parsed.lead,
        result,
        role: parsed.answers.role,
        narrative,
      });
      try {
        await persistFullReportSnapshot({
          assessmentId: id,
          assessmentVersion: result.methodologyVersion,
          createdAt: record.createdAt,
          lead: parsed.lead,
          answers: parsed.answers,
          result,
          narrative,
          reportRecord,
        });
      } catch {
        // D1 retains storage_failed; compact report reconstruction and the
        // accepted on-screen result remain available.
      }
    }
    let internalNotificationAccepted = false;
    if (definitiveOutcome && persistenceAvailable && parsed.lead) {
      const notificationInput: NotificationInput = {
        assessmentId: id,
        lead: {
          name: record.name ?? parsed.lead.name,
          email: record.workEmail ?? parsed.lead.workEmail,
          company: record.company ?? parsed.lead.company,
          role: record.role ?? parsed.answers.role,
        },
        result,
        narrative,
      };
      try {
        const payloadHash = await fingerprintInternalNotification(notificationInput);
        const claim = await claimInternalNotification(id, payloadHash);
        if (claim === "sent") {
          internalNotificationAccepted = true;
        } else if (claim === "claimed") {
          let notification: Awaited<ReturnType<typeof sendInternalAssessmentEmail>>;
          try {
            notification = await sendInternalNotification(notificationInput);
          } catch {
            notification = { accepted: false, retryable: false };
          }
          internalNotificationAccepted = notification.accepted;
          const outcome: NotificationOutcome = notification.accepted
            ? "sent"
            : notification.retryable
              ? "failed"
              : "indeterminate";
          try {
            await finalizeInternalNotification(id, outcome);
          } catch (error) {
            console.error("internal_notification_finalize_failed", { assessmentId: id, outcome, error });
          }
        }
      } catch {
        internalNotificationAccepted = false;
      }
    }

    return NextResponse.json({
      ok: true,
      narrative,
      persistenceAvailable,
      internalNotificationAccepted,
    }, { headers: PRIVATE_HEADERS });
  };
}

export const POST = createAssessmentNarrativeHandler();