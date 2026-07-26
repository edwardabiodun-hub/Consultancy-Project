import { eq } from "drizzle-orm";
import type { assessmentRecords } from "../../../../../db/schema";
import {
  buildAssessmentPdf,
  type AssessmentReportRecord,
} from "../../../../../lib/report/pdf";

type StoredAssessmentRecord = typeof assessmentRecords.$inferSelect;
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
): Promise<StoredAssessmentRecord | null> => {
  const [{ getDb }, { assessmentRecords }] = await Promise.all([
    import("../../../../../db"),
    import("../../../../../db/schema"),
  ]);
  const [record] = await getDb()
    .select()
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
