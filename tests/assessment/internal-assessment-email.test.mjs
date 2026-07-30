import assert from "node:assert/strict";
import test from "node:test";
import { QUESTION_BANK } from "../../lib/assessment/questions.ts";
import { buildAssessmentResult } from "../../lib/assessment/result.ts";
import {
  buildInternalAssessmentEmail,
  sendInternalAssessmentEmail,
} from "../../lib/email/internal-assessment.ts";

const assessmentId = "123e4567-e89b-42d3-a456-426614174000";
const result = buildAssessmentResult({
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
});

const input = {
  assessmentId,
  lead: {
    name: "Avery Founder",
    email: "avery@example.com",
    company: "Example Operations",
    role: "Owner-operator",
  },
  result,
  narrative: { source: "ai", text: "Validated narrative." },
};

test("buildInternalAssessmentEmail includes the approved assessment summary and excludes unapproved fields", () => {
  const email = buildInternalAssessmentEmail(input);

  assert.equal(email.subject, "Business Independence Assessment: Example Operations");
  assert.equal(email.idempotencyKey, `assessment-narrative-${assessmentId}`);
  for (const value of [
    assessmentId,
    input.lead.name,
    input.lead.email,
    input.lead.company,
    input.lead.role,
    String(result.score.overall),
    String(result.score.components.ownerIndependence.score),
    String(result.score.components.operatingSystem.score),
    String(result.score.components.informationVisibility.score),
    result.score.category,
    result.score.confidence.level,
    result.capacity.confidence,
    result.interpretation.route,
    "AI-generated and validated",
    input.narrative.text,
  ]) {
    assert.ok(email.html.includes(value), `HTML should include ${value}`);
  }
  assert.match(email.html, /deterministic/i);
  assert.match(email.html, /self-reported/i);
  assert.match(email.html, /not an audit/i);
  assert.doesNotMatch(email.html, /SENTINEL-PHONE-843-555-0100/);
  assert.doesNotMatch(email.html, /SENTINEL-RAW-ANSWER/);
  assert.doesNotMatch(email.html, /SENTINEL-FREE-TEXT/);
});

test("sendInternalAssessmentEmail posts to Resend with a stable idempotency key", async () => {
  let request;
  const accepted = await sendInternalAssessmentEmail(input, {
    apiKey: "test-key",
    from: "assessments@runrategroup.com",
    to: "info@runrategroup.com",
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response("{}", { status: 202 });
    },
  });

  assert.deepEqual(accepted, { accepted: true });
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.init.headers["Idempotency-Key"], `assessment-narrative-${assessmentId}`);
  assert.deepEqual(JSON.parse(request.init.body).to, ["info@runrategroup.com"]);
});

test("sendInternalAssessmentEmail declines missing configuration and Resend failures", async () => {
  assert.deepEqual(
    await sendInternalAssessmentEmail(input, { apiKey: undefined, from: "from@example.com" }),
    { accepted: false, retryable: true },
  );
  assert.deepEqual(
    await sendInternalAssessmentEmail(input, {
      apiKey: "test-key",
      from: "from@example.com",
      to: "info@runrategroup.com",
      fetchImpl: async () => new Response("service unavailable", { status: 503 }),
    }),
    { accepted: false, retryable: true },
  );
});

test("sendInternalAssessmentEmail aborts a stalled Resend request within the configured timeout", async () => {
  let observedSignal;
  const outcome = await sendInternalAssessmentEmail(input, {
    apiKey: "test-key",
    from: "from@example.com",
    to: "info@runrategroup.com",
    timeoutMs: 5,
    fetchImpl: async (_url, init) => {
      observedSignal = init.signal;
      return await new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(init.signal.reason));
      });
    },
  });

  assert.equal(observedSignal.aborted, true);
  assert.deepEqual(outcome, { accepted: false, retryable: false });
});
