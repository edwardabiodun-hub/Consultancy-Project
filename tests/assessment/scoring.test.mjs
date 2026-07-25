import assert from "node:assert/strict";
import test from "node:test";
import { QUESTION_BANK } from "../../lib/assessment/questions.ts";
import { scoreAssessment } from "../../lib/assessment/scoring.ts";

const context = {
  employeeBand: "20-49", managerBand: "3-5", revenueBand: "3m-10m",
  role: "Founder", coreSystemCount: "one", organizationShape: "singleTeam",
  relationshipLedByOwner: false, restrictedMarket: false,
};
const answersAt = (value) => ({
  ...context,
  scored: Object.fromEntries(QUESTION_BANK.filter((q) => q.required).map((q) => [q.id, value])),
  capacity: { source: "none" },
});

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
