import { COMPONENT_WEIGHTS, QUESTION_BANK } from "./questions";
import type { AssessmentAnswers, ComponentId, ScoredValue } from "./types";

export type ConfidenceLevel = "high" | "medium" | "low" | "incomplete";
export type ScoreCategory = "strong" | "emerging" | "developing" | "highDependency" | "incomplete";
type ComponentScore = {
  score: number | null;
  coverage: number;
  unknownCount: number;
  category: ScoreCategory;
};
export type ScoreResult = {
  overall: number | null;
  category: ScoreCategory;
  components: Record<ComponentId, ComponentScore>;
  confidence: { level: ConfidenceLevel; coverage: number; reasons: string[] };
  riskCodes: string[];
};

const round = (value: number) => Math.round(value);
const meetsCoverage = (value: number, threshold: number) => value + 1e-12 >= threshold;
const categoryFor = (score: number | null): ScoreCategory =>
  score === null ? "incomplete" : score >= 80 ? "strong" : score >= 65 ? "emerging" : score >= 45 ? "developing" : "highDependency";
const componentCategoryFor = (score: number | null, unknownCount: number): ScoreCategory => {
  const category = categoryFor(score);
  return unknownCount >= 2 && (category === "strong" || category === "emerging")
    ? "developing"
    : category;
};

export function scoreAssessment(answers: AssessmentAnswers): ScoreResult {
  const applicable = QUESTION_BANK.filter((q) => q.required || q.appliesWhen?.(answers));
  const components = {} as ScoreResult["components"];
  let answeredWeightTotal = 0;
  let applicableWeightTotal = 0;
  let unknownTotal = 0;
  const riskCodes: string[] = [];

  for (const component of Object.keys(COMPONENT_WEIGHTS) as ComponentId[]) {
    const questions = applicable.filter((q) => q.component === component);
    const conditional = questions.filter((q) => !q.required);
    const conditionalShare = conditional.reduce((sum, q) => sum + q.weight, 0);
    const baseScale = 1 - conditionalShare;
    let numerator = 0;
    let denominator = 0;
    let answeredWeight = 0;
    let applicableWeight = 0;
    let unknownCount = 0;

    for (const question of questions) {
      const answer = answers.scored[question.id];
      const adjustedWeight = question.required ? question.weight * baseScale : question.weight;
      applicableWeight += adjustedWeight;
      if (answer === "unknown" || answer === undefined) {
        unknownCount += 1;
        continue;
      }
      if (answer === "notApplicable") continue;
      numerator += (answer as ScoredValue) * adjustedWeight;
      denominator += adjustedWeight;
      answeredWeight += adjustedWeight;
    }
    answeredWeightTotal += answeredWeight * COMPONENT_WEIGHTS[component];
    applicableWeightTotal += applicableWeight * COMPONENT_WEIGHTS[component];
    unknownTotal += unknownCount;
    const score = denominator ? round(numerator / denominator) : null;
    components[component] = {
      score,
      coverage: applicableWeight ? answeredWeight / applicableWeight : 0,
      unknownCount,
      category: componentCategoryFor(score, unknownCount),
    };
  }

  const coverage = applicableWeightTotal ? answeredWeightTotal / applicableWeightTotal : 0;
  const componentCoverage = Object.values(components).map((item) => item.coverage);
  const overall = !meetsCoverage(coverage, .60) || Object.values(components).some((item) => item.score === null)
    ? null
    : round(Object.entries(COMPONENT_WEIGHTS).reduce(
        (sum, [key, weight]) => sum + (components[key as ComponentId].score ?? 0) * weight,
        0,
      ));
  const level: ConfidenceLevel =
    !meetsCoverage(coverage, .60) ? "incomplete"
    : meetsCoverage(coverage, .90) && componentCoverage.every((value) => meetsCoverage(value, .80)) && unknownTotal <= 1 ? "high"
    : meetsCoverage(coverage, .75) && componentCoverage.every((value) => meetsCoverage(value, .65)) && unknownTotal <= 3 ? "medium"
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
