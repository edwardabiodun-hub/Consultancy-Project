import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { buildAssessmentPdf } from "../../lib/report/pdf.ts";
import {
  createAssessmentReportHandler,
} from "../../app/api/assessment/[id]/report/route.ts";

const assessmentId = "8d7b76ca-86bf-46a6-88f4-42b6dfecd159";
const record = {
  id: assessmentId,
  assessmentVersion: "1.0.0",
  createdAt: "2026-07-26 12:00:00",
  name: "Eddie Example",
  workEmail: "eddie@example.com",
  company: "Example Company",
  phone: null,
  reportConsent: true,
  marketingConsent: false,
  overallScore: 58,
  ownerIndependenceScore: 42,
  operatingSystemScore: 61,
  informationVisibilityScore: 71,
  scoreCoverage: 0.92,
  scoreConfidence: "high",
  impactConfidence: "high",
  estimateType: "calculated",
  recoverableHoursLow: 120,
  recoverableHoursHigh: 180,
  annualValueLow: 12_000,
  annualValueHigh: 18_000,
  riskCodesJson: JSON.stringify([
    "owner_bottleneck",
    "operating_system_gap",
    "measurement_gap",
  ]),
  priorityIdsJson: JSON.stringify([
    "ownerIndependence",
    "operatingSystem",
    "informationVisibility",
  ]),
  leadRoute: "diagnostic",
  narrativeSource: "rules",
  reportDeliveryStatus: "pending",
};

test("assessment PDF is a valid document with exactly seven executive pages", async () => {
  const bytes = await buildAssessmentPdf(record);
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString("ascii"), "%PDF-");

  const reopened = await PDFDocument.load(bytes);
  assert.equal(reopened.getPageCount(), 7);
});

test("assessment report route privately downloads a persisted UUID record", async () => {
  const handler = createAssessmentReportHandler({
    findRecord: async (id) => (id === assessmentId ? record : null),
  });

  const response = await handler(
    new Request(`https://example.com/api/assessment/${assessmentId}/report`),
    { params: Promise.resolve({ id: assessmentId }) },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(
    response.headers.get("content-disposition"),
    `attachment; filename="business-independence-assessment-${assessmentId}.pdf"`,
  );
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString("ascii"), "%PDF-");
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 7);
});

test("assessment report route returns a private 404 for invalid or unknown IDs", async () => {
  let lookupCount = 0;
  const handler = createAssessmentReportHandler({
    findRecord: async () => {
      lookupCount += 1;
      return null;
    },
  });

  const invalid = await handler(
    new Request("https://example.com/api/assessment/not-a-uuid/report"),
    { params: Promise.resolve({ id: "not-a-uuid" }) },
  );
  const unknownId = "9f27be4d-cdfb-4f09-bc93-c5b4ffbe8515";
  const unknown = await handler(
    new Request(`https://example.com/api/assessment/${unknownId}/report`),
    { params: Promise.resolve({ id: unknownId }) },
  );

  assert.equal(invalid.status, 404);
  assert.equal(unknown.status, 404);
  assert.equal(invalid.headers.get("cache-control"), "private, no-store");
  assert.equal(unknown.headers.get("cache-control"), "private, no-store");
  assert.equal(lookupCount, 1);
});
