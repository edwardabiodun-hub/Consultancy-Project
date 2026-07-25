import assert from "node:assert/strict";
import test from "node:test";
import { interpretAssessment } from "../../lib/assessment/interpretation.ts";

const score = {
  overall: 42, category: "highDependency",
  components: {
    ownerIndependence: { score: 25, coverage: 1, unknownCount: 0 },
    operatingSystem: { score: 50, coverage: 1, unknownCount: 0 },
    informationVisibility: { score: 60, coverage: 1, unknownCount: 0 },
  },
  confidence: { level: "high", coverage: 1, reasons: [] },
  riskCodes: [],
};

const answers = {
  employeeBand: "20-49", managerBand: "3-5", revenueBand: "3m-10m",
  role: "Founder", coreSystemCount: "twoOrMore", organizationShape: "multipleTeams",
  relationshipLedByOwner: true, restrictedMarket: false, scored: {}, capacity: { source: "none", activities: [] },
};

test("high dependency and sufficient scale route to diagnostic", () => {
  const result = interpretAssessment(score, answers);
  assert.equal(result.route, "diagnostic");
  assert.equal(result.priorities[0].component, "ownerIndependence");
  assert.ok(result.riskCodes.includes("owner_bottleneck"));
});

test("restricted market never produces consulting route", () => {
  const result = interpretAssessment(score, { ...answers, restrictedMarket: true });
  assert.equal(result.route, "restricted");
});

test("strong assessments route to insights when the market is unrestricted", () => {
  const result = interpretAssessment({
    ...score,
    overall: 80,
    category: "strong",
    components: {
      ownerIndependence: { score: 90, coverage: 1, unknownCount: 0 },
      operatingSystem: { score: 85, coverage: 1, unknownCount: 0 },
      informationVisibility: { score: 80, coverage: 1, unknownCount: 0 },
    },
  }, answers);
  assert.equal(result.route, "insights");
});

test("routing follows category and recognized employee scale only", () => {
  const routes = [
    { category: "developing", overall: 42, employeeBand: "20-49", restrictedMarket: false, expected: "nurture" },
    { category: "emerging", overall: 42, employeeBand: "20-49", restrictedMarket: false, expected: "nurture" },
    { category: "incomplete", overall: 42, employeeBand: "20-49", restrictedMarket: false, expected: "nurture" },
    { category: "highDependency", overall: 42, employeeBand: "5-9", restrictedMarket: false, expected: "nurture" },
    { category: "highDependency", overall: 42, employeeBand: "", restrictedMarket: false, expected: "nurture" },
    { category: "highDependency", overall: 42, employeeBand: "not-a-band", restrictedMarket: false, expected: "nurture" },
    { category: "highDependency", overall: 42, employeeBand: "10-49", restrictedMarket: false, expected: "diagnostic" },
    { category: "strong", overall: null, employeeBand: "5-9", restrictedMarket: false, expected: "insights" },
    { category: "strong", overall: 80, employeeBand: "20-49", restrictedMarket: true, expected: "restricted" },
  ];

  for (const entry of routes) {
    const result = interpretAssessment(
      { ...score, overall: entry.overall, category: entry.category },
      { ...answers, employeeBand: entry.employeeBand, restrictedMarket: entry.restrictedMarket },
    );
    assert.equal(result.route, entry.expected);
  }
});
