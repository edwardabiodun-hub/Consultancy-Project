import type { AssessmentResult } from "./result";
import type { AssessmentLead } from "./validation";

type AssessmentRecordInput = {
  id: string;
  lead?: AssessmentLead;
  result: AssessmentResult;
  role?: string;
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
  role,
}: AssessmentRecordInput) {
  return {
    id,
    assessmentVersion: result.methodologyVersion,
    name: lead?.name ?? null,
    workEmail: lead?.workEmail ?? null,
    company: lead?.company ?? null,
    role: role ?? null,
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
    capacityInputSource: result.capacity.inputSource,
    ownerGrossHours: result.capacity.grossHours?.owner ?? 0,
    reportingGrossHours: result.capacity.grossHours?.reporting ?? 0,
    reworkGrossHours: result.capacity.grossHours?.rework ?? 0,
    grossCapacityValue: result.capacity.grossCapacityValue,
    realizationFactorLow: result.capacity.realizationFactors?.low ?? null,
    realizationFactorHigh: result.capacity.realizationFactors?.high ?? null,
    recoverableHoursLow: result.capacity.recoverableHours?.low ?? null,
    recoverableHoursHigh: result.capacity.recoverableHours?.high ?? null,
    annualValueLow: result.capacity.annualValue?.low ?? null,
    annualValueHigh: result.capacity.annualValue?.high ?? null,
    findingsJson: JSON.stringify(
      (result.risks ?? []).slice(0, 3).map((finding) => ({
        code: finding.code,
        kind: finding.kind,
        component: finding.component,
      })),
    ),
    capacityAssumptionCodesJson: JSON.stringify(
      result.capacity.assumptionCodes ?? [],
    ),
    capacityExclusionCodesJson: JSON.stringify(
      result.capacity.exclusionCodes ?? [],
    ),
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
    narrativeAttemptStatus: "pending" as const,
    narrativeAttemptedAt: null,
    reportDeliveryStatus: lead?.reportConsent
      ? ("pending" as const)
      : ("not_requested" as const),
    internalNotificationStatus: "pending" as const,
    internalNotificationClaimedAt: null,
    internalNotificationFirstAttemptAt: null,
    internalNotificationSentAt: null,
    internalNotificationPayloadHash: null,
  };
}
