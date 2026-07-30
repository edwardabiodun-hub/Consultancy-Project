import assert from "node:assert/strict";
import test from "node:test";
import { createAssessmentNarrativeHandler } from "../../app/api/assessment/[id]/narrative/route.ts";
import { QUESTION_BANK } from "../../lib/assessment/questions.ts";
import { toAssessmentRecord } from "../../lib/assessment/record.ts";
import { buildAssessmentResult } from "../../lib/assessment/result.ts";

const assessmentId = "8d7b76ca-86bf-46a6-88f4-42b6dfecd159";
const payload = {
  answers: {
    employeeBand: "20-49", managerBand: "3-5", revenueBand: "5m-20m",
    role: "Owner-operator", coreSystemCount: "twoOrMore",
    organizationShape: "multipleTeams", relationshipLedByOwner: true,
    restrictedMarket: false,
    scored: Object.fromEntries(QUESTION_BANK.map((question) => [question.id, 50])),
    capacity: { source: "none", activities: [] },
  },
  lead: {
    name: "Avery Founder", workEmail: "avery@example.com",
    company: "Example Operations", phone: "843-555-0100",
    reportConsent: true, marketingConsent: false,
  },
};
const result = buildAssessmentResult(payload.answers);
const record = {
  ...toAssessmentRecord({ id: assessmentId, lead: payload.lead, result, role: payload.answers.role }),
  createdAt: "2026-07-29 12:00:00",
};
const request = (body = payload) => new Request(
  `https://example.com/api/assessment/${assessmentId}/narrative`,
  { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
);
const context = { params: Promise.resolve({ id: assessmentId }) };
const dependencies = (overrides = {}) => ({
  findRecord: async () => record,
  checkRateLimit: async () => true,
  generateNarrative: async () => ({ source: "rules", text: "Rules narrative." }),
  updateNarrativeSource: async () => {},
  claimInternalNotification: async () => "claimed",
  finalizeInternalNotification: async () => {},
  sendInternalNotification: async () => ({ accepted: true }),
  ...overrides,
});

test("narrative route rejects an unknown assessment before AI, mutation, or email", async () => {
  const calls = [];
  const handler = createAssessmentNarrativeHandler(dependencies({
    findRecord: async () => null,
    generateNarrative: async () => { calls.push("ai"); },
    updateNarrativeSource: async () => { calls.push("update"); },
    sendInternalNotification: async () => { calls.push("email"); },
  }));
  const response = await handler(request(), context);
  assert.equal(response.status, 404);
  assert.deepEqual(calls, []);
});

test("narrative route distinguishes unavailable persistence from an unknown record", async () => {
  const handler = createAssessmentNarrativeHandler(dependencies({
    findRecord: async () => { throw new Error("D1 unavailable"); },
  }));
  const response = await handler(request(), context);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("narrative route rejects posted lead or deterministic results that do not match the persisted record", async (t) => {
  for (const fixture of [
    { label: "lead mismatch", body: { ...payload, lead: { ...payload.lead, company: "Other Company" } } },
    { label: "result mismatch", body: { ...payload, answers: { ...payload.answers, scored: { ...payload.answers.scored, criticalDecisions: 25 } } } },
  ]) {
    await t.test(fixture.label, async () => {
      let generated = false;
      const handler = createAssessmentNarrativeHandler(dependencies({
        generateNarrative: async () => { generated = true; },
      }));
      const response = await handler(request(fixture.body), context);
      assert.equal(response.status, 404);
      assert.equal(generated, false);
    });
  }
});

test("narrative route enforces the configured per-assessment abuse boundary before AI", async () => {
  let generated = false;
  const handler = createAssessmentNarrativeHandler(dependencies({
    checkRateLimit: async () => false,
    generateNarrative: async () => { generated = true; },
  }));
  const response = await handler(request(), context);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
  assert.equal(generated, false);
});

test("durable notification state sends once and suppresses later requests", async () => {
  let state = "pending";
  let sends = 0;
  const handler = createAssessmentNarrativeHandler(dependencies({
    claimInternalNotification: async () => {
      if (state === "sent") return "sent";
      state = "sending";
      return "claimed";
    },
    finalizeInternalNotification: async (_id, outcome) => { state = outcome; },
    sendInternalNotification: async () => { sends += 1; return { accepted: true }; },
  }));
  const first = await handler(request(), context);
  const second = await handler(request(), context);
  assert.equal((await first.json()).internalNotificationAccepted, true);
  assert.equal((await second.json()).internalNotificationAccepted, true);
  assert.equal(sends, 1);
  assert.equal(state, "sent");
});

test("a definitive email rejection is marked failed and can be retried safely", async () => {
  let state = "pending";
  let sends = 0;
  const handler = createAssessmentNarrativeHandler(dependencies({
    claimInternalNotification: async () => {
      if (state === "sent") return "sent";
      if (state === "sending" || state === "indeterminate") return "busy";
      state = "sending";
      return "claimed";
    },
    finalizeInternalNotification: async (_id, outcome) => { state = outcome; },
    sendInternalNotification: async () => {
      sends += 1;
      return sends === 1 ? { accepted: false, retryable: true } : { accepted: true };
    },
  }));
  assert.equal((await (await handler(request(), context)).json()).internalNotificationAccepted, false);
  assert.equal(state, "failed");
  assert.equal((await (await handler(request(), context)).json()).internalNotificationAccepted, true);
  assert.equal(sends, 2);
  assert.equal(state, "sent");
});

test("an ambiguous email timeout is marked indeterminate and is not automatically resent", async () => {
  let state = "pending";
  let sends = 0;
  const handler = createAssessmentNarrativeHandler(dependencies({
    claimInternalNotification: async () => {
      if (state === "sending" || state === "indeterminate") return "busy";
      state = "sending";
      return "claimed";
    },
    finalizeInternalNotification: async (_id, outcome) => { state = outcome; },
    sendInternalNotification: async () => { sends += 1; return { accepted: false, retryable: false }; },
  }));
  await handler(request(), context);
  await handler(request(), context);
  assert.equal(sends, 1);
  assert.equal(state, "indeterminate");
});