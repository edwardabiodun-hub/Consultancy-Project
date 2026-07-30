import { CTA_BY_ROUTE, type AssessmentResult } from "./result";
import { PRIORITY_LIBRARY } from "./interpretation";
import type { ComponentId } from "./types";

/**
 * The strict output contract an AI narrative draft must satisfy before it is
 * ever shown to a visitor. Every field is plain text (or a small array of
 * plain text pairs) so it can be scanned deterministically for invented
 * numbers, invented components, benchmark claims, and guarantee language.
 */
export type NarrativeDraft = {
  summary: string;
  componentObservations: Array<{ component: string; observation: string }>;
  priorityId: string;
  priorityExplanation: string;
  limitations: string;
};

const KNOWN_COMPONENTS: ReadonlySet<ComponentId> = new Set([
  "ownerIndependence",
  "operatingSystem",
  "informationVisibility",
]);

const BENCHMARK_PHRASES = [
  /industry average/i,
  /top quartile/i,
  /companies like yours/i,
];

const GUARANTEE_PHRASES = [
  /guarantee/i,
  /guaranteed/i,
  /\bpromise/i,
  /assur(e|ed|ance)/i,
  /risk-free/i,
  /no risk/i,
  /100%\s*(certain|sure)/i,
  /\bwill (definitely|certainly)\b/i,
];

const OUTCOME_PROMISE_PHRASES = [
  /\bwill (save|increase|boost|grow|generate|realize)\b/i,
  /(guaranteed|assured)\s+(savings|revenue|valuation|results)/i,
  /increase(s)?\s+your\s+valuation/i,
  /\bprovable roi\b/i,
];

/**
 * Structural type guard for an unknown parsed-JSON value. This is the first
 * gate applied to whatever the model returns: it must match the
 * `NarrativeDraft` shape exactly before any policy validation runs.
 */
export function isNarrativeDraftShape(value: unknown): value is NarrativeDraft {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.summary !== "string" || candidate.summary.trim().length === 0) {
    return false;
  }
  if (typeof candidate.priorityId !== "string" || candidate.priorityId.trim().length === 0) return false;
  if (typeof candidate.priorityExplanation !== "string" || candidate.priorityExplanation.trim().length === 0) {
    return false;
  }
  if (typeof candidate.limitations !== "string" || candidate.limitations.trim().length === 0) {
    return false;
  }
  if (!Array.isArray(candidate.componentObservations)) return false;
  return candidate.componentObservations.every(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      typeof (entry as Record<string, unknown>).component === "string" &&
      typeof (entry as Record<string, unknown>).observation === "string" &&
      (entry as Record<string, unknown>).observation !== "",
  );
}

const draftText = (draft: NarrativeDraft): string =>
  [
    draft.summary,
    ...draft.componentObservations.map((entry) => entry.observation),
    draft.priorityExplanation,
    draft.limitations,
  ].join("\n");

const uncontrolledDraftText = (draft: NarrativeDraft): string =>
  [
    draft.summary,
    ...draft.componentObservations.map((entry) => entry.observation),
    draft.limitations,
  ].join("\n");

const NUMERIC_PROSE = /[0-9$\u20ac\u00a3\u00a5%]/u;
const NUMBER_WORDS =
  /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|first|second|third|dozen)\b/i;
const DIRECTIVE_LANGUAGE = [
  /\b(?:should|must|ought to|need(?:s)? to|recommend(?:s|ed|ing|ation)?|advise(?:s|d|ing)?|consider)\b/i,
  /(?:^|[.!?]\s+)(?:(?:please|immediately|now)\s+)*(?:hire|buy|purchase|implement|adopt|deploy|replace|automate|contact|schedule|book|engage|appoint|install|invest)\b/i,
];

const extractSnakeCaseCodes = (text: string): string[] =>
  [...text.matchAll(/\b[a-z]+(?:_[a-z]+)+\b/g)].map((match) => match[0]);

const normalizeControlledText = (value: string): string =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

const priorityExplanationWithinLibrary = (
  draft: NarrativeDraft,
  result: AssessmentResult,
): boolean => {
  const priority = result.interpretation.priorities.find(
    (candidate) => candidate.component === draft.priorityId,
  );
  if (!priority) return false;
  const controlled = PRIORITY_LIBRARY[priority.component];
  const expected = `${controlled.title}: ${controlled.action} Indicator: ${controlled.indicator}.`;
  return normalizeControlledText(draft.priorityExplanation) === normalizeControlledText(expected);
};

const otherRouteCtaLabels = (result: AssessmentResult): string[] =>
  Object.values(CTA_BY_ROUTE)
    .filter((cta) => cta.label !== result.cta.label)
    .map((cta) => cta.label);

const RESTRICTED_COMMERCIAL_PHRASES = [
  /schedule a (call|consult(ation)?|diagnostic)/i,
  /book a (call|consult(ation)?|diagnostic)/i,
  /contact us to (buy|purchase|engage|hire)/i,
  /engage (our|a) consultant/i,
  /sign up for (a|the) diagnostic/i,
  /diagnostic engagement/i,
];

const ctaIsConsistent = (text: string, result: AssessmentResult): boolean => {
  const otherLabels = otherRouteCtaLabels(result);
  if (otherLabels.some((label) => text.toLowerCase().includes(label.toLowerCase()))) {
    return false;
  }
  if (
    result.interpretation.route === "restricted" &&
    RESTRICTED_COMMERCIAL_PHRASES.some((phrase) => phrase.test(text))
  ) {
    return false;
  }
  return true;
};

/**
 * Deterministic policy validation for a structurally-valid narrative draft.
 * Every check here is a hard reject: any single failure means the draft is
 * discarded in favor of the complete rules-based narrative. Nothing here
 * calls the model or performs I/O; it only compares draft text against the
 * already-computed `AssessmentResult`.
 */
export function validateNarrative(draft: NarrativeDraft, result: AssessmentResult): boolean {
  if (
    !draft.componentObservations.every((entry) =>
      KNOWN_COMPONENTS.has(entry.component as ComponentId),
    )
  ) {
    return false;
  }

  const text = draftText(draft);
  const uncontrolledText = uncontrolledDraftText(draft);
  if (NUMERIC_PROSE.test(uncontrolledText) || NUMBER_WORDS.test(uncontrolledText)) return false;
  if (DIRECTIVE_LANGUAGE.some((phrase) => phrase.test(uncontrolledText))) return false;

  // The only risk codes this draft may reference are the ones actually sent
  // to the model for this specific result (`buildNarrativeModelInput` puts
  // `result.risks.map(risk => risk.code)` on the wire). A fixed global list
  // would either reject legitimate codes the model was given (most scored
  // components resolve to a watchpoint/strength code, not one of a small
  // static set) or allow codes from a different result than the one being
  // validated - so the allow-list is built fresh from `result.risks` per call.
  const providedRiskCodes = new Set(result.risks.map((risk) => risk.code));
  const codes = extractSnakeCaseCodes(text);
  if (codes.some((code) => !providedRiskCodes.has(code))) return false;

  if (BENCHMARK_PHRASES.some((phrase) => phrase.test(text))) return false;
  if (GUARANTEE_PHRASES.some((phrase) => phrase.test(text))) return false;
  if (OUTCOME_PROMISE_PHRASES.some((phrase) => phrase.test(text))) return false;

  if (!/self-reported/i.test(draft.limitations)) return false;
  if (!/not an audit/i.test(draft.limitations)) return false;

  if (!priorityExplanationWithinLibrary(draft, result)) return false;

  if (!ctaIsConsistent(text, result)) return false;

  return true;
}
