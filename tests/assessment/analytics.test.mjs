import assert from "node:assert/strict";
import test from "node:test";
import {
  ASSESSMENT_EVENTS,
  parseAssessmentEventPayload,
} from "../../lib/analytics/assessment.ts";
import { createAssessmentEventHandler } from "../../app/api/assessment/events/route.ts";

// ---------------------------------------------------------------------------
// ASSESSMENT_EVENTS allowlist
// ---------------------------------------------------------------------------

test("ASSESSMENT_EVENTS exposes exactly the ten allowlisted event names", () => {
  assert.deepEqual(ASSESSMENT_EVENTS, [
    "assessment_started",
    "section_completed",
    "preliminary_result_reached",
    "contact_gate_completed",
    "precision_completed",
    "precision_skipped",
    "full_result_viewed",
    "pdf_downloaded",
    "cta_shown",
    "inquiry_submitted",
  ]);
});

// ---------------------------------------------------------------------------
// parseAssessmentEventPayload
// ---------------------------------------------------------------------------

test("parseAssessmentEventPayload accepts a minimal valid event", () => {
  const result = parseAssessmentEventPayload({ eventName: "assessment_started" });
  assert.equal(result.ok, true);
  assert.equal(result.event.eventName, "assessment_started");
});

test("parseAssessmentEventPayload accepts all optional context fields when present", () => {
  const payload = {
    eventName: "full_result_viewed",
    assessmentId: "8d7b76ca-86bf-46a6-88f4-42b6dfecd159",
    screen: "full",
    resultCategory: "developing",
    scoreConfidence: "high",
    impactConfidence: "medium",
    route: "diagnostic",
  };
  const result = parseAssessmentEventPayload(payload);
  assert.equal(result.ok, true);
  assert.deepEqual(result.event, payload);
});

test("parseAssessmentEventPayload rejects a non-object payload", () => {
  const result = parseAssessmentEventPayload("assessment_started");
  assert.equal(result.ok, false);
});

test("parseAssessmentEventPayload rejects null", () => {
  const result = parseAssessmentEventPayload(null);
  assert.equal(result.ok, false);
});

test("parseAssessmentEventPayload rejects an unknown event name", () => {
  const result = parseAssessmentEventPayload({ eventName: "assessment_abandoned" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.eventName);
});

test("parseAssessmentEventPayload rejects a missing event name", () => {
  const result = parseAssessmentEventPayload({ screen: "context" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.eventName);
});

for (const key of ["answers", "email", "name", "phone"]) {
  test(`parseAssessmentEventPayload rejects the unknown payload key "${key}"`, () => {
    const result = parseAssessmentEventPayload({
      eventName: "assessment_started",
      [key]: key === "answers" ? { employeeBand: "1-4" } : "unexpected value",
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors[key]);
  });
}

test("parseAssessmentEventPayload rejects free text passed as an unrecognized field", () => {
  const result = parseAssessmentEventPayload({
    eventName: "assessment_started",
    notes: "The owner mentioned they want to sell the business next year.",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.notes);
});

test("parseAssessmentEventPayload rejects an ip address or user agent field", () => {
  const ipResult = parseAssessmentEventPayload({
    eventName: "assessment_started",
    ipAddress: "203.0.113.5",
  });
  const uaResult = parseAssessmentEventPayload({
    eventName: "assessment_started",
    userAgent: "Mozilla/5.0",
  });
  assert.equal(ipResult.ok, false);
  assert.equal(uaResult.ok, false);
});

test("parseAssessmentEventPayload rejects a non-string optional field", () => {
  const result = parseAssessmentEventPayload({
    eventName: "assessment_started",
    screen: 12345,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.screen);
});

// ---------------------------------------------------------------------------
// Closed value sets for screen / resultCategory / scoreConfidence /
// impactConfidence / route - each field is checked against its own specific
// finite union, not any of the five sets generically.
// ---------------------------------------------------------------------------

const ENUM_FIELD_CASES = {
  screen: {
    valid: [
      "landing",
      "context",
      "ownerIndependence",
      "operatingSystem",
      "informationVisibility",
      "preliminary",
      "contact",
      "precision",
      "processing",
      "full",
    ],
    invalid: "strong",
  },
  resultCategory: {
    valid: ["strong", "emerging", "developing", "highDependency", "incomplete"],
    invalid: "full",
  },
  scoreConfidence: {
    valid: ["high", "medium", "low", "incomplete"],
    invalid: "diagnostic",
  },
  impactConfidence: {
    valid: ["high", "medium", "low"],
    invalid: "incomplete",
  },
  route: {
    valid: ["diagnostic", "nurture", "insights", "restricted"],
    invalid: "high",
  },
};

for (const [field, { valid, invalid }] of Object.entries(ENUM_FIELD_CASES)) {
  for (const value of valid) {
    test(`parseAssessmentEventPayload accepts "${value}" for ${field}`, () => {
      const result = parseAssessmentEventPayload({
        eventName: "assessment_started",
        [field]: value,
      });
      assert.equal(result.ok, true);
      assert.equal(result.event[field], value);
    });
  }

  test(`parseAssessmentEventPayload rejects an out-of-set value for ${field}`, () => {
    const result = parseAssessmentEventPayload({
      eventName: "assessment_started",
      [field]: invalid,
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.errors[field],
      `expected a field-specific error on errors.${field}, got: ${JSON.stringify(result.errors)}`,
    );
  });
}

// ---------------------------------------------------------------------------
// POST /api/assessment/events
// ---------------------------------------------------------------------------

const eventRequest = (body) =>
  new Request("https://example.com/api/assessment/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

test("events route rejects an unknown event name with 422 and never persists", async () => {
  let persistCalled = false;
  const handler = createAssessmentEventHandler({
    persistEvent: async () => {
      persistCalled = true;
    },
  });
  const response = await handler(eventRequest({ eventName: "not_a_real_event" }));
  assert.equal(response.status, 422);
  assert.equal(persistCalled, false);
});

test("events route rejects unknown payload keys (answers, email, name, phone) with 422 and never persists", async () => {
  let persistCalled = false;
  const handler = createAssessmentEventHandler({
    persistEvent: async () => {
      persistCalled = true;
    },
  });
  const response = await handler(
    eventRequest({
      eventName: "assessment_started",
      answers: { employeeBand: "1-4" },
      email: "person@example.com",
      name: "Person",
      phone: "555-0100",
    }),
  );
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.ok(body.errors.answers);
  assert.ok(body.errors.email);
  assert.ok(body.errors.name);
  assert.ok(body.errors.phone);
  assert.equal(persistCalled, false);
});

test("events route persists an allowlisted event with a generated id and only the allowed columns", async () => {
  let persistedRecord = null;
  const handler = createAssessmentEventHandler({
    createId: () => "11111111-1111-4111-8111-111111111111",
    persistEvent: async (record) => {
      persistedRecord = record;
    },
  });
  const response = await handler(
    eventRequest({
      eventName: "full_result_viewed",
      assessmentId: "8d7b76ca-86bf-46a6-88f4-42b6dfecd159",
      screen: "full",
      resultCategory: "developing",
      scoreConfidence: "high",
      impactConfidence: "medium",
      route: "diagnostic",
    }),
  );
  assert.equal(response.status, 202);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.persistenceAvailable, true);
  assert.deepEqual(persistedRecord, {
    id: "11111111-1111-4111-8111-111111111111",
    eventName: "full_result_viewed",
    assessmentId: "8d7b76ca-86bf-46a6-88f4-42b6dfecd159",
    screen: "full",
    resultCategory: "developing",
    scoreConfidence: "high",
    impactConfidence: "medium",
    route: "diagnostic",
  });
});

test("events route stores null for optional context fields that are omitted", async () => {
  let persistedRecord = null;
  const handler = createAssessmentEventHandler({
    createId: () => "22222222-2222-4222-8222-222222222222",
    persistEvent: async (record) => {
      persistedRecord = record;
    },
  });
  await handler(eventRequest({ eventName: "assessment_started" }));
  assert.deepEqual(persistedRecord, {
    id: "22222222-2222-4222-8222-222222222222",
    eventName: "assessment_started",
    assessmentId: null,
    screen: null,
    resultCategory: null,
    scoreConfidence: null,
    impactConfidence: null,
    route: null,
  });
});

test("events route never persists an ip address, user agent, answers, or contact fields even under other keys", async () => {
  let persistedRecord = null;
  const handler = createAssessmentEventHandler({
    persistEvent: async (record) => {
      persistedRecord = record;
    },
  });
  await handler(eventRequest({ eventName: "assessment_started" }));
  assert.ok(persistedRecord);
  const keys = Object.keys(persistedRecord);
  for (const forbidden of [
    "ipAddress",
    "userAgent",
    "answers",
    "email",
    "workEmail",
    "name",
    "phone",
  ]) {
    assert.equal(keys.includes(forbidden), false, `must not persist ${forbidden}`);
  }
});

test("events route reports persistenceAvailable=false without failing the request when storage throws", async () => {
  const handler = createAssessmentEventHandler({
    persistEvent: async () => {
      throw new Error("D1 unavailable");
    },
  });
  const response = await handler(eventRequest({ eventName: "assessment_started" }));
  assert.equal(response.status, 202);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.persistenceAvailable, false);
});

test("events route rejects a malformed JSON body", async () => {
  const handler = createAssessmentEventHandler({ persistEvent: async () => {} });
  const request = new Request("https://example.com/api/assessment/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not valid json",
  });
  const response = await handler(request);
  assert.equal(response.status, 422);
});
