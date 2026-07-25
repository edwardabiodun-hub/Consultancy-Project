import assert from "node:assert/strict";
import test from "node:test";
import { QUESTION_BANK } from "../../lib/assessment/questions.ts";
import { scoreAssessment } from "../../lib/assessment/scoring.ts";

const context = {
  employeeBand: "20-49", managerBand: "3-5", revenueBand: "3m-10m",
  role: "Founder", coreSystemCount: "one", organizationShape: "singleTeam",
  relationshipLedByOwner: false, restrictedMarket: false,
};
const answersAt = (value, contextOverrides = {}) => {
  const answerContext = { ...context, ...contextOverrides };
  return {
    ...answerContext,
    scored: Object.fromEntries(
      QUESTION_BANK
        .filter((q) => q.required || q.appliesWhen?.(answerContext))
        .map((q) => [q.id, value]),
    ),
    capacity: { source: "none" },
  };
};
const assertCoverage = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12);

test("scores perfect required answers at 100 with high confidence", () => {
  const result = scoreAssessment(answersAt(100));
  assert.equal(result.overall, 100);
  assert.equal(result.category, "strong");
  assert.equal(result.confidence.level, "high");
});

test("suppresses overall score below 60 percent coverage", () => {
  const input = answersAt(100);
  input.scored = { criticalDecisions: 100 };
  const result = scoreAssessment(input);
  assert.equal(result.overall, null);
  assert.equal(result.category, "incomplete");
  assert.equal(result.confidence.level, "incomplete");
});

test("unknown is excluded and creates a measurement gap", () => {
  const input = answersAt(75);
  input.scored.criticalDecisions = "unknown";
  const result = scoreAssessment(input);
  assert.ok(result.riskCodes.includes("measurement_gap"));
  assert.ok(result.confidence.reasons.some((reason) => reason.includes("Unknown")));
});

test("conditional weights replace the required-base share", () => {
  const input = answersAt(100);
  input.relationshipLedByOwner = true;
  input.scored.relationshipConcentration = 0;
  const result = scoreAssessment(input);
  assert.equal(result.components.ownerIndependence.score, 90);
});

test("uses the 90/80/1 high-confidence boundary with weighted coverage", () => {
  const input = answersAt(100, { coreSystemCount: "twoOrMore" });
  input.scored.managerAuthority = "unknown";
  input.scored.systemConnectivity = "notApplicable";
  const result = scoreAssessment(input);
  assertCoverage(result.confidence.coverage, .90);
  assertCoverage(result.components.ownerIndependence.coverage, .80);
  assert.equal(result.components.ownerIndependence.unknownCount, 1);
  assert.equal(result.confidence.level, "high");
});

test("uses adjusted weights to distinguish high- and low-weight Unknown answers", () => {
  const highWeightUnknown = answersAt(100, { relationshipLedByOwner: true });
  highWeightUnknown.scored.criticalDecisions = "unknown";
  const lowWeightUnknown = answersAt(100, { relationshipLedByOwner: true });
  lowWeightUnknown.scored.workWaiting = "unknown";

  const highWeightResult = scoreAssessment(highWeightUnknown);
  const lowWeightResult = scoreAssessment(lowWeightUnknown);

  assertCoverage(highWeightResult.components.ownerIndependence.coverage, .73);
  assert.equal(highWeightResult.confidence.level, "medium");
  assertCoverage(lowWeightResult.components.ownerIndependence.coverage, .91);
  assert.equal(lowWeightResult.confidence.level, "high");
});

test("uses the 75/65/3 medium-confidence boundary with weighted coverage", () => {
  const input = answersAt(100);
  input.scored.managerAuthority = "unknown";
  input.scored.exceptionResolution = "unknown";
  input.scored.kpiAvailability = "unknown";
  input.scored.crossTraining = "notApplicable";
  const result = scoreAssessment(input);

  assertCoverage(result.confidence.coverage, .75);
  assertCoverage(result.components.ownerIndependence.coverage, .65);
  assert.equal(result.confidence.reasons[0], "3 Unknown responses reduced confidence.");
  assert.equal(result.confidence.level, "medium");
});

test("assigns low confidence when more than three Unknown answers remain", () => {
  const input = answersAt(100);
  input.scored.workWaiting = "unknown";
  input.scored.crossTraining = "unknown";
  input.scored.manualReporting = "unknown";
  input.scored.kpiCadence = "unknown";
  const result = scoreAssessment(input);
  assert.equal(result.confidence.level, "low");
});

test("caps a component with two Unknown answers at developing", () => {
  const input = answersAt(100);
  input.scored.exceptionResolution = "unknown";
  input.scored.workWaiting = "unknown";
  const result = scoreAssessment(input);

  assert.equal(result.components.ownerIndependence.score, 100);
  assert.equal(result.components.ownerIndependence.unknownCount, 2);
  assert.equal(result.components.ownerIndependence.category, "developing");
});
