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

const answersAt = (value, overrides = {}) => ({
  ...answers,
  ...overrides,
  scored: Object.fromEntries(QUESTION_BANK.map((question) => [question.id, value])),
  capacity: overrides.capacity ?? { source: "none", activities: [] },
});

test("builds reproducible result without AI", () => {
  const result = buildAssessmentResult(answers);
  assert.equal(result.methodologyVersion, "1.0.0");
  assert.equal(result.score.overall, 50);
  assert.equal(result.capacity.annualValue, null);
  assert.equal(result.interpretation.priorities.length, 3);
  assert.deepEqual(
    result.risks.map(({ code, kind }) => ({ code, kind })),
    [
      { code: "owner_independence_watchpoint", kind: "watchpoint" },
      { code: "operating_system_watchpoint", kind: "watchpoint" },
      { code: "information_visibility_watchpoint", kind: "watchpoint" },
    ],
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

test("strong results contain only supported strengths and no deficit codes", () => {
  const result = buildAssessmentResult(answersAt(100));

  assert.equal(result.score.category, "strong");
  assert.equal(result.risks.length, 3);
  assert.ok(result.risks.every((finding) => finding.kind === "strength"));
  assert.ok(result.risks.every((finding) => /strength/i.test(finding.label)));
  assert.ok(result.risks.every((finding) => /self-reported response/i.test(finding.evidence)));
  assert.doesNotMatch(
    result.risks.map((finding) => finding.code).join(" "),
    /owner_bottleneck|operating_system_gap|information_bottleneck/,
  );
});

test("finding kind follows the same lowest known response shown as evidence", () => {
  for (const [value, expectedKind] of [
    [44, "risk"],
    [45, "watchpoint"],
    [79, "watchpoint"],
    [80, "strength"],
  ]) {
    const scored = Object.fromEntries(
      QUESTION_BANK.map((question) => [
        question.id,
        question.id === "criticalDecisions" ? value : 100,
      ]),
    );
    const result = buildAssessmentResult({ ...answers, scored });
    const ownerFinding = result.risks.find((finding) =>
      finding.code.startsWith("owner_"),
    );

    assert.equal(ownerFinding?.kind, expectedKind, `boundary ${value}`);
    assert.match(ownerFinding?.evidence ?? "", new RegExp(String(value)));
  }
});

test("a contradictory low owner response prevents an owner strength", () => {
  const scored = Object.fromEntries(
    QUESTION_BANK.map((question) => [
      question.id,
      question.id === "workWaiting" ? 0 : 100,
    ]),
  );
  const result = buildAssessmentResult({ ...answers, scored });
  const ownerFinding = result.risks.find((finding) =>
    finding.code.startsWith("owner_"),
  );

  assert.equal(ownerFinding?.kind, "risk");
  assert.match(ownerFinding?.evidence ?? "", /work wait/i);
  assert.doesNotMatch(
    result.risks.map((finding) => finding.code).join(" "),
    /owner_independence_strength/,
  );
});

test("an unknown owner response cannot produce an owner strength", () => {
  const scored = Object.fromEntries(
    QUESTION_BANK.map((question) => [
      question.id,
      question.id === "workWaiting" ? "unknown" : 100,
    ]),
  );
  const result = buildAssessmentResult({ ...answers, scored });

  assert.ok(result.risks.some((finding) => finding.code === "measurement_gap"));
  assert.doesNotMatch(
    result.risks.map((finding) => finding.code).join(" "),
    /owner_independence_strength/,
  );
});

test("emerging results contain supported watchpoints rather than manufactured deficits", () => {
  const result = buildAssessmentResult(answersAt(75));

  assert.equal(result.score.category, "emerging");
  assert.ok(result.risks.every((finding) => finding.kind === "watchpoint"));
  assert.ok(result.risks.every((finding) => /watchpoint/i.test(finding.label)));
  assert.doesNotMatch(
    result.risks.map((finding) => finding.code).join(" "),
    /bottleneck|_gap/,
  );
});

test("high-dependency results expose only deficit predicates supported by low scores", () => {
  const result = buildAssessmentResult(answersAt(0));

  assert.equal(result.score.category, "highDependency");
  assert.deepEqual(
    result.risks.map(({ code, kind }) => ({ code, kind })),
    [
      { code: "owner_bottleneck", kind: "risk" },
      { code: "operating_system_gap", kind: "risk" },
      { code: "information_bottleneck", kind: "risk" },
    ],
  );
  assert.ok(result.risks.every((finding) => /self-reported response/i.test(finding.evidence)));
});

test("incomplete results report the evidence gap without inventing component deficits", () => {
  const result = buildAssessmentResult(answersAt("unknown"));

  assert.equal(result.score.category, "incomplete");
  assert.deepEqual(
    result.risks.map(({ code, kind, label }) => ({ code, kind, label })),
    [{ code: "measurement_gap", kind: "risk", label: "Measurement gap" }],
  );
  assert.match(result.risks[0].evidence, /unknown response/i);
});

test("rules narratives are materially distinct for strong and high-dependency results", () => {
  const strong = buildAssessmentResult(answersAt(100));
  const highDependency = buildAssessmentResult(answersAt(0));

  assert.equal(strong.narrative.source, "rules");
  assert.match(strong.narrative.summary, /strong independence/i);
  assert.match(strong.narrative.summary, /high score confidence/i);
  assert.match(strong.narrative.summary, /low impact confidence/i);
  assert.match(strong.narrative.summary, /clarify decision authority/i);
  assert.doesNotMatch(strong.narrative.summary, /likely operating exposure/i);

  assert.match(highDependency.narrative.summary, /high dependency/i);
  assert.match(highDependency.narrative.summary, /owner decision concentration/i);
  assert.match(highDependency.narrative.summary, /clarify decision authority/i);
  assert.notEqual(strong.narrative.summary, highDependency.narrative.summary);
});

test("rules narratives distinguish low-confidence and incomplete evidence states", () => {
  const lowConfidenceScored = Object.fromEntries(
    QUESTION_BANK.map((question) => [
      question.id,
      ["workWaiting", "relationshipConcentration", "crossTraining", "systemConnectivity"].includes(
        question.id,
      )
        ? "unknown"
        : 50,
    ]),
  );
  const lowConfidence = buildAssessmentResult({ ...answers, scored: lowConfidenceScored });
  const incomplete = buildAssessmentResult(answersAt("unknown"));

  assert.equal(lowConfidence.score.confidence.level, "low");
  assert.match(lowConfidence.narrative.summary, /preliminary/i);
  assert.match(lowConfidence.narrative.summary, /low score confidence/i);
  assert.match(lowConfidence.narrative.summary, /missing evidence/i);

  assert.equal(incomplete.score.overall, null);
  assert.match(incomplete.narrative.summary, /result is incomplete/i);
  assert.match(incomplete.narrative.summary, /insufficient coverage/i);
  assert.notEqual(lowConfidence.narrative.summary, incomplete.narrative.summary);
});

test("banded results disclose selected self-reported midpoint assumptions", () => {
  const result = buildAssessmentResult(
    answersAt(50, {
      capacity: {
        source: "banded",
        activities: [
          {
            activityId: "banded-owner-v1",
            category: "owner",
            hoursPerOccurrence: 1.5,
            occurrencesPerYear: 52,
            hourlyCost: 100,
          },
          {
            activityId: "banded-reporting-v1",
            category: "reporting",
            people: 3,
            hoursPerOccurrence: 3,
            occurrencesPerYear: 12,
            hourlyCost: 50,
          },
        ],
      },
    }),
  );

  assert.equal(result.capacity.estimateType, "directional");
  assert.equal(result.capacity.confidence, "medium");
  assert.ok(
    result.capacity.assumptions.some((assumption) =>
      /midpoints of selected self-reported bands/i.test(assumption),
    ),
  );
});
