import assert from "node:assert/strict";
import test from "node:test";
import { QUESTION_BANK } from "../../lib/assessment/questions.ts";
import { buildAssessmentResult } from "../../lib/assessment/result.ts";
import { toAssessmentRecord } from "../../lib/assessment/record.ts";
import {
  createAssessmentNarrativeHandler,
} from "../../app/api/assessment/[id]/narrative/route.ts";

// Closed-set model-boundary and fallback coverage lives in
// task8-remediation.test.mjs. This file retains the API route contract tests.

// ---------------------------------------------------------------------------
// POST /api/assessment/:id/narrative
// ---------------------------------------------------------------------------

const assessmentId = "8d7b76ca-86bf-46a6-88f4-42b6dfecd159";

const validPayload = {
  answers: {
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
  },
  lead: {
    name: "Eddie",
    workEmail: "e@example.com",
    company: "Example",
    phone: "843-555-0100",
    reportConsent: true,
    marketingConsent: false,
  },
};


const routeResult = buildAssessmentResult(validPayload.answers);
const routeRecord = {
  ...toAssessmentRecord({
    id: assessmentId,
    lead: validPayload.lead,
    result: routeResult,
    role: validPayload.answers.role,
  }),
  createdAt: "2026-07-29 12:00:00",
};
const routeTestDependencies = {
  findRecord: async () => routeRecord,
  checkRateLimit: async () => true,
  checkGlobalRateLimit: async () => true,
  isNarrativeModelConfigured: () => true,
  claimNarrativeAttempt: async () => "claimed",
  claimInternalNotification: async () => "claimed",
  finalizeInternalNotification: async () => {},
};
const narrativeRequest = (id, body) =>
  new Request(`https://example.com/api/assessment/${id}/narrative`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

test("narrative route returns 404 for a malformed id and never generates or persists a narrative", async () => {
  let generateCalled = false;
  let updateCalled = false;
  const handler = createAssessmentNarrativeHandler({
    ...routeTestDependencies,
    generateNarrative: async () => {
      generateCalled = true;
      return { source: "rules", text: "unused" };
    },
    updateNarrativeSource: async () => {
      updateCalled = true;
    },
  });

  const response = await handler(narrativeRequest("not-a-uuid", validPayload), {
    params: Promise.resolve({ id: "not-a-uuid" }),
  });

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(generateCalled, false);
  assert.equal(updateCalled, false);
});

test("narrative route returns 422 for an invalid payload without generating a narrative", async () => {
  let generateCalled = false;
  const handler = createAssessmentNarrativeHandler({
    ...routeTestDependencies,
    generateNarrative: async () => {
      generateCalled = true;
      return { source: "rules", text: "unused" };
    },
  });

  const response = await handler(
    narrativeRequest(assessmentId, { answers: { employeeBand: "not-a-real-band" } }),
    { params: Promise.resolve({ id: assessmentId }) },
  );

  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(generateCalled, false);
});

test("narrative route recomputes the result server-side without forwarding raw answer context", async () => {
  let generatorArgumentCount = null;
  let receivedResult = null;
  const handler = createAssessmentNarrativeHandler({
    ...routeTestDependencies,
    generateNarrative: async (...args) => {
      const [result] = args;
      receivedResult = result;
      generatorArgumentCount = args.length;
      return { source: "rules", text: result.narrative.summary };
    },
    updateNarrativeSource: async () => {},
  });

  const response = await handler(
    narrativeRequest(assessmentId, { ...validPayload, result: { score: { overall: 999 } } }),
    { params: Promise.resolve({ id: assessmentId }) },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(receivedResult.score.overall, 50, "server must recompute, never trust a client-supplied result");
  assert.equal(generatorArgumentCount, 1);
  assert.equal(body.narrative.source, "rules");
});

test("narrative route persists the accepted narrative source against the given id", async () => {
  let updatedId = null;
  let updatedSource = null;
  const handler = createAssessmentNarrativeHandler({
    ...routeTestDependencies,
    generateNarrative: async () => ({ source: "ai", text: "An AI narrative." }),
    updateNarrativeSource: async (id, source) => {
      updatedId = id;
      updatedSource = source;
    },
  });

  const response = await handler(narrativeRequest(assessmentId, validPayload), {
    params: Promise.resolve({ id: assessmentId }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.persistenceAvailable, true);
  assert.deepEqual(body.narrative, { source: "ai", text: "An AI narrative." });
  assert.equal(updatedId, assessmentId);
  assert.equal(updatedSource, "ai");
});

test("narrative route reports persistenceAvailable=false without failing the request when the D1 update throws", async () => {
  const handler = createAssessmentNarrativeHandler({
    ...routeTestDependencies,
    generateNarrative: async () => ({ source: "rules", text: "Rules narrative." }),
    updateNarrativeSource: async () => {
      throw new Error("D1 unavailable");
    },
  });

  const response = await handler(narrativeRequest(assessmentId, validPayload), {
    params: Promise.resolve({ id: assessmentId }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.persistenceAvailable, false);
  assert.deepEqual(body.narrative, { source: "rules", text: "Rules narrative." });
});

test("narrative route sends only approved data to the internal notification after persistence", async () => {
  let notificationInput = null;
  let persisted = false;
  const expectedServerResult = buildAssessmentResult(validPayload.answers);
  const handler = createAssessmentNarrativeHandler({
    ...routeTestDependencies,
    generateNarrative: async () => ({ source: "ai", text: "An AI narrative." }),
    updateNarrativeSource: async () => {
      persisted = true;
    },
    sendInternalNotification: async (input) => {
      assert.equal(persisted, true, "notification must follow the best-effort source update");
      notificationInput = input;
      return { accepted: true };
    },
  });

  const response = await handler(narrativeRequest(assessmentId, validPayload), {
    params: Promise.resolve({ id: assessmentId }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(notificationInput, {
    assessmentId,
    lead: {
      name: validPayload.lead.name,
      email: validPayload.lead.workEmail,
      company: validPayload.lead.company,
      role: validPayload.answers.role,
    },
    result: expectedServerResult,
    narrative: { source: "ai", text: "An AI narrative." },
  });
  assert.equal("phone" in notificationInput, false);
  assert.equal("reportConsent" in notificationInput, false);
  assert.equal("marketingConsent" in notificationInput, false);
  assert.equal("scored" in notificationInput, false);
  assert.equal("freeText" in notificationInput, false);
  assert.deepEqual(body, {
    ok: true,
    narrative: { source: "ai", text: "An AI narrative." },
    persistenceAvailable: true,
    internalNotificationAccepted: true,
  });
});

test("narrative route returns the accepted narrative when internal notification declines it", async () => {
  const handler = createAssessmentNarrativeHandler({
    ...routeTestDependencies,
    generateNarrative: async () => ({ source: "ai", text: "An AI narrative." }),
    updateNarrativeSource: async () => {},
    sendInternalNotification: async () => ({ accepted: false }),
  });

  const response = await handler(narrativeRequest(assessmentId, validPayload), {
    params: Promise.resolve({ id: assessmentId }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.narrative, { source: "ai", text: "An AI narrative." });
  assert.equal(body.internalNotificationAccepted, false);
});

test("narrative route converts an unexpected internal notification error to an unaccepted notification", async () => {
  const handler = createAssessmentNarrativeHandler({
    ...routeTestDependencies,
    generateNarrative: async () => ({ source: "ai", text: "An AI narrative." }),
    updateNarrativeSource: async () => {},
    sendInternalNotification: async () => {
      throw new Error("Resend unavailable");
    },
  });

  const response = await handler(narrativeRequest(assessmentId, validPayload), {
    params: Promise.resolve({ id: assessmentId }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.narrative, { source: "ai", text: "An AI narrative." });
  assert.equal(body.internalNotificationAccepted, false);
});

test("narrative route sends a clearly labeled rules fallback to internal notification", async () => {
  let notificationInput = null;
  const handler = createAssessmentNarrativeHandler({
    ...routeTestDependencies,
    generateNarrative: async () => ({ source: "rules", text: "Rules narrative." }),
    updateNarrativeSource: async () => {},
    sendInternalNotification: async (input) => {
      notificationInput = input;
      return { accepted: true };
    },
  });

  const response = await handler(narrativeRequest(assessmentId, validPayload), {
    params: Promise.resolve({ id: assessmentId }),
  });
  const body = await response.json();

  assert.deepEqual(notificationInput.narrative, { source: "rules", text: "Rules narrative." });
  assert.equal(body.internalNotificationAccepted, true);
});

test("narrative route uses the same assessment id for each internal notification retry", async () => {
  const notifiedIds = [];
  const handler = createAssessmentNarrativeHandler({
    ...routeTestDependencies,
    generateNarrative: async () => ({ source: "rules", text: "Rules narrative." }),
    updateNarrativeSource: async () => {},
    sendInternalNotification: async ({ assessmentId: id }) => {
      notifiedIds.push(id);
      return { accepted: true };
    },
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await handler(narrativeRequest(assessmentId, validPayload), {
      params: Promise.resolve({ id: assessmentId }),
    });
    assert.equal(response.status, 200);
  }

  assert.deepEqual(notifiedIds, [assessmentId, assessmentId]);
});
