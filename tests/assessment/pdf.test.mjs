import assert from "node:assert/strict";
import test from "node:test";
import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";
import { calculateCapacity } from "../../lib/assessment/capacity.ts";
import {
  buildAssessmentPdf,
  deriveCapacityPresentation,
} from "../../lib/report/pdf.ts";
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
  grossCapacityValue: 24_000,
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
    },
    {
      code: "operating_system_watchpoint",
      kind: "watchpoint",
      component: "operatingSystem",
    },
    {
      code: "information_visibility_strength",
      kind: "strength",
      component: "informationVisibility",
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

const extractText = (stream) =>
  [...stream.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)]
    .map((match) => Buffer.from(match[1], "hex").toString("latin1"))
    .join(" ");

const inspectPdf = async (record) => {
  const bytes = await buildAssessmentPdf(record);
  const reopened = await PDFDocument.load(bytes);
  const pageStreams = reopened.getPages().map((page) => {
    const contents = page.node.Contents();
    const references = contents instanceof PDFArray
      ? contents.asArray()
      : contents
        ? [contents]
        : [];
    return references.map((reference) => {
      const stream = reopened.context.lookup(reference);
      return stream instanceof PDFRawStream
        ? Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1")
        : "";
    }).join("\n");
  });
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

const withCapacityResult = (record, capacity) => ({
  ...record,
  impactConfidence: capacity.confidence,
  estimateType: capacity.estimateType,
  capacityInputSource: capacity.inputSource,
  ownerGrossHours: capacity.grossHours.owner,
  reportingGrossHours: capacity.grossHours.reporting,
  reworkGrossHours: capacity.grossHours.rework,
  grossCapacityValue: capacity.grossCapacityValue,
  realizationFactorLow: capacity.realizationFactors?.low ?? null,
  realizationFactorHigh: capacity.realizationFactors?.high ?? null,
  recoverableHoursLow: capacity.recoverableHours?.low ?? null,
  recoverableHoursHigh: capacity.recoverableHours?.high ?? null,
  annualValueLow: capacity.annualValue?.low ?? null,
  annualValueHigh: capacity.annualValue?.high ?? null,
  capacityAssumptionCodesJson: JSON.stringify(capacity.assumptionCodes),
  capacityExclusionCodesJson: JSON.stringify(capacity.exclusionCodes),
});

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
      "Risk profile",
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
    recoverableHoursLow: 84,
    recoverableHoursHigh: 132,
    annualValueLow: 8_400,
    annualValueHigh: 13_200,
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
    grossCapacityValue: null,
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

test("domain-derived unavailable states retain gross indicators without inventing money", async () => {
  const owner = {
    activityId: "owner-approvals",
    category: "owner",
    hoursPerOccurrence: 4,
    occurrencesPerYear: 12,
    hourlyCost: 100,
  };
  const fixtures = [
    {
      source: "exact",
      capacity: calculateCapacity({ source: "exact", activities: [owner] }),
      page4Source: "EXACT INPUT",
      gross: "Owner gross hours: 48",
    },
    {
      source: "banded",
      capacity: calculateCapacity({ source: "banded", activities: [owner] }),
      page4Source: "BANDED INPUT",
      gross: "Owner gross hours: 48",
    },
    {
      source: "none",
      capacity: calculateCapacity({ source: "none", activities: [] }),
      page4Source: "NO CAPACITY INPUT",
      gross: "Owner gross hours: 0",
    },
  ];

  for (const fixture of fixtures) {
    const pdf = await inspectPdf(
      withCapacityResult(baseRecord, fixture.capacity),
    );
    assert.match(pdf.pages[1], /No supported recoverable-hours or monetary estimate/i);
    assert.doesNotMatch(pdf.pages[1], /\$/);
    assert.match(pdf.pages[3], new RegExp(fixture.gross, "i"));
    assert.match(pdf.pages[3], new RegExp(`SOURCE: ${fixture.page4Source}`, "i"));
    assert.match(pdf.pages[3], /Nonfinancial supported indicators/i);
    assert.doesNotMatch(pdf.pages[3], /\$/);
    assert.match(pdf.pages[6], /Impact confidence: low/i);
    assert.match(pdf.pages[6], /Capacity presentation: unavailable/i);
  }

  const contradictory = await inspectPdf({
    ...withCapacityResult(baseRecord, fixtures[0].capacity),
    realizationFactorLow: 0.5,
  });
  for (const pageIndex of [1, 3]) {
    assert.match(contradictory.pages[pageIndex], /Inconsistent retained estimate/i);
    assert.doesNotMatch(contradictory.pages[pageIndex], /\$/);
  }
  assert.match(
    contradictory.pages.at(-1),
    /Capacity presentation: inconsistent/i,
  );
});

test("available capacity tuples require canonical factors and recoverable arithmetic", async () => {
  const inconsistentFixtures = [
    { realizationFactorLow: 0.49 },
    { realizationFactorHigh: 0.71 },
    { recoverableHoursLow: 119 },
    {
      impactConfidence: "medium",
      estimateType: "directional",
      capacityInputSource: "banded",
      realizationFactorLow: 0.35,
      realizationFactorHigh: 0.55,
      recoverableHoursLow: 85,
      recoverableHoursHigh: 132,
    },
  ];

  for (const changes of inconsistentFixtures) {
    const pdf = await inspectPdf({ ...baseRecord, ...changes });
    assert.match(pdf.pages[1], /Inconsistent retained estimate/i);
    assert.match(pdf.pages[3], /Inconsistent retained estimate/i);
    assert.match(pdf.pages[6], /Capacity presentation: inconsistent/i);
  }
});

test("coherent exact, banded, and rounded annual values remain available", () => {
  const fixtures = [
    baseRecord,
    {
      ...baseRecord,
      impactConfidence: "medium",
      estimateType: "directional",
      capacityInputSource: "banded",
      realizationFactorLow: 0.35,
      realizationFactorHigh: 0.55,
      recoverableHoursLow: 84,
      recoverableHoursHigh: 132,
      annualValueLow: 8_400,
      annualValueHigh: 13_200,
    },
    {
      ...baseRecord,
      grossCapacityValue: 101,
      annualValueLow: 51,
      annualValueHigh: 71,
    },
  ];

  for (const fixture of fixtures) {
    assert.equal(deriveCapacityPresentation(fixture).status, "available");
  }
});

test("annual values that do not round from the retained gross value suppress money on pages two, four, and seven", async () => {
  const fixtures = [
    { annualValueLow: 11_999 },
    { annualValueHigh: 16_801 },
    {
      impactConfidence: "medium",
      estimateType: "directional",
      capacityInputSource: "banded",
      realizationFactorLow: 0.35,
      realizationFactorHigh: 0.55,
      recoverableHoursLow: 84,
      recoverableHoursHigh: 132,
      annualValueLow: 12_000,
      annualValueHigh: 16_800,
    },
  ];

  for (const changes of fixtures) {
    const pdf = await inspectPdf({ ...baseRecord, ...changes });
    for (const pageIndex of [1, 3]) {
      assert.match(pdf.pages[pageIndex], /Inconsistent retained estimate/i);
      assert.doesNotMatch(pdf.pages[pageIndex], /\$/);
      assert.doesNotMatch(
        pdf.pages[pageIndex],
        /\d[\d,]*\s*-\s*\d[\d,]*\s+recoverable hours/i,
      );
    }
    assert.match(pdf.pages[6], /Capacity presentation: inconsistent/i);
  }
});

test("missing and migration-default capacity tuples suppress numbers on pages two and four", async () => {
  const fixtures = [
    {
      ...baseRecord,
      recoverableHoursLow: null,
      annualValueHigh: null,
    },
    {
      ...baseRecord,
      capacityInputSource: "none",
      ownerGrossHours: 0,
      reportingGrossHours: 0,
      reworkGrossHours: 0,
      realizationFactorLow: null,
      realizationFactorHigh: null,
    },
  ];

  for (const fixture of fixtures) {
    const pdf = await inspectPdf(fixture);
    for (const pageIndex of [1, 3]) {
      assert.match(pdf.pages[pageIndex], /Inconsistent retained estimate/i);
      assert.doesNotMatch(pdf.pages[pageIndex], /\$/);
      assert.doesNotMatch(
        pdf.pages[pageIndex],
        /\d[\d,]*\s*-\s*\d[\d,]*\s+recoverable hours/i,
      );
    }
  }
});

test("component claims are gated by matching controlled finding kinds", async () => {
  const mixed = await inspectPdf(baseRecord);
  const page = mixed.pages[2];
  const owner = page.slice(
    page.indexOf("Owner independence:"),
    page.indexOf("Operating-system maturity:"),
  );
  const operating = page.slice(
    page.indexOf("Operating-system maturity:"),
    page.indexOf("Information visibility:"),
  );
  const information = page.slice(page.indexOf("Information visibility:"));

  assert.match(owner, /No controlled strength supported by the compact record/i);
  assert.match(owner, /Controlled constraint: Normalized (?:risk|watchpoint) finding/i);
  assert.match(operating, /No controlled strength supported by the compact record/i);
  assert.match(operating, /Controlled constraint: Normalized (?:risk|watchpoint) finding/i);
  assert.match(information, /Controlled strength: Normalized strength finding/i);
  assert.match(
    information,
    /No controlled constraint supported by the compact record/i,
  );

  const incomplete = await inspectPdf({
    ...baseRecord,
    ownerIndependenceScore: null,
    operatingSystemScore: null,
    informationVisibilityScore: null,
    findingsJson: "[]",
  });
  assert.equal(
    (
      incomplete.pages[2].match(
        /No controlled strength supported by the compact record/gi,
      ) ?? []
    ).length,
    3,
  );
  assert.equal(
    (
      incomplete.pages[2].match(
        /No controlled constraint supported by the compact record/gi,
      ) ?? []
    ).length,
    3,
  );
  assert.doesNotMatch(incomplete.pages[2], /practices are present/i);
});

test("risk profile preserves risk, watchpoint, and strength semantics", async () => {
  const mixed = await inspectPdf(baseRecord);
  assert.match(mixed.pages[4], /Risk profile/i);
  assert.match(mixed.pages[4], /Supported deterministic risks/i);
  assert.match(mixed.pages[4], /Owner decision concentration/i);
  assert.match(mixed.pages[4], /Watchpoints \(not risks\)/i);
  assert.match(mixed.pages[4], /Operating-system watchpoint/i);
  assert.doesNotMatch(mixed.pages[4], /Information visibility strength/i);

  const strong = await inspectPdf({
    ...baseRecord,
    overallScore: 88,
    findingsJson: JSON.stringify([
      {
        code: "owner_independence_strength",
        kind: "strength",
        component: "ownerIndependence",      },
      {
        code: "operating_system_watchpoint",
        kind: "watchpoint",
        component: "operatingSystem",      },
    ]),
  });
  assert.match(
    strong.pages[4],
    /No deterministic risk finding is supported by the compact record/i,
  );
  assert.match(strong.pages[4], /Watchpoints \(not risks\)/i);
  assert.doesNotMatch(strong.pages[4], /Owner independence strength/i);
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
