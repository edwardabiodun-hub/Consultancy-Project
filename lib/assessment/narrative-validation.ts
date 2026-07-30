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

const ESTIMATE_QUALIFIER_PHRASES = [
  /estimat/i,
  /directional/i,
  /approx/i,
  /range of/i,
  /midpoint/i,
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

const extractNumbers = (text: string): number[] =>
  [...text.matchAll(/(?<![A-Za-z_])\$?\s*([0-9][\d,]*(?:\.\d+)?)(?![A-Za-z_])/g)]
    .map((match) => Number(match[1].replace(/,/g, "")));

const INVENTED_COUNT_OR_DURATION =
  /\b\d[\d,.]*\s*(?:days?|weeks?|months?|years?|managers?|employees?|people|systems?|reports?|workflows?|decisions?|stakeholders?)\b/i;

const extractSnakeCaseCodes = (text: string): string[] =>
  [...text.matchAll(/\b[a-z]+(?:_[a-z]+)+\b/g)].map((match) => match[0]);

const allowedNumbers = (result: AssessmentResult): Set<number> => {
  const candidates: Array<number | null | undefined> = [
    result.score.overall,
    result.score.components.ownerIndependence?.score,
    result.score.components.operatingSystem?.score,
    result.score.components.informationVisibility?.score,
    result.capacity.recoverableHours?.low,
    result.capacity.recoverableHours?.high,
    result.capacity.annualValue?.low,
    result.capacity.annualValue?.high,
    result.capacity.grossHours?.owner,
    result.capacity.grossHours?.reporting,
    result.capacity.grossHours?.rework,
    result.capacity.grossHours?.total,
    result.capacity.realizationFactors ? result.capacity.realizationFactors.low * 100 : undefined,
    result.capacity.realizationFactors ? result.capacity.realizationFactors.high * 100 : undefined,
  ];
  return new Set(candidates.filter((value): value is number => typeof value === "number"));
};

const mentionsCapacityFigure = (numbers: number[], result: AssessmentResult): boolean => {
  const values = new Set(
    [
      result.capacity.recoverableHours?.low,
      result.capacity.recoverableHours?.high,
      result.capacity.annualValue?.low,
      result.capacity.annualValue?.high,
    ].filter((value): value is number => typeof value === "number"),
  );
  return numbers.some((value) => values.has(value));
};

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

  const numbers = extractNumbers(text);
  if (INVENTED_COUNT_OR_DURATION.test(text)) return false;
  const allowed = allowedNumbers(result);
  if (numbers.some((value) => !allowed.has(value))) return false;

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

  if (
    result.capacity.estimateType === "directional" &&
    mentionsCapacityFigure(numbers, result) &&
    !ESTIMATE_QUALIFIER_PHRASES.some((phrase) => phrase.test(text))
  ) {
    return false;
  }

  if (!ctaIsConsistent(text, result)) return false;

  return true;
}
