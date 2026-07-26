// Privacy-conscious product analytics for the Business Independence Assessment
// funnel. This module defines the closed allowlist of event names the
// assessment is permitted to emit and validates inbound event payloads before
// they are ever persisted. It intentionally has no notion of raw answers,
// contact details, IP address, or user agent - those are not accepted fields,
// so there is no code path that can forward them into storage.

export const ASSESSMENT_EVENTS = [
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
] as const;

export type AssessmentEventName = (typeof ASSESSMENT_EVENTS)[number];

const ASSESSMENT_EVENT_NAME_SET = new Set<string>(ASSESSMENT_EVENTS);

export const isAssessmentEventName = (
  value: unknown,
): value is AssessmentEventName =>
  typeof value === "string" && ASSESSMENT_EVENT_NAME_SET.has(value);

// Optional context fields describing where in the funnel the event occurred
// and the deterministic result state at that point - never the underlying
// answers themselves. All are short, self-reported-free classification
// strings (e.g. a screen name or a result category), not free text.
const OPTIONAL_EVENT_FIELDS = [
  "assessmentId",
  "screen",
  "resultCategory",
  "scoreConfidence",
  "impactConfidence",
  "route",
] as const;

type OptionalEventField = (typeof OPTIONAL_EVENT_FIELDS)[number];

export type AssessmentEventInput = {
  eventName: AssessmentEventName;
} & Partial<Record<OptionalEventField, string>>;

const ALLOWED_EVENT_FIELDS = new Set<string>([
  "eventName",
  ...OPTIONAL_EVENT_FIELDS,
]);

type ValidationFailure = { ok: false; errors: Record<string, string> };
type ValidationSuccess = { ok: true; event: AssessmentEventInput };
export type AssessmentEventParseResult = ValidationFailure | ValidationSuccess;

const isPlainObject = (
  value: unknown,
): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const MAX_FIELD_LENGTH = 200;

export function parseAssessmentEventPayload(
  input: unknown,
): AssessmentEventParseResult {
  const errors: Record<string, string> = {};

  if (!isPlainObject(input)) {
    errors.form = "Enter a valid JSON event payload.";
    return { ok: false, errors };
  }

  for (const key of Object.keys(input)) {
    if (!ALLOWED_EVENT_FIELDS.has(key)) {
      errors[key] = "This field is not accepted.";
    }
  }

  if (!isAssessmentEventName(input.eventName)) {
    errors.eventName = "This event name is not recognized.";
  }

  const event: Partial<AssessmentEventInput> = {};
  for (const field of OPTIONAL_EVENT_FIELDS) {
    const value = input[field];
    if (value === undefined || value === null) continue;
    if (
      typeof value !== "string" ||
      value.length === 0 ||
      value.length > MAX_FIELD_LENGTH
    ) {
      errors[field] = `Enter a valid value from 1 to ${MAX_FIELD_LENGTH} characters.`;
      continue;
    }
    event[field] = value;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    event: { ...event, eventName: input.eventName as AssessmentEventName },
  };
}
