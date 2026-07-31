import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { buildAssessmentEmail } from "../../../../../lib/email/assessment-report";
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
export type AssessmentDeliveryRecord = AssessmentReportRecord & {
  workEmail: string | null;
  reportConsent: boolean;
  reportDeliveryStatus: string;
};

type RouteContext = { params: Promise<{ id: string }> };
type HandlerDependencies = {
  findRecord: (id: string) => Promise<AssessmentDeliveryRecord | null>;
  markDelivered: (id: string) => Promise<void>;
  loadStoredPdf: (key: string, hash: string) => Promise<StoredPdfLoadResult>;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PRIVATE_HEADERS = {
  "cache-control": "private, no-store",
};

const notFound = () =>
  new Response("Assessment report not found.", {
    status: 404,
    headers: PRIVATE_HEADERS,
  });

const notConfigured = () =>
  NextResponse.json(
    {
      ok: false,
      errors: {
        form: "Report delivery is not yet configured. Use the on-screen download instead.",
      },
    },
    { status: 503, headers: PRIVATE_HEADERS },
  );

const deliveryUnavailable = () =>
  NextResponse.json(
    {
      ok: false,
      errors: {
        form: "Report delivery is temporarily unavailable. Your result and download remain available.",
      },
    },
    { status: 503, headers: PRIVATE_HEADERS },
  );

const findAssessmentDeliveryRecord = async (
  id: string,
): Promise<AssessmentDeliveryRecord | null> => {
  const [{ getDb }, { assessmentRecords }] = await Promise.all([
    import("../../../../../db"),
    import("../../../../../db/schema"),
  ]);
  const [record] = await getDb()
    .select({
      ...assessmentReportColumns(assessmentRecords),
      workEmail: assessmentRecords.workEmail,
      reportConsent: assessmentRecords.reportConsent,
      reportDeliveryStatus: assessmentRecords.reportDeliveryStatus,
    })
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

const markAssessmentDelivered = async (id: string) => {
  const [{ getDb }, { assessmentRecords }] = await Promise.all([
    import("../../../../../db"),
    import("../../../../../db/schema"),
  ]);
  await getDb()
    .update(assessmentRecords)
    .set({ reportDeliveryStatus: "sent" })
    .where(eq(assessmentRecords.id, id));
};

const toBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

export function createAssessmentDeliverHandler(
  dependencies: Partial<HandlerDependencies> = {},
) {
  const findRecord = dependencies.findRecord ?? findAssessmentDeliveryRecord;
  const markDelivered = dependencies.markDelivered ?? markAssessmentDelivered;
  const loadStoredPdf = dependencies.loadStoredPdf ?? loadStoredAssessmentPdf;

  return async function postAssessmentDeliver(
    _request: Request,
    context: RouteContext,
  ) {
    const { id } = await context.params;
    if (!UUID.test(id)) return notFound();

    // Fail fast on missing configuration before touching the database: a
    // misconfigured environment can never deliver, regardless of which
    // assessment id is requested.
    const key = process.env.RESEND_API_KEY;
    const from = process.env.ASSESSMENT_REPORT_FROM_EMAIL;
    if (!key || !from) return notConfigured();

    let record: AssessmentDeliveryRecord | null;
    try {
      record = await findRecord(id);
    } catch {
      return notFound();
    }
    if (!record) return notFound();
    if (!record.reportConsent || !record.workEmail) return notFound();

    // Duplicate request protection: a report already delivered is not
    // re-sent. The visitor's on-screen result and PDF download remain
    // available regardless.
    if (record.reportDeliveryStatus === "sent") {
      return NextResponse.json(
        { ok: true, status: "already_sent" },
        { headers: PRIVATE_HEADERS },
      );
    }

    let pdfBytes: Uint8Array | null = null;
    if (record.reportPdfKey && record.reportPdfHash) {
      let stored: StoredPdfLoadResult = { status: "unavailable" };
      try {
        stored = await loadStoredPdf(record.reportPdfKey, record.reportPdfHash);
      } catch {
        // Preserve compact reconstruction when R2 itself is unavailable.
      }
      if (stored.status === "hash_mismatch") return deliveryUnavailable();
      if (stored.status === "found") pdfBytes = stored.bytes;
    }
    pdfBytes ??= await buildAssessmentPdf(record);
    const email = buildAssessmentEmail(record);

    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [record.workEmail],
        subject: email.subject,
        html: email.html,
        text: email.text,
        attachments: [
          {
            filename: email.attachmentFilename,
            content: toBase64(new Uint8Array(pdfBytes)),
          },
        ],
      }),
    });

    if (!sent.ok) {
      // Retain the record as-is (delivery status unchanged) so the visitor
      // can retry, and the immediate on-screen download stays available.
      return deliveryUnavailable();
    }

    try {
      await markDelivered(id);
    } catch {
      // The email was already sent successfully; a failure to persist the
      // status locally should not be reported as a delivery failure.
    }

    return NextResponse.json(
      { ok: true, status: "sent" },
      { headers: PRIVATE_HEADERS },
    );
  };
}

export const POST = createAssessmentDeliverHandler();
