import assert from "node:assert/strict";
import test from "node:test";
import { buildAssessmentEmail } from "../../lib/email/assessment-report.ts";
import {
  createAssessmentDeliverHandler,
} from "../../app/api/assessment/[id]/deliver/route.ts";

const assessmentId = "8d7b76ca-86bf-46a6-88f4-42b6dfecd159";

const baseEmailRecord = {
  id: assessmentId,
  name: "Eddie Example",
  overallScore: 58,
  scoreConfidence: "high",
  leadRoute: "diagnostic",
};

test("buildAssessmentEmail summarizes score, category, and confidence", () => {
  const email = buildAssessmentEmail(baseEmailRecord);
  assert.match(email.subject, /Developing independence/i);
  assert.match(email.html, /58 \/ 100/);
  assert.match(email.text, /58 \/ 100/);
  assert.match(email.html, /Developing independence/i);
  assert.match(email.html, /high score confidence/i);
  assert.match(email.text, /high score confidence/i);
});

test("buildAssessmentEmail links back to the persisted report", () => {
  const email = buildAssessmentEmail(baseEmailRecord);
  const expectedPath = `/api/assessment/${assessmentId}/report`;
  assert.ok(email.html.includes(expectedPath), "html should link to the report route");
  assert.ok(email.text.includes(expectedPath), "text should link to the report route");
});

test("buildAssessmentEmail names the attached PDF after the assessment id", () => {
  const email = buildAssessmentEmail(baseEmailRecord);
  assert.equal(
    email.attachmentFilename,
    `business-independence-assessment-${assessmentId}.pdf`,
  );
});

test("buildAssessmentEmail states the self-reported, non-audit limitation", () => {
  const email = buildAssessmentEmail(baseEmailRecord);
  assert.match(email.html, /self-reported/i);
  assert.match(email.html, /not an audit/i);
  assert.match(email.text, /self-reported/i);
  assert.match(email.text, /not an audit/i);
});

test("buildAssessmentEmail includes a consulting CTA for a non-restricted route", () => {
  const email = buildAssessmentEmail({ ...baseEmailRecord, leadRoute: "diagnostic" });
  assert.match(email.html, /Discuss the Business Independence Diagnostic/i);
  assert.match(email.text, /Discuss the Business Independence Diagnostic/i);
});

test("buildAssessmentEmail avoids a consulting CTA for restricted records", () => {
  const email = buildAssessmentEmail({ ...baseEmailRecord, leadRoute: "restricted" });
  assert.doesNotMatch(email.html, /Discuss the Business Independence Diagnostic/i);
  assert.doesNotMatch(email.text, /Discuss the Business Independence Diagnostic/i);
  assert.match(email.html, /educational founder resources/i);
});

test("buildAssessmentEmail escapes respondent-controlled text in the HTML body", () => {
  const email = buildAssessmentEmail({
    ...baseEmailRecord,
    name: "<script>alert(1)</script> & Co",
  });
  assert.doesNotMatch(email.html, /<script>/i);
  assert.match(email.html, /&lt;script&gt;/i);
  assert.match(email.html, /&amp; Co/);
});

test("buildAssessmentEmail handles an incomplete result without inventing a score", () => {
  const email = buildAssessmentEmail({ ...baseEmailRecord, overallScore: null });
  assert.match(email.html, /Result incomplete/i);
  assert.doesNotMatch(email.html, /null/i);
});

// ---------------------------------------------------------------------------
// POST /api/assessment/:id/deliver
// ---------------------------------------------------------------------------

const baseDeliveryRecord = {
  id: assessmentId,
  assessmentVersion: "1.0.0",
  createdAt: "2026-07-26 12:00:00",
  name: "Eddie Example",
  company: "Example Company",
  overallScore: 58,
  ownerIndependenceScore: 42,
  operatingSystemScore: 61,
  informationVisibilityScore: 71,
  scoreCoverage: 0.92,
  scoreConfidence: "high",
  impactConfidence: "high",
  estimateType: "calculated",
  capacityInputSource: "exact",
  ownerGrossHours: 80,
  reportingGrossHours: 140,
  reworkGrossHours: 20,
  grossCapacityValue: 24_000,
  realizationFactorLow: 0.5,
  realizationFactorHigh: 0.7,
  recoverableHoursLow: 120,
  recoverableHoursHigh: 168,
  annualValueLow: 12_000,
  annualValueHigh: 16_800,
  findingsJson: "[]",
  capacityAssumptionCodesJson: "[]",
  capacityExclusionCodesJson: "[]",
  priorityIdsJson: "[]",
  leadRoute: "diagnostic",
  narrativeSource: "rules",
  workEmail: "eddie@example.com",
  reportConsent: true,
  marketingConsent: false,
  reportDeliveryStatus: "pending",
};

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

const withMockedFetch = async (mock, run) => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    await run();
  } finally {
    globalThis.fetch = previousFetch;
  }
};

const deliverRequest = (id) =>
  new Request(`https://example.com/api/assessment/${id}/deliver`, {
    method: "POST",
  });

test("deliver route returns 404 for a malformed id and never looks up a record", async () => {
  let lookupCount = 0;
  const handler = createAssessmentDeliverHandler({
    findRecord: async () => {
      lookupCount += 1;
      return null;
    },
  });
  const response = await handler(deliverRequest("not-a-uuid"), {
    params: Promise.resolve({ id: "not-a-uuid" }),
  });
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(lookupCount, 0);
});

test("deliver route returns 404 for a well-formed but unknown id", async () => {
  const handler = createAssessmentDeliverHandler({
    findRecord: async () => null,
  });
  await withEnv(
    {
      RESEND_API_KEY: "key",
      ASSESSMENT_REPORT_FROM_EMAIL: "reports@example.com",
    },
    async () => {
      const response = await handler(deliverRequest(assessmentId), {
        params: Promise.resolve({ id: assessmentId }),
      });
      assert.equal(response.status, 404);
    },
  );
});

test("deliver route returns 503 and never reports success when Resend is not configured", async () => {
  let sendAttempted = false;
  let markDeliveredCalled = false;
  const handler = createAssessmentDeliverHandler({
    findRecord: async () => {
      sendAttempted = true;
      return baseDeliveryRecord;
    },
    markDelivered: async () => {
      markDeliveredCalled = true;
    },
  });

  await withEnv(
    {
      RESEND_API_KEY: undefined,
      ASSESSMENT_REPORT_FROM_EMAIL: undefined,
    },
    async () => {
      const response = await handler(deliverRequest(assessmentId), {
        params: Promise.resolve({ id: assessmentId }),
      });
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.equal(body.ok, false);
      assert.match(body.errors.form, /not yet configured/i);
    },
  );

  assert.equal(sendAttempted, false, "record lookup should not run before the config check");
  assert.equal(markDeliveredCalled, false);
});

test("a mocked successful Resend response updates reportDeliveryStatus to sent", async () => {
  let markDeliveredId = null;
  let requestBody = null;
  const handler = createAssessmentDeliverHandler({
    findRecord: async (id) => (id === assessmentId ? { ...baseDeliveryRecord } : null),
    markDelivered: async (id) => {
      markDeliveredId = id;
    },
  });

  await withEnv(
    {
      RESEND_API_KEY: "test-key",
      ASSESSMENT_REPORT_FROM_EMAIL: "reports@example.com",
    },
    () =>
      withMockedFetch(
        async (input, init) => {
          requestBody = JSON.parse(String(init?.body));
          assert.equal(input, "https://api.resend.com/emails");
          assert.equal(init.headers.Authorization, "Bearer test-key");
          return new Response(JSON.stringify({ id: "resend-message-id" }), {
            status: 200,
          });
        },
        async () => {
          const response = await handler(deliverRequest(assessmentId), {
            params: Promise.resolve({ id: assessmentId }),
          });
          assert.equal(response.status, 200);
          const body = await response.json();
          assert.equal(body.ok, true);
        },
      ),
  );

  assert.equal(markDeliveredId, assessmentId);
  assert.deepEqual(requestBody.to, ["eddie@example.com"]);
  assert.equal(requestBody.attachments.length, 1);
  assert.equal(
    requestBody.attachments[0].filename,
    `business-independence-assessment-${assessmentId}.pdf`,
  );
  assert.equal(typeof requestBody.attachments[0].content, "string");
  assert.ok(requestBody.attachments[0].content.length > 0);
});

test("deliver route reuses the retained PDF attachment when present", async () => {
  const storedPdf = new Uint8Array([37, 80, 68, 70, 45, 114, 101, 116, 97, 105, 110, 101, 100]);
  let requestBody = null;
  const handler = createAssessmentDeliverHandler({
    findRecord: async () => ({
      ...baseDeliveryRecord,
      reportPdfKey: `assessments/${assessmentId}/report.pdf`,
      reportPdfHash: "expected-hash",
    }),
    loadStoredPdf: async () => ({ status: "found", bytes: storedPdf }),
    markDelivered: async () => {},
  });

  await withEnv(
    {
      RESEND_API_KEY: "test-key",
      ASSESSMENT_REPORT_FROM_EMAIL: "reports@example.com",
    },
    () =>
      withMockedFetch(
        async (_input, init) => {
          requestBody = JSON.parse(String(init?.body));
          return new Response(JSON.stringify({ id: "resend-message-id" }), {
            status: 200,
          });
        },
        async () => {
          const response = await handler(deliverRequest(assessmentId), {
            params: Promise.resolve({ id: assessmentId }),
          });
          assert.equal(response.status, 200);
        },
      ),
  );

  assert.equal(
    requestBody.attachments[0].content,
    Buffer.from(storedPdf).toString("base64"),
  );
});

test("report consent is required for delivery", async () => {
  let fetchCalled = false;
  const handler = createAssessmentDeliverHandler({
    findRecord: async () => ({
      ...baseDeliveryRecord,
      reportConsent: false,
      workEmail: null,
    }),
  });

  await withEnv(
    {
      RESEND_API_KEY: "test-key",
      ASSESSMENT_REPORT_FROM_EMAIL: "reports@example.com",
    },
    () =>
      withMockedFetch(
        async () => {
          fetchCalled = true;
          return new Response("{}", { status: 200 });
        },
        async () => {
          const response = await handler(deliverRequest(assessmentId), {
            params: Promise.resolve({ id: assessmentId }),
          });
          assert.equal(response.status, 404);
        },
      ),
  );
  assert.equal(fetchCalled, false);
});

test("marketing consent is not required for delivery", async () => {
  const handler = createAssessmentDeliverHandler({
    findRecord: async () => ({
      ...baseDeliveryRecord,
      reportConsent: true,
      marketingConsent: false,
    }),
    markDelivered: async () => {},
  });

  await withEnv(
    {
      RESEND_API_KEY: "test-key",
      ASSESSMENT_REPORT_FROM_EMAIL: "reports@example.com",
    },
    () =>
      withMockedFetch(
        async () => new Response(JSON.stringify({ id: "resend-message-id" }), { status: 200 }),
        async () => {
          const response = await handler(deliverRequest(assessmentId), {
            params: Promise.resolve({ id: assessmentId }),
          });
          assert.equal(response.status, 200);
          const body = await response.json();
          assert.equal(body.ok, true);
        },
      ),
  );
});

test("deliver route does not resend once a report has already been delivered", async () => {
  let fetchCalled = false;
  let markDeliveredCalled = false;
  const handler = createAssessmentDeliverHandler({
    findRecord: async () => ({
      ...baseDeliveryRecord,
      reportDeliveryStatus: "sent",
    }),
    markDelivered: async () => {
      markDeliveredCalled = true;
    },
  });

  await withEnv(
    {
      RESEND_API_KEY: "test-key",
      ASSESSMENT_REPORT_FROM_EMAIL: "reports@example.com",
    },
    () =>
      withMockedFetch(
        async () => {
          fetchCalled = true;
          return new Response(JSON.stringify({ id: "resend-message-id" }), { status: 200 });
        },
        async () => {
          const response = await handler(deliverRequest(assessmentId), {
            params: Promise.resolve({ id: assessmentId }),
          });
          assert.equal(response.status, 200);
          const body = await response.json();
          assert.equal(body.ok, true);
          assert.equal(body.status, "already_sent");
        },
      ),
  );
  assert.equal(fetchCalled, false);
  assert.equal(markDeliveredCalled, false);
});

test("deliver route leaves delivery status unchanged and keeps the record when Resend fails", async () => {
  let markDeliveredCalled = false;
  const handler = createAssessmentDeliverHandler({
    findRecord: async () => ({ ...baseDeliveryRecord }),
    markDelivered: async () => {
      markDeliveredCalled = true;
    },
  });

  await withEnv(
    {
      RESEND_API_KEY: "test-key",
      ASSESSMENT_REPORT_FROM_EMAIL: "reports@example.com",
    },
    () =>
      withMockedFetch(
        async () => new Response("service unavailable", { status: 503 }),
        async () => {
          const response = await handler(deliverRequest(assessmentId), {
            params: Promise.resolve({ id: assessmentId }),
          });
          assert.equal(response.status, 503);
          const body = await response.json();
          assert.equal(body.ok, false);
        },
      ),
  );
  assert.equal(markDeliveredCalled, false);
});

test("concurrent delivery requests produce only one external send", async () => {
  let deliveryState = "pending";
  let sendCount = 0;
  let releaseSend;
  const sendReleased = new Promise((resolve) => { releaseSend = resolve; });
  const handler = createAssessmentDeliverHandler({
    findRecord: async () => ({ ...baseDeliveryRecord, reportDeliveryStatus: deliveryState }),
    claimDelivery: async () => {
      if (deliveryState !== "pending") return { status: "busy" };
      deliveryState = "sending:claim-1";
      return { status: "claimed", token: "sending:claim-1" };
    },
    finalizeDelivery: async (_id, token, outcome) => {
      if (deliveryState === token) deliveryState = outcome === "sent" ? "sent" : "failed";
    },
  });
  await withEnv(
    { RESEND_API_KEY: "test-key", ASSESSMENT_REPORT_FROM_EMAIL: "reports@example.com" },
    () => withMockedFetch(async () => {
      sendCount += 1;
      await sendReleased;
      return new Response("{}", { status: 200 });
    }, async () => {
      const first = handler(deliverRequest(assessmentId), { params: Promise.resolve({ id: assessmentId }) });
      const second = handler(deliverRequest(assessmentId), { params: Promise.resolve({ id: assessmentId }) });
      await new Promise((resolve) => setTimeout(resolve, 0));
      releaseSend();
      const bodies = await Promise.all([first, second].map(async (response) => (await response).json()));
      assert.deepEqual(bodies.map((body) => body.status).sort(), ["already_sent", "sent"]);
    }),
  );
  assert.equal(sendCount, 1);
});

test("a delivery finalization failure cannot trigger a duplicate send", async () => {
  let claimed = false;
  let sendCount = 0;
  const handler = createAssessmentDeliverHandler({
    findRecord: async () => ({ ...baseDeliveryRecord }),
    claimDelivery: async () => {
      if (claimed) return { status: "busy" };
      claimed = true;
      return { status: "claimed", token: "sending:claim-1" };
    },
    finalizeDelivery: async () => { throw new Error("D1 unavailable"); },
  });
  await withEnv(
    { RESEND_API_KEY: "test-key", ASSESSMENT_REPORT_FROM_EMAIL: "reports@example.com" },
    () => withMockedFetch(async (_input, init) => {
      sendCount += 1;
      assert.equal(init.headers["Idempotency-Key"], `assessment-report-${assessmentId}`);
      return new Response("{}", { status: 200 });
    }, async () => {
      await handler(deliverRequest(assessmentId), { params: Promise.resolve({ id: assessmentId }) });
      await handler(deliverRequest(assessmentId), { params: Promise.resolve({ id: assessmentId }) });
    }),
  );
  assert.equal(sendCount, 1);
});

test("a confirmed failed send releases the claim for one retry", async () => {
  let state = "pending";
  let sendCount = 0;
  const handler = createAssessmentDeliverHandler({
    findRecord: async () => ({ ...baseDeliveryRecord, reportDeliveryStatus: state }),
    claimDelivery: async () => {
      if (!["pending", "failed"].includes(state)) return { status: "busy" };
      state = `sending:claim-${sendCount + 1}`;
      return { status: "claimed", token: state };
    },
    finalizeDelivery: async (_id, token, outcome) => {
      if (state === token) state = outcome;
    },
  });
  await withEnv(
    { RESEND_API_KEY: "test-key", ASSESSMENT_REPORT_FROM_EMAIL: "reports@example.com" },
    () => withMockedFetch(async () => {
      sendCount += 1;
      return new Response("{}", { status: sendCount === 1 ? 503 : 200 });
    }, async () => {
      const first = await handler(deliverRequest(assessmentId), { params: Promise.resolve({ id: assessmentId }) });
      const second = await handler(deliverRequest(assessmentId), { params: Promise.resolve({ id: assessmentId }) });
      assert.equal(first.status, 503);
      assert.equal(second.status, 200);
    }),
  );
  assert.equal(sendCount, 2);
  assert.equal(state, "sent");
});

test("provider-started delivery remains non-reclaimable after the 24-hour idempotency window", async () => {
  let now = new Date("2026-08-01T12:00:00.000Z");
  let state = "pending";
  let sendCount = 0;
  const handler = createAssessmentDeliverHandler({
    findRecord: async () => ({ ...baseDeliveryRecord, reportDeliveryStatus: state }),
    claimDelivery: async () => {
      if (state.startsWith("provider_started|")) return { status: "busy" };
      if (state.startsWith("sending|")) {
        const claimedAt = Date.parse(state.split("|")[1]);
        if (now.getTime() - claimedAt <= 10 * 60 * 1000) return { status: "busy" };
      }
      state = `sending|${now.toISOString()}|claim`;
      return { status: "claimed", token: state };
    },
    markDeliveryProviderStarted: async (_id, token) => {
      state = `provider_started|${token}`;
      return state;
    },
    finalizeDelivery: async () => { throw new Error("D1 unavailable after provider success"); },
  });
  await withEnv(
    { RESEND_API_KEY: "test-key", ASSESSMENT_REPORT_FROM_EMAIL: "reports@example.com" },
    () => withMockedFetch(async () => {
      sendCount += 1;
      return new Response("{}", { status: 200 });
    }, async () => {
      const first = await handler(deliverRequest(assessmentId), { params: Promise.resolve({ id: assessmentId }) });
      now = new Date("2026-08-02T13:00:00.000Z");
      const second = await handler(deliverRequest(assessmentId), { params: Promise.resolve({ id: assessmentId }) });
      assert.equal((await first.json()).status, "sent");
      assert.equal((await second.json()).status, "already_sent");
    }),
  );
  assert.match(state, /^provider_started\|/);
  assert.equal(sendCount, 1);
});
