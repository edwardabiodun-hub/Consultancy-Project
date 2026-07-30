import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as narrativeModule from "../../lib/assessment/narrative.ts";
import * as narrativeRoute from "../../app/api/assessment/[id]/narrative/route.ts";
import { QUESTION_BANK } from "../../lib/assessment/questions.ts";
import { toAssessmentRecord } from "../../lib/assessment/record.ts";
import { buildAssessmentResult } from "../../lib/assessment/result.ts";

const projectRoot = new URL("../../", import.meta.url);
const {
  buildNarrativeModelInput,
  generateValidatedNarrative,
  resolveNarrativeSelection,
} = narrativeModule;
const {
  createAssessmentNarrativeHandler,
  isReclaimableInternalNotificationLease,
} = narrativeRoute;
const assessmentId = "8d7b76ca-86bf-46a6-88f4-42b6dfecd159";
const answers = {
  employeeBand: "20-49",
  managerBand: "3-5",
  revenueBand: "5m-20m",
  role: "Owner-operator",
  coreSystemCount: "twoOrMore",
  organizationShape: "multipleTeams",
  relationshipLedByOwner: true,
  restrictedMarket: false,
  scored: Object.fromEntries(QUESTION_BANK.map((question) => [question.id, 50])),
  capacity: { source: "none", activities: [] },
};
const lead = {
  name: "Avery Founder",
  workEmail: "avery@example.com",
  company: "Example Operations",
  phone: "843-555-0100",
  reportConsent: true,
  marketingConsent: false,
};
const result = buildAssessmentResult(answers);
const record = {
  ...toAssessmentRecord({ id: assessmentId, lead, result, role: answers.role }),
  createdAt: "2026-07-29 12:00:00",
};
const request = () => new Request(
  `https://example.com/api/assessment/${assessmentId}/narrative`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers, lead }),
  },
);
const context = { params: Promise.resolve({ id: assessmentId }) };

test("the model boundary contains only finite approved block IDs", () => {
  const input = buildNarrativeModelInput(result);
  const serialized = JSON.stringify(input);

  assert.deepEqual(Object.keys(input), ["allowedBlockIds"]);
  assert.deepEqual(Object.keys(input.allowedBlockIds).sort(), [
    "limitations",
    "observations",
    "priorities",
    "summaries",
  ]);
  assert.ok(input.allowedBlockIds.summaries.length > 0);
  assert.ok(input.allowedBlockIds.observations.length > 0);
  assert.ok(input.allowedBlockIds.priorities.length > 0);
  assert.ok(input.allowedBlockIds.limitations.length > 0);
  assert.doesNotMatch(serialized, /\b(?:50|100|owner_bottleneck|Avery|Example Operations)\b/);
});

test("closed-set resolution rejects unknown, duplicated, incompatible, and missing IDs", () => {
  const allowed = buildNarrativeModelInput(result).allowedBlockIds;
  const valid = {
    summaryId: allowed.summaries[0],
    observationIds: allowed.observations.slice(0, 2),
    priorityId: allowed.priorities[0],
    limitationsId: allowed.limitations[0],
  };
  assert.match(resolveNarrativeSelection(valid, result), /self-reported/i);
  assert.equal(resolveNarrativeSelection({ ...valid, summaryId: "summary_unknown" }, result), null);
  assert.equal(resolveNarrativeSelection({
    ...valid,
    observationIds: [allowed.observations[0], allowed.observations[0]],
  }, result), null);
  assert.equal(resolveNarrativeSelection({ ...valid, priorityId: "priority_unknown" }, result), null);
  assert.equal(resolveNarrativeSelection({ ...valid, limitationsId: "" }, result), null);
  assert.equal(resolveNarrativeSelection({ ...valid, prose: "Invented narrative." }, result), null);
});

test("validated narrative uses only local prose and falls back completely for an invalid selection", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.ASSESSMENT_NARRATIVE_MODEL;
  process.env.OPENAI_API_KEY = "key";
  process.env.ASSESSMENT_NARRATIVE_MODEL = "model";
  try {
    const allowed = buildNarrativeModelInput(result).allowedBlockIds;
    const selected = await generateValidatedNarrative(result, {
      callModel: async () => ({
        summaryId: allowed.summaries[0],
        observationIds: allowed.observations.slice(0, 2),
        priorityId: allowed.priorities[0],
        limitationsId: allowed.limitations[0],
      }),
    });
    assert.equal(selected.source, "ai");
    assert.match(selected.text, /self-reported/i);

    const fallback = await generateValidatedNarrative(result, {
      callModel: async () => ({
        summaryId: allowed.summaries[0],
        observationIds: ["invented_observation"],
        priorityId: allowed.priorities[0],
        limitationsId: allowed.limitations[0],
      }),
    });
    assert.deepEqual(fallback, { source: "rules", text: result.narrative.summary });
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.ASSESSMENT_NARRATIVE_MODEL;
    else process.env.ASSESSMENT_NARRATIVE_MODEL = previousModel;
  }
});

test("narrative route permits one atomic generation attempt and uses rules on retry", async () => {
  let attempts = 0;
  let generations = 0;
  const handler = createAssessmentNarrativeHandler({
    findRecord: async () => record,
    checkRateLimit: async () => true,
    checkGlobalRateLimit: async () => true,
    isNarrativeModelConfigured: () => true,
    claimNarrativeAttempt: async () => {
      attempts += 1;
      return attempts === 1 ? "claimed" : "already_attempted";
    },
    generateNarrative: async () => {
      generations += 1;
      return { source: "ai", text: "Locally approved narrative." };
    },
    updateNarrativeSource: async () => {},
    claimInternalNotification: async () => "sent",
    finalizeInternalNotification: async () => {},
    sendInternalNotification: async () => ({ accepted: true }),
  });

  const first = await handler(request(), context);
  const second = await handler(request(), context);
  assert.equal((await first.json()).narrative.source, "ai");
  assert.equal((await second.json()).narrative.source, "rules");
  assert.equal(generations, 1);
});

test("global narrative circuit breaker prevents OpenAI while preserving rules output", async () => {
  let generations = 0;
  const handler = createAssessmentNarrativeHandler({
    findRecord: async () => record,
    checkRateLimit: async () => true,
    checkGlobalRateLimit: async () => false,
    claimNarrativeAttempt: async () => "claimed",
    generateNarrative: async () => {
      generations += 1;
      return { source: "ai", text: "Never returned." };
    },
    updateNarrativeSource: async () => {},
    claimInternalNotification: async () => "sent",
    finalizeInternalNotification: async () => {},
    sendInternalNotification: async () => ({ accepted: true }),
  });

  const response = await handler(request(), context);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.narrative.source, "rules");
  assert.equal(generations, 0);
});

test("email sending lease is reclaimable only after the short lease and before 24 hours", () => {
  const now = new Date("2026-07-30T12:00:00.000Z");
  assert.equal(isReclaimableInternalNotificationLease("sending", "2026-07-30T11:49:59.999Z", now), true);
  assert.equal(isReclaimableInternalNotificationLease("sending", "2026-07-30T11:50:00.000Z", now), false);
  assert.equal(isReclaimableInternalNotificationLease("sending", "2026-07-29T12:00:00.000Z", now), false);
  assert.equal(isReclaimableInternalNotificationLease("indeterminate", "2026-07-30T11:00:00.000Z", now), false);
});

test("compact findings persist normalized codes only and initialize narrative-attempt state", () => {
  const compact = toAssessmentRecord({ id: assessmentId, lead, result, role: answers.role });
  const findings = JSON.parse(compact.findingsJson);
  assert.ok(findings.length > 0);
  assert.ok(findings.every((finding) =>
    Object.keys(finding).sort().join(",") === "code,component,kind"
  ));
  assert.equal(compact.narrativeAttemptStatus, "pending");
  assert.equal(compact.narrativeAttemptedAt, null);
  assert.equal(compact.internalNotificationPayloadHash, null);
});

test("Cloudflare config includes a constant-key global narrative circuit breaker", async () => {
  const config = JSON.parse(await readFile(new URL("wrangler.jsonc", projectRoot), "utf8"));
  const limiter = config.ratelimits.find((entry) => entry.name === "NARRATIVE_GLOBAL_RATE_LIMITER");
  assert.ok(limiter);
  assert.equal(limiter.simple.period, 60);
  assert.ok(limiter.simple.limit > 0);
});

test("migration marks retained records attempted and removes historical raw finding evidence", async () => {
  const sql = await readFile(new URL("drizzle/0006_lethal_scarlet_witch.sql", projectRoot), "utf8");
  assert.match(sql, /ADD `narrative_attempt_status`/i);
  assert.match(sql, /ADD `narrative_attempted_at`/i);
  assert.match(sql, /UPDATE assessment_records[\s\S]*narrative_attempt_status\s*=\s*'attempted'/i);
  assert.match(sql, /findings_json\s*=\s*'\[\]'/i);
});
test("retention copy describes the 90-day period, daily cleanup lag, and operational mailbox policy", async () => {
  const [privacy, gate, readme] = await Promise.all([
    readFile(new URL("app/privacy/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/assessment/ContactGate.tsx", projectRoot), "utf8"),
    readFile(new URL("README.md", projectRoot), "utf8"),
  ]);
  for (const source of [privacy, gate, readme]) {
    assert.match(source, /90-day period/i);
    assert.match(source, /normally within 24 hours/i);
    assert.doesNotMatch(source, /up to 90 days/i);
  }
  assert.match(privacy, /mailbox.*operational policy/is);
  assert.doesNotMatch(privacy, /application-enforced.*mailbox/i);
});
