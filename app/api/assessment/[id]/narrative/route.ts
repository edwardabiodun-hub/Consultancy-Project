import { NextResponse } from "next/server";
import { and, eq, inArray, isNotNull, lt, or } from "drizzle-orm";
import type { assessmentRecords } from "../../../../../db/schema";
import { toAssessmentRecord } from "../../../../../lib/assessment/record";
import { buildAssessmentResult } from "../../../../../lib/assessment/result";
import { parseAssessmentPayload } from "../../../../../lib/assessment/validation";
import {
  generateValidatedNarrative,
  type NarrativeOutcome,
} from "../../../../../lib/assessment/narrative";
import { sendInternalAssessmentEmail } from "../../../../../lib/email/internal-assessment";

type AssessmentRecord = typeof assessmentRecords.$inferSelect;
type RouteContext = { params: Promise<{ id: string }> };
type NotificationClaim = "claimed" | "sent" | "busy";
type NotificationOutcome = "sent" | "failed" | "indeterminate";
type HandlerDependencies = {
  findRecord: (id: string) => Promise<AssessmentRecord | null>;
  checkRateLimit: (id: string) => Promise<boolean>;
  generateNarrative: typeof generateValidatedNarrative;
  updateNarrativeSource: (id: string, source: NarrativeOutcome["source"]) => Promise<void>;
  claimInternalNotification: (id: string) => Promise<NotificationClaim>;
  finalizeInternalNotification: (id: string, outcome: NotificationOutcome) => Promise<void>;
  sendInternalNotification: typeof sendInternalAssessmentEmail;
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

const checkAssessmentRateLimit = async (id: string): Promise<boolean> => {
  const { env } = await import("cloudflare:workers");
  const limiter = (env as unknown as {
    NARRATIVE_RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
  }).NARRATIVE_RATE_LIMITER;
  if (!limiter) throw new Error("NARRATIVE_RATE_LIMITER binding unavailable");
  return (await limiter.limit({ key: id })).success;
};

const updateStoredNarrativeSource = async (id: string, source: NarrativeOutcome["source"]) => {
  const [{ getDb }, { assessmentRecords }] = await Promise.all([
    import("../../../../../db"), import("../../../../../db/schema"),
  ]);
  await getDb().update(assessmentRecords).set({ narrativeSource: source }).where(eq(assessmentRecords.id, id));
};

const changedRows = (result: unknown): number =>
  Number((result as { meta?: { changes?: number } })?.meta?.changes ?? 0);

export const INTERNAL_NOTIFICATION_LEASE_MS = 10 * 60 * 1000;

export const isStaleInternalNotificationLease = (
  status: string | null | undefined,
  claimedAt: string | null | undefined,
  now: Date = new Date(),
): boolean => {
  if (status !== "sending" || !claimedAt) return false;
  const claimedAtMs = Date.parse(claimedAt);
  return Number.isFinite(claimedAtMs)
    && now.getTime() - claimedAtMs > INTERNAL_NOTIFICATION_LEASE_MS;
};

const claimStoredInternalNotification = async (id: string): Promise<NotificationClaim> => {
  const [{ getDb }, { assessmentRecords }] = await Promise.all([
    import("../../../../../db"), import("../../../../../db/schema"),
  ]);
  const db = getDb();
  const now = new Date();
  const staleLeaseCutoff = new Date(now.getTime() - INTERNAL_NOTIFICATION_LEASE_MS).toISOString();
  const claimed = await db.update(assessmentRecords)
    .set({ internalNotificationStatus: "sending", internalNotificationClaimedAt: now.toISOString() })
    .where(and(
      eq(assessmentRecords.id, id),
      or(
        inArray(assessmentRecords.internalNotificationStatus, ["pending", "failed"]),
        and(
          eq(assessmentRecords.internalNotificationStatus, "sending"),
          isNotNull(assessmentRecords.internalNotificationClaimedAt),
          lt(assessmentRecords.internalNotificationClaimedAt, staleLeaseCutoff),
        ),
      ),
    ))
    .run();
  if (changedRows(claimed) === 1) return "claimed";
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
  const generateNarrative = dependencies.generateNarrative ?? generateValidatedNarrative;
  const updateNarrativeSource = dependencies.updateNarrativeSource ?? updateStoredNarrativeSource;
  const claimInternalNotification = dependencies.claimInternalNotification ?? claimStoredInternalNotification;
  const finalizeInternalNotification = dependencies.finalizeInternalNotification ?? finalizeStoredInternalNotification;
  const sendInternalNotification = dependencies.sendInternalNotification ?? sendInternalAssessmentEmail;

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

    const narrative = await generateNarrative(result, {
      employeeBand: parsed.answers.employeeBand,
      revenueBand: parsed.answers.revenueBand,
      role: parsed.answers.role,
      restrictedMarket: parsed.answers.restrictedMarket,
    });

    let persistenceAvailable = true;
    try {
      await updateNarrativeSource(id, narrative.source);
    } catch {
      persistenceAvailable = false;
    }

    let internalNotificationAccepted = false;
    if (persistenceAvailable && parsed.lead) {
      try {
        const claim = await claimInternalNotification(id);
        if (claim === "sent") {
          internalNotificationAccepted = true;
        } else if (claim === "claimed") {
          let notification: Awaited<ReturnType<typeof sendInternalAssessmentEmail>>;
          try {
            notification = await sendInternalNotification({
              assessmentId: id,
              lead: {
                name: record.name ?? parsed.lead.name,
                email: record.workEmail ?? parsed.lead.workEmail,
                company: record.company ?? parsed.lead.company,
                role: record.role ?? parsed.answers.role,
              },
              result,
              narrative,
            });
          } catch {
            notification = { accepted: false, retryable: false };
          }
          internalNotificationAccepted = notification.accepted;
          const outcome: NotificationOutcome = notification.accepted
            ? "sent"
            : notification.retryable
              ? "failed"
              : "indeterminate";
          try { await finalizeInternalNotification(id, outcome); } catch { /* response remains available */ }
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