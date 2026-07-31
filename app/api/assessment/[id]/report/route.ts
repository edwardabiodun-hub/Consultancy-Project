import { eq } from "drizzle-orm";
import {
  buildAssessmentPdf,
  type AssessmentReportRecord,
} from "../../../../../lib/report/pdf";
import { assessmentReportColumns } from "../../../../../lib/assessment/query";
import {
  readStoredReportPdf,
  type ReportReadBucket,
  type StoredPdfLoadResult,
} from "../../../../../lib/report/storage";

type RouteContext = { params: Promise<{ id: string }> };
type HandlerDependencies = {
  findRecord: (id: string) => Promise<AssessmentReportRecord | null>;
  loadStoredPdf: (key: string, hash: string) => Promise<StoredPdfLoadResult>;
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
    .select(assessmentReportColumns(assessmentRecords))
    .from(assessmentRecords)
    .where(eq(assessmentRecords.id, id))
    .limit(1);
  return record ?? null;
};

const loadStoredAssessmentPdf = async (
  key: string,
  hash: string,
): Promise<StoredPdfLoadResult> => {
  try {
    const { env } = await import("cloudflare:workers");
    const bucket = (env as unknown as { REPORTS?: ReportReadBucket }).REPORTS;
    if (!bucket) return { status: "unavailable" };
    return await readStoredReportPdf(bucket, key, hash);
  } catch {
    return { status: "unavailable" };
  }
};

const notFound = () =>
  new Response("Assessment report not found.", {
    status: 404,
    headers: PRIVATE_HEADERS,
  });

const integrityUnavailable = () =>
  new Response("Stored assessment report failed its integrity check.", {
    status: 503,
    headers: PRIVATE_HEADERS,
  });

export function createAssessmentReportHandler(
  dependencies: Partial<HandlerDependencies> = {},
) {
  const findRecord = dependencies.findRecord ?? findAssessmentRecord;
  const loadStoredPdf = dependencies.loadStoredPdf ?? loadStoredAssessmentPdf;

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

    let pdfBytes: Uint8Array | null = null;
    if (record.reportPdfKey && record.reportPdfHash) {
      let stored: StoredPdfLoadResult = { status: "unavailable" };
      try {
        stored = await loadStoredPdf(record.reportPdfKey, record.reportPdfHash);
      } catch {
        // R2 failures preserve the compact-record reconstruction path.
      }
      if (stored.status === "hash_mismatch") return integrityUnavailable();
      if (stored.status === "found") pdfBytes = stored.bytes;
    }
    pdfBytes ??= await buildAssessmentPdf(record);
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
