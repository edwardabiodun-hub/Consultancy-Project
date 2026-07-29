import assert from "node:assert/strict";
import test from "node:test";
import { QUESTION_BANK } from "../../lib/assessment/questions.ts";
import { buildAssessmentResult } from "../../lib/assessment/result.ts";
import { validateNarrative } from "../../lib/assessment/narrative-validation.ts";
import {
  buildNarrativeModelInput,
  callNarrativeModel,
  flattenNarrativeDraft,
  generateValidatedNarrative,
} from "../../lib/assessment/narrative.ts";
import {
  createAssessmentNarrativeHandler,
} from "../../app/api/assessment/[id]/narrative/route.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseAnswers = {
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

const ownerActivity = {
  activityId: "owner-exact",
  category: "owner",
  hoursPerOccurrence: 2,
  occurrencesPerYear: 50,
  hourlyCost: 100,
};
const reportingActivity = {
  activityId: "reporting-exact",
  category: "reporting",
  people: 2,
  hoursPerOccurrence: 5,
  occurrencesPerYear: 20,
  hourlyCost: 60,
};

// Exact capacity source -> recoverableHours 150/210, annualValue 11,000/15,400.
const result = buildAssessmentResult({
  ...baseAnswers,
  capacity: { source: "exact", activities: [ownerActivity, reportingActivity] },
});

// Banded capacity source -> "directional" estimateType with recoverableHours
// 105/165 and annualValue 7,700/12,100, used for the estimate-labeling check.
const directionalResult = buildAssessmentResult({
  ...baseAnswers,
  capacity: {
    source: "banded",
    activities: [
      { ...ownerActivity, activityId: "owner-banded" },
      { ...reportingActivity, activityId: "reporting-banded" },
    ],
  },
});

const restrictedResult = buildAssessmentResult({ ...baseAnswers, restrictedMarket: true });

const validDraft = () => ({
  summary:
    "The self-reported result shows a developing level of independence across the three assessed areas.",
  componentObservations: [
    {
      component: "ownerIndependence",
      observation: "Owner independence scored 50, a self-reported watchpoint on decision concentration.",
    },
    {
      component: "operatingSystem",
      observation: "The operating system scored 50, a self-reported watchpoint on workflow documentation.",
    },
    {
      component: "informationVisibility",
      observation: "Information visibility scored 50, a self-reported watchpoint on KPI cadence.",
    },
  ],
  priorityExplanation:
    "The first controlled priority is to Clarify decision authority by defining the recurring decisions managers can make without escalation.",
  limitations:
    "This is a self-reported result and not an audit of implementation effort, savings, revenue, or valuation.",
});

// ---------------------------------------------------------------------------
// validateNarrative: policy rejection cases from the brief
// ---------------------------------------------------------------------------

test("validateNarrative accepts a draft that stays within the controlled vocabulary", () => {
  assert.equal(validateNarrative(validDraft(), result), true);
});

test("validateNarrative accepts capacity figures that exactly match the deterministic result", () => {
  const draft = {
    ...validDraft(),
    summary: `${validDraft().summary} Recoverable capacity is estimated at $11,000 to $15,400 annually across 150 to 210 hours.`,
  };
  assert.equal(validateNarrative(draft, result), true);
});

test("validateNarrative rejects a financial number absent from the deterministic capacity output", () => {
  const draft = {
    ...validDraft(),
    summary: `${validDraft().summary} This could unlock $50,000 in annual value.`,
  };
  assert.equal(validateNarrative(draft, result), false);
});

test("validateNarrative rejects an invented risk code that was never sent to the model", () => {
  // Sanity check: `result` (all scored answers = 50) only ever produces
  // owner_independence_watchpoint / operating_system_watchpoint /
  // information_visibility_watchpoint codes (see the fixture-derived test
  // below), so "cashflow_crisis_signal" is not present in result.risks either
  // before or after the fix - it should always be rejected.
  assert.equal(
    result.risks.some((risk) => risk.code === "cashflow_crisis_signal"),
    false,
  );
  const draft = {
    ...validDraft(),
    componentObservations: [
      ...validDraft().componentObservations.slice(1),
      {
        component: "ownerIndependence",
        observation: "This is flagged under risk code cashflow_crisis_signal.",
      },
    ],
  };
  assert.equal(validateNarrative(draft, result), false);
});

test("validateNarrative accepts a watchpoint/strength risk code that was actually provided to the model", () => {
  // `buildNarrativeModelInput` sends `result.risks.map(risk => risk.code)` to
  // the model, and for this fixture (all scored answers = 50) every finding
  // resolves to a watchpoint code - none of which are risk codes, yet they
  // are still legitimate, model-provided vocabulary the draft must be
  // allowed to reference.
  const watchpointCode = result.risks.find((risk) => risk.kind === "watchpoint")?.code;
  assert.equal(watchpointCode, "owner_independence_watchpoint");

  const draft = {
    ...validDraft(),
    componentObservations: [
      ...validDraft().componentObservations.slice(1),
      {
        component: "ownerIndependence",
        observation: `This is flagged under the provided finding code ${watchpointCode}.`,
      },
    ],
  };
  assert.equal(validateNarrative(draft, result), true);
});

test("validateNarrative rejects a risk code that is valid vocabulary in general but absent from this result's risks", () => {
  // "operating_system_watchpoint" is a real code the model can be given for
  // other results, but it is not among this fixture's `result.risks` (which
  // resolves to owner_independence_watchpoint / operating_system_watchpoint
  // / information_visibility_watchpoint - so pick one deliberately excluded
  // from what was sent for a *different* assessment to prove the allow-list
  // is scoped per call, not global).
  const otherAssessmentOnlyCode = "owner_independence_strength";
  assert.equal(
    result.risks.some((risk) => risk.code === otherAssessmentOnlyCode),
    false,
  );
  const draft = {
    ...validDraft(),
    componentObservations: [
      ...validDraft().componentObservations.slice(1),
      {
        component: "ownerIndependence",
        observation: `This is flagged under the finding code ${otherAssessmentOnlyCode}.`,
      },
    ],
  };
  assert.equal(validateNarrative(draft, result), false);
});

test("validateNarrative rejects invented benchmark phrases", () => {
  for (const phrase of [
    "This is below the industry average.",
    "This places you outside the top quartile.",
    "This is typical for companies like yours.",
  ]) {
    const draft = { ...validDraft(), summary: `${validDraft().summary} ${phrase}` };
    assert.equal(validateNarrative(draft, result), false, phrase);
  }
});

test("validateNarrative rejects a recommendation outside the controlled priority library", () => {
  const draft = {
    ...validDraft(),
    priorityExplanation:
      "We recommend immediately hiring a Chief Operating Officer and rolling out Six Sigma black belt training.",
  };
  assert.equal(validateNarrative(draft, result), false);
});

test("validateNarrative rejects promised savings, revenue, valuation, or guaranteed results", () => {
  for (const phrase of [
    "This guarantees improved results within 90 days.",
    "We promise this will save you significant money.",
    "This will increase your valuation immediately.",
    "These are guaranteed revenue gains.",
  ]) {
    const draft = { ...validDraft(), summary: `${validDraft().summary} ${phrase}` };
    assert.equal(validateNarrative(draft, result), false, phrase);
  }
});

test("validateNarrative rejects an unlabeled directional estimate presented as fact", () => {
  const draft = {
    ...validDraft(),
    summary:
      "Developing independence is indicated. Recovered capacity is $7,700 to $12,100 annually across 105 to 165 hours.",
  };
  assert.equal(validateNarrative(draft, directionalResult), false);
});

test("validateNarrative accepts a directional estimate that is clearly labeled as an estimate", () => {
  const draft = {
    ...validDraft(),
    summary:
      "Developing independence is indicated. Recovered capacity is a directional estimate of $7,700 to $12,100 annually across 105 to 165 hours.",
  };
  assert.equal(validateNarrative(draft, directionalResult), true);
});

test("validateNarrative rejects a commercial CTA for a restricted record", () => {
  const draft = {
    ...validDraft(),
    priorityExplanation: `${validDraft().priorityExplanation} Schedule a call to discuss the Business Independence Diagnostic.`,
  };
  assert.equal(validateNarrative(draft, restrictedResult), false);
});

test("validateNarrative accepts the restricted record's own educational CTA language", () => {
  const draft = {
    ...validDraft(),
    priorityExplanation: `${validDraft().priorityExplanation} Explore educational founder resources next.`,
  };
  assert.equal(validateNarrative(draft, restrictedResult), true);
});

test("validateNarrative rejects a component name outside the three known components", () => {
  const draft = {
    ...validDraft(),
    componentObservations: [
      { component: "customerSuccess", observation: "This area needs attention." },
    ],
  };
  assert.equal(validateNarrative(draft, result), false);
});

test("validateNarrative rejects limitations text missing the self-reported or not-an-audit disclosure", () => {
  const missingSelfReported = { ...validDraft(), limitations: "This is not an audit of your business." };
  const missingNotAnAudit = { ...validDraft(), limitations: "This is a self-reported result." };
  assert.equal(validateNarrative(missingSelfReported, result), false);
  assert.equal(validateNarrative(missingNotAnAudit, result), false);
});

// ---------------------------------------------------------------------------
// buildNarrativeModelInput / flattenNarrativeDraft
// ---------------------------------------------------------------------------

test("buildNarrativeModelInput sends only safe business context, never contact fields", () => {
  const input = buildNarrativeModelInput(result, {
    employeeBand: "20-49",
    revenueBand: "5m-20m",
    role: "Owner-operator",
    restrictedMarket: false,
  });

  assert.equal(input.employeeBand, "20-49");
  assert.equal(input.revenueBand, "5m-20m");
  assert.equal(input.role, "Owner-operator");
  assert.equal(input.restrictedMarket, false);
  assert.equal(input.overallScore, result.score.overall);
  assert.deepEqual(input.capacity.recoverableHours, result.capacity.recoverableHours);
  assert.deepEqual(
    input.priorities.map((priority) => priority.component),
    result.interpretation.priorities.map((priority) => priority.component),
  );
  assert.equal("name" in input, false);
  assert.equal("workEmail" in input, false);
  assert.equal("phone" in input, false);
  assert.equal("scored" in input, false);
});

test("flattenNarrativeDraft joins the four contract fields into a single readable string", () => {
  const text = flattenNarrativeDraft(validDraft());
  assert.match(text, /developing level of independence/i);
  assert.match(text, /clarify decision authority/i);
  assert.match(text, /self-reported result and not an audit/i);
});

// ---------------------------------------------------------------------------
// callNarrativeModel: real request shape and timeout wiring
// ---------------------------------------------------------------------------

test("callNarrativeModel sends the configured model and parses JSON message content", async () => {
  let requestBody = null;
  let requestUrl = null;
  let requestHeaders = null;
  const fetchImpl = async (url, init) => {
    requestUrl = url;
    requestHeaders = init.headers;
    requestBody = JSON.parse(String(init.body));
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(validDraft()) } }],
      }),
      { status: 200 },
    );
  };

  const draft = await callNarrativeModel(buildNarrativeModelInput(result, {
    employeeBand: "20-49",
    revenueBand: "5m-20m",
    role: "Owner-operator",
    restrictedMarket: false,
  }), {
    apiKey: "test-key",
    model: "test-model",
    fetchImpl,
  });

  assert.equal(requestUrl, "https://api.openai.com/v1/chat/completions");
  assert.equal(requestHeaders.Authorization, "Bearer test-key");
  assert.equal(requestBody.model, "test-model");
  assert.deepEqual(draft, validDraft());
});

test("callNarrativeModel aborts and rejects when the request exceeds the configured timeout", async () => {
  const hangingFetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        reject(error);
      });
    });

  await assert.rejects(
    callNarrativeModel(
      buildNarrativeModelInput(result, {
        employeeBand: "20-49",
        revenueBand: "5m-20m",
        role: "Owner-operator",
        restrictedMarket: false,
      }),
      { apiKey: "test-key", model: "test-model", timeoutMs: 15, fetchImpl: hangingFetch },
    ),
  );
});

test("callNarrativeModel throws on malformed JSON message content", async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({ choices: [{ message: { content: "{not valid json" } }] }),
      { status: 200 },
    );

  await assert.rejects(
    callNarrativeModel(
      buildNarrativeModelInput(result, {
        employeeBand: "20-49",
        revenueBand: "5m-20m",
        role: "Owner-operator",
        restrictedMarket: false,
      }),
      { apiKey: "test-key", model: "test-model", fetchImpl },
    ),
  );
});

// ---------------------------------------------------------------------------
// generateValidatedNarrative: fallback behavior
// ---------------------------------------------------------------------------

const withEnv = async (env, run) => {
  const previous = {};
  for (const key of Object.keys(env)) {
    previous[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  try {
    await run();
  } finally {
    for (const key of Object.keys(env)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
};

const safeContext = {
  employeeBand: "20-49",
  revenueBand: "5m-20m",
  role: "Owner-operator",
  restrictedMarket: false,
};

test("generateValidatedNarrative falls back to rules when API key and model are unset", async () => {
  let called = false;
  await withEnv(
    { OPENAI_API_KEY: undefined, ASSESSMENT_NARRATIVE_MODEL: undefined },
    async () => {
      const outcome = await generateValidatedNarrative(result, safeContext, {
        callModel: async () => {
          called = true;
          return validDraft();
        },
      });
      assert.deepEqual(outcome, { source: "rules", text: result.narrative.summary });
    },
  );
  assert.equal(called, false, "the model should never be called when unconfigured");
});

test("generateValidatedNarrative falls back to rules when only the API key is set", async () => {
  await withEnv(
    { OPENAI_API_KEY: "key", ASSESSMENT_NARRATIVE_MODEL: undefined },
    async () => {
      const outcome = await generateValidatedNarrative(result, safeContext, {
        callModel: async () => validDraft(),
      });
      assert.equal(outcome.source, "rules");
    },
  );
});

test("generateValidatedNarrative falls back to rules when the model call throws", async () => {
  await withEnv(
    { OPENAI_API_KEY: "key", ASSESSMENT_NARRATIVE_MODEL: "model" },
    async () => {
      const outcome = await generateValidatedNarrative(result, safeContext, {
        callModel: async () => {
          throw new Error("network unreachable");
        },
      });
      assert.deepEqual(outcome, { source: "rules", text: result.narrative.summary });
    },
  );
});

test("generateValidatedNarrative falls back to rules on a real network timeout", async () => {
  await withEnv(
    { OPENAI_API_KEY: "key", ASSESSMENT_NARRATIVE_MODEL: "model" },
    async () => {
      const hangingFetch = (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            const error = new Error("The operation was aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      const outcome = await generateValidatedNarrative(result, safeContext, {
        timeoutMs: 15,
        fetchImpl: hangingFetch,
      });
      assert.deepEqual(outcome, { source: "rules", text: result.narrative.summary });
    },
  );
});

test("generateValidatedNarrative falls back to rules on malformed JSON from the model", async () => {
  await withEnv(
    { OPENAI_API_KEY: "key", ASSESSMENT_NARRATIVE_MODEL: "model" },
    async () => {
      const fetchImpl = async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: "{not valid json" } }] }),
          { status: 200 },
        );
      const outcome = await generateValidatedNarrative(result, safeContext, { fetchImpl });
      assert.deepEqual(outcome, { source: "rules", text: result.narrative.summary });
    },
  );
});

test("generateValidatedNarrative falls back to rules when the draft shape does not match the contract", async () => {
  await withEnv(
    { OPENAI_API_KEY: "key", ASSESSMENT_NARRATIVE_MODEL: "model" },
    async () => {
      const outcome = await generateValidatedNarrative(result, safeContext, {
        callModel: async () => ({ summary: "Missing the other required fields." }),
      });
      assert.deepEqual(outcome, { source: "rules", text: result.narrative.summary });
    },
  );
});

test("generateValidatedNarrative falls back to rules when the draft fails policy validation", async () => {
  await withEnv(
    { OPENAI_API_KEY: "key", ASSESSMENT_NARRATIVE_MODEL: "model" },
    async () => {
      const outcome = await generateValidatedNarrative(result, safeContext, {
        callModel: async () => ({
          ...validDraft(),
          summary: `${validDraft().summary} This guarantees results.`,
        }),
      });
      assert.deepEqual(outcome, { source: "rules", text: result.narrative.summary });
    },
  );
});

test("generateValidatedNarrative returns the AI source and flattened text for a valid draft", async () => {
  await withEnv(
    { OPENAI_API_KEY: "key", ASSESSMENT_NARRATIVE_MODEL: "model" },
    async () => {
      const outcome = await generateValidatedNarrative(result, safeContext, {
        callModel: async () => validDraft(),
      });
      assert.equal(outcome.source, "ai");
      assert.equal(outcome.text, flattenNarrativeDraft(validDraft()));
    },
  );
});

test("generateValidatedNarrative never forwards restricted-record content into a commercial CTA", async () => {
  await withEnv(
    { OPENAI_API_KEY: "key", ASSESSMENT_NARRATIVE_MODEL: "model" },
    async () => {
      const outcome = await generateValidatedNarrative(restrictedResult, {
        ...safeContext,
        restrictedMarket: true,
      }, {
        callModel: async () => ({
          ...validDraft(),
          priorityExplanation: `${validDraft().priorityExplanation} Schedule a call to discuss the Business Independence Diagnostic.`,
        }),
      });
      assert.deepEqual(outcome, { source: "rules", text: restrictedResult.narrative.summary });
    },
  );
});

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

test("narrative route recomputes the result server-side and forwards only safe context to generation", async () => {
  let receivedContext = null;
  let receivedResult = null;
  const handler = createAssessmentNarrativeHandler({
    generateNarrative: async (result, context) => {
      receivedResult = result;
      receivedContext = context;
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
  assert.deepEqual(receivedContext, {
    employeeBand: "20-49",
    revenueBand: "5m-20m",
    role: "Owner-operator",
    restrictedMarket: false,
  });
  assert.equal("name" in receivedContext, false);
  assert.equal("workEmail" in receivedContext, false);
  assert.equal("phone" in receivedContext, false);
  assert.equal(body.narrative.source, "rules");
});

test("narrative route persists the accepted narrative source against the given id", async () => {
  let updatedId = null;
  let updatedSource = null;
  const handler = createAssessmentNarrativeHandler({
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
