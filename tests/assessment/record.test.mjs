import assert from "node:assert/strict";
import test from "node:test";
import { QUESTION_BANK } from "../../lib/assessment/questions.ts";
import { toAssessmentRecord } from "../../lib/assessment/record.ts";
import {
  createAssessmentCalculationHandler,
} from "../../app/api/assessment/calculate/route.ts";

const result = {
  methodologyVersion: "1.0.0",
  score: {
    overall: 58,
    category: "developing",
    confidence: { level: "high", coverage: 1, reasons: [] },
    components: {
      ownerIndependence: { score: 50 },
      operatingSystem: { score: 75 },
      informationVisibility: { score: null },
    },
  },
  capacity: {
    confidence: "medium",
    estimateType: "directional",
    inputSource: "banded",
    grossHours: { owner: 80, reporting: 140, rework: 20, total: 240 },
    realizationFactors: { low: 0.35, high: 0.55 },
    recoverableHours: { low: 120, high: 180 },
    annualValue: { low: 12_000, high: 18_000 },
    assumptionCodes: [
      "exclusive_category_assignment",
      "banded_midpoints",
      "realization_35_55",
    ],
    exclusionCodes: ["invalid_activity_excluded"],
  },
  interpretation: {
    riskCodes: [
      "owner_bottleneck",
      "operating_system_gap",
      "information_bottleneck",
      "ignored_fourth_code",
    ],
    priorities: [
      { component: "ownerIndependence" },
      { component: "operatingSystem" },
    ],
    route: "diagnostic",
  },
  risks: [
    {
      code: "owner_bottleneck",
      kind: "risk",
      label: "Owner decision concentration",
      evidence: "controlled",
      component: "ownerIndependence",
      evidenceQuestionId: "criticalDecisions",
      evidenceValue: 25,
    },
    {
      code: "operating_system_gap",
      kind: "watchpoint",
      label: "Operating-system inconsistency",
      evidence: "controlled",
      component: "operatingSystem",
      evidenceQuestionId: "workflowDocumentation",
      evidenceValue: 50,
    },
  ],
  narrative: { source: "rules" },
};

const lead = {
  name: "Eddie",
  workEmail: "e@example.com",
  company: "Example",
  phone: "843-555-0100",
  reportConsent: true,
  marketingConsent: false,
};

const validPayload = {
  answers: {
    employeeBand: "20-49",
    managerBand: "3-5",
    revenueBand: "5m-20m",
    role: "Owner-operator",
    coreSystemCount: "twoOrMore",
    organizationShape: "multipleTeams",
    relationshipLedByOwner: true,
    restrictedMarket: false,
    scored: Object.fromEntries(
      QUESTION_BANK.map((question) => [question.id, 50]),
    ),
    capacity: { source: "none", activities: [] },
  },
  lead,
};

test("compact record excludes detailed answers and selects reproducible fields", () => {
  const record = toAssessmentRecord({
    id: "assessment-1",
    lead,
    result,
  });

  assert.equal("answers" in record, false);
  assert.equal("summary" in record, false);
  assert.deepEqual(record, {
    id: "assessment-1",
    assessmentVersion: "1.0.0",
    name: "Eddie",
    workEmail: "e@example.com",
    company: "Example",
    phone: "843-555-0100",
    reportConsent: true,
    marketingConsent: false,
    overallScore: 58,
    ownerIndependenceScore: 50,
    operatingSystemScore: 75,
    informationVisibilityScore: null,
    scoreCoverage: 1,
    scoreConfidence: "high",
    impactConfidence: "medium",
    estimateType: "directional",
    capacityInputSource: "banded",
    ownerGrossHours: 80,
    reportingGrossHours: 140,
    reworkGrossHours: 20,
    realizationFactorLow: 0.35,
    realizationFactorHigh: 0.55,
    recoverableHoursLow: 120,
    recoverableHoursHigh: 180,
    annualValueLow: 12_000,
    annualValueHigh: 18_000,
    findingsJson: JSON.stringify([
      {
        code: "owner_bottleneck",
        kind: "risk",
        component: "ownerIndependence",
        evidenceQuestionId: "criticalDecisions",
        evidenceValue: 25,
      },
      {
        code: "operating_system_gap",
        kind: "watchpoint",
        component: "operatingSystem",
        evidenceQuestionId: "workflowDocumentation",
        evidenceValue: 50,
      },
    ]),
    capacityAssumptionCodesJson: JSON.stringify([
      "exclusive_category_assignment",
      "banded_midpoints",
      "realization_35_55",
    ]),
    capacityExclusionCodesJson: JSON.stringify([
      "invalid_activity_excluded",
    ]),
    riskCodesJson: JSON.stringify([
      "owner_bottleneck",
      "operating_system_gap",
      "information_bottleneck",
    ]),
    priorityIdsJson: JSON.stringify([
      "ownerIndependence",
      "operatingSystem",
    ]),
    leadRoute: "diagnostic",
    narrativeSource: "rules",
    reportDeliveryStatus: "pending",
  });
});

test("compact record uses null contacts and no-delivery status without a lead", () => {
  const record = toAssessmentRecord({
    id: "assessment-2",
    result: {
      ...result,
      score: {
        ...result.score,
        overall: null,
        components: {},
      },
      capacity: {
        confidence: "low",
        estimateType: "unavailable",
        inputSource: "none",
        grossHours: { owner: 0, reporting: 0, rework: 0, total: 0 },
        realizationFactors: null,
        recoverableHours: null,
        annualValue: null,
        assumptionCodes: ["exclusive_category_assignment"],
        exclusionCodes: ["no_capacity_inputs"],
      },
    },
  });

  assert.equal(record.name, null);
  assert.equal(record.reportConsent, false);
  assert.equal(record.marketingConsent, false);
  assert.equal(record.overallScore, null);
  assert.equal(record.ownerIndependenceScore, null);
  assert.equal(record.recoverableHoursLow, null);
  assert.equal(record.annualValueHigh, null);
  assert.equal(record.capacityInputSource, "none");
  assert.equal(record.ownerGrossHours, 0);
  assert.equal(record.realizationFactorLow, null);
  assert.equal(record.reportDeliveryStatus, "not_requested");
});

test("calculation handler persists the server-recomputed compact record", async () => {
  const persisted = [];
  const handler = createAssessmentCalculationHandler({
    createId: () => "assessment-server-id",
    persistRecord: async (record) => {
      persisted.push(record);
    },
  });
  const request = new Request("https://example.com/api/assessment/calculate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...validPayload,
      overall: 100,
      result: { score: { overall: 100 } },
    }),
  });

  const response = await handler(request);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.assessmentId, "assessment-server-id");
  assert.equal(body.persistenceAvailable, true);
  assert.equal(body.result.score.overall, 50);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].id, "assessment-server-id");
  assert.equal(persisted[0].overallScore, 50);
  assert.equal("answers" in persisted[0], false);
});

test("calculation handler returns the recomputed result when D1 is unavailable", async () => {
  const handler = createAssessmentCalculationHandler({
    createId: () => "assessment-local-id",
    persistRecord: async () => {
      throw new Error("D1 unavailable");
    },
  });
  const request = new Request("https://example.com/api/assessment/calculate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(validPayload),
  });

  const response = await handler(request);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.assessmentId, "assessment-local-id");
  assert.equal(body.persistenceAvailable, false);
  assert.equal(body.result.score.overall, 50);
  assert.equal("reportDeliveryStatus" in body, false);
});
