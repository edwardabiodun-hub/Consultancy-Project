import type { AssessmentResult } from "./result";
import type { AssessmentLead } from "./validation";

type AssessmentRecordInput = {
  id: string;
  lead?: AssessmentLead;
  result: AssessmentResult;
};

const componentScore = (
  result: AssessmentResult,
  component:
    | "ownerIndependence"
    | "operatingSystem"
    | "informationVisibility",
) => result.score.components[component]?.score ?? null;

export function toAssessmentRecord({
  id,
  lead,
  result,
}: AssessmentRecordInput) {
  return {
    id,
    assessmentVersion: result.methodologyVersion,
    name: lead?.name ?? null,
    workEmail: lead?.workEmail ?? null,
    company: lead?.company ?? null,
    phone: lead?.phone ?? null,
    reportConsent: lead?.reportConsent ?? false,
    marketingConsent: lead?.marketingConsent ?? false,
    overallScore: result.score.overall,
    ownerIndependenceScore: componentScore(result, "ownerIndependence"),
    operatingSystemScore: componentScore(result, "operatingSystem"),
    informationVisibilityScore: componentScore(
      result,
      "informationVisibility",
    ),
    scoreCoverage: result.score.confidence.coverage,
    scoreConfidence: result.score.confidence.level,
    impactConfidence: result.capacity.confidence,
    estimateType: result.capacity.estimateType,
    recoverableHoursLow: result.capacity.recoverableHours?.low ?? null,
    recoverableHoursHigh: result.capacity.recoverableHours?.high ?? null,
    annualValueLow: result.capacity.annualValue?.low ?? null,
    annualValueHigh: result.capacity.annualValue?.high ?? null,
    riskCodesJson: JSON.stringify(
      result.interpretation.riskCodes.slice(0, 3),
    ),
    priorityIdsJson: JSON.stringify(
      result.interpretation.priorities
        .slice(0, 3)
        .map((priority) => priority.component),
    ),
    leadRoute: result.interpretation.route,
    narrativeSource: result.narrative.source,
    reportDeliveryStatus: lead?.reportConsent
      ? ("pending" as const)
      : ("not_requested" as const),
  };
}
