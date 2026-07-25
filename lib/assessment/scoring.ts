import { COMPONENT_WEIGHTS, QUESTION_BANK } from "./questions";
import type { AssessmentAnswers, ComponentId, ScoredValue } from "./types";

export type ConfidenceLevel = "high" | "medium" | "low" | "incomplete";
export type ScoreResult = {
  overall: number | null;
  category: "strong" | "emerging" | "developing" | "highDependency" | "incomplete";
  components: Record<ComponentId, { score: number | null; coverage: number; unknownCount: number }>;
  confidence: { level: ConfidenceLevel; coverage: number; reasons: string[] };
  riskCodes: string[];
};

const round = (value: number) => Math.round(value);
const categoryFor = (score: number | null): ScoreResult["category"] =>
  score === null ? "incomplete" : score >= 80 ? "strong" : score >= 65 ? "emerging" : score >= 45 ? "developing" : "highDependency";

export function scoreAssessment(answers: AssessmentAnswers): ScoreResult {
  const applicable = QUESTION_BANK.filter((q) => q.required || q.appliesWhen?.(answers));
  const components = {} as ScoreResult["components"];
  let answeredApplicable = 0;
  let unknownTotal = 0;
  const riskCodes: string[] = [];

  for (const component of Object.keys(COMPONENT_WEIGHTS) as ComponentId[]) {
    const questions = applicable.filter((q) => q.component === component);
    const conditional = questions.filter((q) => !q.required);
    const conditionalShare = conditional.reduce((sum, q) => sum + q.weight, 0);
    const baseScale = 1 - conditionalShare;
    let numerator = 0;
    let denominator = 0;
    let known = 0;
    let unknownCount = 0;

    for (const question of questions) {
      const answer = answers.scored[question.id];
      const adjustedWeight = question.required ? question.weight * baseScale : question.weight;
      if (answer === "unknown" || answer === undefined) {
        unknownCount += 1;
        continue;
      }
      if (answer === "notApplicable") continue;
      numerator += (answer as ScoredValue) * adjustedWeight;
      denominator += adjustedWeight;
      known += 1;
    }
    answeredApplicable += known;
    unknownTotal += unknownCount;
    components[component] = {
      score: denominator ? round(numerator / denominator) : null,
      coverage: questions.length ? known / questions.length : 0,
      unknownCount,
    };
  }

  const coverage = applicable.length ? answeredApplicable / applicable.length : 0;
  const componentCoverage = Object.values(components).map((item) => item.coverage);
  const overall = coverage < .60 || Object.values(components).some((item) => item.score === null)
    ? null
    : round(Object.entries(COMPONENT_WEIGHTS).reduce(
        (sum, [key, weight]) => sum + (components[key as ComponentId].score ?? 0) * weight,
        0,
      ));
  const level: ConfidenceLevel =
    coverage < .60 ? "incomplete"
    : coverage >= .90 && componentCoverage.every((value) => value >= .80) && unknownTotal <= 1 ? "high"
    : coverage >= .75 && componentCoverage.every((value) => value >= .65) && unknownTotal <= 3 ? "medium"
    : "low";

  if (unknownTotal) riskCodes.push("measurement_gap");
  return {
    overall,
    category: categoryFor(overall),
    components,
    confidence: {
      level,
      coverage,
      reasons: unknownTotal ? [`${unknownTotal} Unknown response${unknownTotal === 1 ? "" : "s"} reduced confidence.`] : [],
    },
    riskCodes,
  };
}
