import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { buildAssessmentPdf } from "../../lib/report/pdf.ts";
import {
  createAssessmentReportHandler,
} from "../../app/api/assessment/[id]/report/route.ts";

const assessmentId = "8d7b76ca-86bf-46a6-88f4-42b6dfecd159";
const baseRecord = {
  id: assessmentId,
  assessmentVersion: "1.0.0",
  createdAt: "2026-07-26 12:00:00",
  name: "Eddie Example",
  company: "Example Company",
  overallScore: 58,
  ownerIndependenceScore: 42,
  operatingSystemScore: 61,
  informationVisibilityScore: 71,
  scoreCoverage: 0.92,
  scoreConfidence: "high",
  impactConfidence: "high",
  estimateType: "calculated",
  capacityInputSource: "exact",
  ownerGrossHours: 80,
  reportingGrossHours: 140,
  reworkGrossHours: 20,
  realizationFactorLow: 0.5,
  realizationFactorHigh: 0.7,
  recoverableHoursLow: 120,
  recoverableHoursHigh: 168,
  annualValueLow: 12_000,
  annualValueHigh: 16_800,
  findingsJson: JSON.stringify([
    {
      code: "owner_bottleneck",
      kind: "risk",
      component: "ownerIndependence",
      evidenceQuestionId: "criticalDecisions",
      evidenceValue: 25,
    },
    {
      code: "operating_system_watchpoint",
      kind: "watchpoint",
      component: "operatingSystem",
      evidenceQuestionId: "workflowDocumentation",
      evidenceValue: 50,
    },
    {
      code: "information_visibility_strength",
      kind: "strength",
      component: "informationVisibility",
      evidenceQuestionId: "kpiAvailability",
      evidenceValue: 75,
    },
  ]),
  capacityAssumptionCodesJson: JSON.stringify([
    "exclusive_category_assignment",
    "realization_50_70",
  ]),
  capacityExclusionCodesJson: JSON.stringify([
    "invalid_activity_excluded",
  ]),
  priorityIdsJson: JSON.stringify([
    "ownerIndependence",
    "operatingSystem",
    "informationVisibility",
  ]),
  leadRoute: "diagnostic",
  narrativeSource: "rules",
};

const decodeStreams = (bytes) => {
  const source = Buffer.from(bytes).toString("latin1");
  const streams = [];
  const pattern = /stream\r?\n([\s\S]*?)endstream/g;
  for (const match of source.matchAll(pattern)) {
    const raw = Buffer.from(match[1].replace(/\r?\n$/, ""), "latin1");
    let decoded = raw.toString("latin1");
    try {
      decoded = inflateSync(raw).toString("latin1");
    } catch {
      // Non-Flate streams are already readable.
    }
    streams.push(decoded);
  }
  return streams;
};

const extractText = (stream) =>
  [...stream.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)]
    .map((match) => Buffer.from(match[1], "hex").toString("latin1"))
    .join(" ");

const inspectPdf = async (record) => {
  const bytes = await buildAssessmentPdf(record);
  const reopened = await PDFDocument.load(bytes);
  const streams = decodeStreams(bytes);
  const pageStreams = streams.filter(
    (stream) => stream.includes(" Tj") && stream.includes(" Tm"),
  );
  return {
    bytes,
    pageCount: reopened.getPageCount(),
    pages: pageStreams.map(extractText),
    contentY: pageStreams.flatMap((stream) =>
      [...stream.matchAll(/1 0 0 1 [\d.-]+ ([\d.-]+) Tm\s*<[^>]+>\s*Tj/g)]
        .map((match) => Number(match[1])),
    ),
  };
};

test("assessment PDF has the exact seven-page executive content contract", async () => {
  const { bytes, pageCount, pages } = await inspectPdf(baseRecord);
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString("ascii"), "%PDF-");
  assert.equal(pageCount, 7);
  assert.equal(pages.length, 7);

  const required = [
    [
      "Business Independence Assessment",
      "Eddie Example",
      "Example Company",
      "July 26, 2026",
      "Self-reported",
    ],
    [
      "Executive summary",
      "Top supported findings",
      "Owner decision concentration",
      "Operating-system watchpoint",
      "Information visibility strength",
      "Capacity signal",
      "Discuss the Business Independence Diagnostic",
    ],
    [
      "Component scores",
      "Owner independence",
      "Operating-system maturity",
      "Information visibility",
      "Controlled strength",
      "Controlled constraint",
      "Evidence basis",
      "Score confidence: high",
      "Coverage: 92 percent",
    ],
    [
      "Recoverable capacity",
      "Impact confidence: high",
      "Owner gross hours",
      "Reporting gross hours",
      "Rework gross hours",
      "Realization range",
      "Assumptions",
      "Exclusions",
      "SOURCE: REALIZATION-ADJUSTED FROM EXACT INPUT",
    ],
    [
      "Supported findings",
      "Evidence summary",
      "Implication",
      "Causes require validation",
    ],
    [
      "90-day priority direction",
      "1. Clarify decision authority",
      "2. Stabilize one critical workflow",
      "3. Create a decision-ready KPI cadence",
      "Leading indicator",
      "Paid diagnostic boundary",
    ],
    [
      "Methodology and confidence",
      "Estimate source key",
      "Limitations",
      "Discuss the Business Independence Diagnostic",
      "Edward (Eddie) Abiodun",
      "/contact",
      "Professional boundary",
    ],
  ];
  required.forEach((phrases, index) => {
    for (const phrase of phrases) {
      assert.match(pages[index], new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
  });
  assert.equal([...pages.join(" ")].some((character) => character.charCodeAt(0) > 127), false);
});

test("capacity page distinguishes banded, unavailable, and inconsistent records", async () => {
  const medium = await inspectPdf({
    ...baseRecord,
    impactConfidence: "medium",
    estimateType: "directional",
    capacityInputSource: "banded",
    realizationFactorLow: 0.35,
    realizationFactorHigh: 0.55,
    capacityAssumptionCodesJson: JSON.stringify([
      "banded_midpoints",
      "realization_35_55",
    ]),
  });
  assert.match(medium.pages[3], /SOURCE: REALIZATION-ADJUSTED FROM BANDED INPUT/i);

  const low = await inspectPdf({
    ...baseRecord,
    impactConfidence: "low",
    estimateType: "unavailable",
    capacityInputSource: "none",
    realizationFactorLow: null,
    realizationFactorHigh: null,
    recoverableHoursLow: null,
    recoverableHoursHigh: null,
    annualValueLow: null,
    annualValueHigh: null,
    capacityAssumptionCodesJson: JSON.stringify([
      "exclusive_category_assignment",
    ]),
    capacityExclusionCodesJson: JSON.stringify(["no_capacity_inputs"]),
  });
  assert.match(low.pages[3], /Nonfinancial supported indicators/i);
  assert.match(low.pages[3], /Inputs needed/i);
  assert.match(low.pages[3], /SOURCE: NO CAPACITY INPUT/i);
  assert.doesNotMatch(low.pages[3], /\$/);

  const inconsistent = await inspectPdf({
    ...baseRecord,
    recoverableHoursLow: null,
    recoverableHoursHigh: null,
  });
  assert.match(inconsistent.pages[3], /Inconsistent retained estimate/i);
  assert.doesNotMatch(inconsistent.pages[3], /0\s*-\s*0/);
});

test("long unbroken respondent fields wrap without crossing the content floor", async () => {
  const long = await inspectPdf({
    ...baseRecord,
    name: "N".repeat(200),
    company: "C".repeat(200),
  });
  assert.equal(long.pageCount, 7);
  assert.equal(long.pages.length, 7);
  assert.ok(long.contentY.length > 0);
  assert.equal(
    long.contentY.some((y) => y !== 26 && y !== 35 && y < 58),
    false,
  );
});

test("assessment report route privately downloads only selected persisted fields", async () => {
  let selectedId = null;
  const handler = createAssessmentReportHandler({
    findRecord: async (id) => {
      selectedId = id;
      return id === assessmentId ? baseRecord : null;
    },
  });
  const response = await handler(
    new Request(`https://example.com/api/assessment/${assessmentId}/report`),
    { params: Promise.resolve({ id: assessmentId }) },
  );
  assert.equal(selectedId, assessmentId);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(
    response.headers.get("content-disposition"),
    `attachment; filename="business-independence-assessment-${assessmentId}.pdf"`,
  );
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
