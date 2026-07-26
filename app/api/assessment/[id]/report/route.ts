import { eq } from "drizzle-orm";
import {
  buildAssessmentPdf,
  type AssessmentReportRecord,
} from "../../../../../lib/report/pdf";

type RouteContext = { params: Promise<{ id: string }> };
type HandlerDependencies = {
  findRecord: (id: string) => Promise<AssessmentReportRecord | null>;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PRIVATE_HEADERS = {
  "cache-control": "private, no-store",
};

const findAssessmentRecord = async (
  id: string,
): Promise<AssessmentReportRecord | null> => {
  const [{ getDb }, { assessmentRecords }] = await Promise.all([
    import("../../../../../db"),
    import("../../../../../db/schema"),
  ]);
  const [record] = await getDb()
    .select({
      id: assessmentRecords.id,
      assessmentVersion: assessmentRecords.assessmentVersion,
      createdAt: assessmentRecords.createdAt,
      name: assessmentRecords.name,
      company: assessmentRecords.company,
      overallScore: assessmentRecords.overallScore,
      ownerIndependenceScore: assessmentRecords.ownerIndependenceScore,
      operatingSystemScore: assessmentRecords.operatingSystemScore,
      informationVisibilityScore: assessmentRecords.informationVisibilityScore,
      scoreCoverage: assessmentRecords.scoreCoverage,
      scoreConfidence: assessmentRecords.scoreConfidence,
      impactConfidence: assessmentRecords.impactConfidence,
      estimateType: assessmentRecords.estimateType,
      capacityInputSource: assessmentRecords.capacityInputSource,
      ownerGrossHours: assessmentRecords.ownerGrossHours,
      reportingGrossHours: assessmentRecords.reportingGrossHours,
      reworkGrossHours: assessmentRecords.reworkGrossHours,
      grossCapacityValue: assessmentRecords.grossCapacityValue,
      realizationFactorLow: assessmentRecords.realizationFactorLow,
      realizationFactorHigh: assessmentRecords.realizationFactorHigh,
      recoverableHoursLow: assessmentRecords.recoverableHoursLow,
      recoverableHoursHigh: assessmentRecords.recoverableHoursHigh,
      annualValueLow: assessmentRecords.annualValueLow,
      annualValueHigh: assessmentRecords.annualValueHigh,
      findingsJson: assessmentRecords.findingsJson,
      capacityAssumptionCodesJson:
        assessmentRecords.capacityAssumptionCodesJson,
      capacityExclusionCodesJson:
        assessmentRecords.capacityExclusionCodesJson,
      priorityIdsJson: assessmentRecords.priorityIdsJson,
      leadRoute: assessmentRecords.leadRoute,
      narrativeSource: assessmentRecords.narrativeSource,
    })
    .from(assessmentRecords)
    .where(eq(assessmentRecords.id, id))
    .limit(1);
  return record ?? null;
};

const notFound = () =>
  new Response("Assessment report not found.", {
    status: 404,
    headers: PRIVATE_HEADERS,
  });

export function createAssessmentReportHandler(
  dependencies: Partial<HandlerDependencies> = {},
) {
  const findRecord = dependencies.findRecord ?? findAssessmentRecord;

  return async function getAssessmentReport(
    _request: Request,
    context: RouteContext,
  ) {
    const { id } = await context.params;
    if (!UUID.test(id)) return notFound();

    let record: AssessmentReportRecord | null;
    try {
      record = await findRecord(id);
    } catch {
      return notFound();
    }
    if (!record) return notFound();

    const pdfBytes = await buildAssessmentPdf(record);
    return new Response(new Uint8Array(pdfBytes).buffer, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="business-independence-assessment-${id}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  };
}

export const GET = createAssessmentReportHandler();
