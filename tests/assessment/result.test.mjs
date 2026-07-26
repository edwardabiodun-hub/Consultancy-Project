import assert from "node:assert/strict";
import test from "node:test";
import { QUESTION_BANK } from "../../lib/assessment/questions.ts";
import { buildAssessmentResult } from "../../lib/assessment/result.ts";

const answers = {
  employeeBand: "20-49",
  managerBand: "3-5",
  revenueBand: "3m-10m",
  role: "Founder",
  coreSystemCount: "twoOrMore",
  organizationShape: "multipleTeams",
  relationshipLedByOwner: true,
  restrictedMarket: false,
  scored: Object.fromEntries(QUESTION_BANK.map((question) => [question.id, 50])),
  capacity: { source: "none", activities: [] },
};

test("builds reproducible result without AI", () => {
  const result = buildAssessmentResult(answers);
  assert.equal(result.methodologyVersion, "1.0.0");
  assert.equal(result.score.overall, 50);
  assert.equal(result.capacity.annualValue, null);
  assert.equal(result.interpretation.priorities.length, 3);
  assert.deepEqual(
    result.risks.map((risk) => risk.code),
    ["owner_bottleneck", "operating_system_gap", "information_bottleneck"],
  );
  assert.ok(result.risks.every((risk) => /self-reported response/i.test(risk.evidence)));
  assert.deepEqual(result.missingEvidence, [
    "Exact or complete banded time, frequency, people, and cost inputs across at least two categories would improve impact confidence.",
  ]);
  assert.deepEqual(result.cta, {
    href: "/founder-resources",
    label: "Get the 90-Day Business Independence Checklist",
    reason: "Build operating discipline before considering a diagnostic.",
  });
  assert.match(result.narrative.summary, /self-reported/i);
});

test("restricted results receive an educational route without a consulting invitation", () => {
  const result = buildAssessmentResult({ ...answers, restrictedMarket: true });

  assert.equal(result.interpretation.route, "restricted");
  assert.deepEqual(result.cta, {
    href: "/founder-resources",
    label: "Explore educational founder resources",
    reason: "Your stated professional boundary limits a commercial next step.",
  });
  assert.doesNotMatch(`${result.cta.label} ${result.cta.reason}`, /consult|diagnostic/i);
});
