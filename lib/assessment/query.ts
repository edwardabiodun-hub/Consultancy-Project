import type { assessmentRecords } from "../../db/schema";

type AssessmentRecordsTable = typeof assessmentRecords;

/**
 * Base column select shared by every route that reconstructs a PDF report
 * from the compact assessment record. `GET /api/assessment/[id]/report` and
 * `POST /api/assessment/[id]/deliver` both feed these columns into
 * `buildAssessmentPdf`; keeping the list here means a schema/PDF field
 * addition only needs one edit; both routes pick it up automatically
 * instead of silently drifting out of sync.
 *
 * Callers pass their own (dynamically imported) `assessmentRecords` table
 * reference so this module stays type-only at the `db/schema` boundary and
 * does not force either route into a static, edge-incompatible import.
 */
export const assessmentReportColumns = (table: AssessmentRecordsTable) => ({
  id: table.id,
  assessmentVersion: table.assessmentVersion,
  createdAt: table.createdAt,
  name: table.name,
  company: table.company,
  overallScore: table.overallScore,
  ownerIndependenceScore: table.ownerIndependenceScore,
  operatingSystemScore: table.operatingSystemScore,
  informationVisibilityScore: table.informationVisibilityScore,
  scoreCoverage: table.scoreCoverage,
  scoreConfidence: table.scoreConfidence,
  impactConfidence: table.impactConfidence,
  estimateType: table.estimateType,
  capacityInputSource: table.capacityInputSource,
  ownerGrossHours: table.ownerGrossHours,
  reportingGrossHours: table.reportingGrossHours,
  reworkGrossHours: table.reworkGrossHours,
  grossCapacityValue: table.grossCapacityValue,
  realizationFactorLow: table.realizationFactorLow,
  realizationFactorHigh: table.realizationFactorHigh,
  recoverableHoursLow: table.recoverableHoursLow,
  recoverableHoursHigh: table.recoverableHoursHigh,
  annualValueLow: table.annualValueLow,
  annualValueHigh: table.annualValueHigh,
  findingsJson: table.findingsJson,
  capacityAssumptionCodesJson: table.capacityAssumptionCodesJson,
  capacityExclusionCodesJson: table.capacityExclusionCodesJson,
  priorityIdsJson: table.priorityIdsJson,
  leadRoute: table.leadRoute,
  narrativeSource: table.narrativeSource,
  reportPdfKey: table.reportPdfKey,
  reportPdfHash: table.reportPdfHash,
});
