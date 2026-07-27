import assert from "node:assert/strict";
import test from "node:test";
import { calculateCapacity } from "../../lib/assessment/capacity.ts";

const owner = {
  activityId: "owner-approvals",
  category: "owner",
  hoursPerOccurrence: 4,
  occurrencesPerYear: 12,
  hourlyCost: 100,
};

const reporting = {
  activityId: "monthly-reporting",
  category: "reporting",
  people: 2,
  hoursPerOccurrence: 3,
  occurrencesPerYear: 12,
  hourlyCost: 50,
};

test("exact inputs for two exclusive activities produce high-confidence calculated range", () => {
  const result = calculateCapacity({ source: "exact", activities: [owner, reporting] });
  assert.equal(result.confidence, "high");
  assert.equal(result.estimateType, "calculated");
  assert.deepEqual(result.grossHours, { owner: 48, reporting: 72, rework: 0, total: 120 });
  assert.equal(result.grossCapacityValue, 8400);
  assert.deepEqual(result.recoverableHours, { low: 60, high: 84 });
  assert.deepEqual(result.annualValue, { low: 4200, high: 5880 });
  assert.ok(result.assumptions.some((assumption) => /exactly one category/i.test(assumption)));
});

test("one eligible activity does not produce a financial estimate", () => {
  const result = calculateCapacity({ source: "exact", activities: [owner] });
  assert.equal(result.confidence, "low");
  assert.equal(result.grossCapacityValue, null);
  assert.equal(result.annualValue, null);
});

test("banded activities use the directional 35 to 55 percent realization range", () => {
  const result = calculateCapacity({
    source: "banded",
    activities: [
      { ...owner, hoursPerOccurrence: 10, occurrencesPerYear: 10 },
      { ...reporting, people: 1, hoursPerOccurrence: 10, occurrencesPerYear: 10, hourlyCost: 100 },
    ],
  });
  assert.equal(result.confidence, "medium");
  assert.equal(result.estimateType, "directional");
  assert.equal(result.grossCapacityValue, 20_000);
  assert.deepEqual(result.recoverableHours, { low: 70, high: 110 });
  assert.deepEqual(result.annualValue, { low: 7000, high: 11000 });
});

test("an excluded opportunity category never creates a financial estimate", () => {
  const result = calculateCapacity({
    source: "exact",
    activities: [
      owner,
      { ...reporting, activityId: "opportunity", category: "opportunity" },
    ],
  });
  assert.equal(result.annualValue, null);
  assert.deepEqual(result.grossHours, { owner: 48, reporting: 0, rework: 0, total: 48 });
});

test("an incomplete team activity does not qualify for monetization", () => {
  const result = calculateCapacity({
    source: "exact",
    activities: [owner, { ...reporting, people: undefined }],
  });
  assert.equal(result.annualValue, null);
  assert.deepEqual(result.grossHours, { owner: 48, reporting: 0, rework: 0, total: 48 });
});

test("the same activity ID in owner, reporting, and rework rejects the entire estimate", () => {
  const result = calculateCapacity({
    source: "exact",
    activities: [
      { ...owner, activityId: "duplicate" },
      { ...reporting, activityId: "duplicate" },
      { ...reporting, activityId: "duplicate", category: "rework" },
    ],
  });
  assert.equal(result.confidence, "low");
  assert.equal(result.recoverableHours, null);
  assert.equal(result.annualValue, null);
  assert.ok(result.assumptions.some((assumption) => /duplicate activity ID/i.test(assumption)));
});

test("distinct activity IDs with identical values remain independently eligible", () => {
  const result = calculateCapacity({
    source: "exact",
    activities: [
      { ...reporting, activityId: "reporting-corrections" },
      { ...reporting, activityId: "rework-corrections", category: "rework" },
    ],
  });
  assert.equal(result.confidence, "high");
  assert.deepEqual(result.grossHours, { owner: 0, reporting: 72, rework: 72, total: 144 });
  assert.deepEqual(result.annualValue, { low: 3600, high: 5040 });
});

test("owner activities with people other than one are invalid", () => {
  const result = calculateCapacity({
    source: "exact",
    activities: [{ ...owner, people: 2 }, reporting],
  });
  assert.equal(result.annualValue, null);
  assert.ok(result.assumptions.some((assumption) => /invalid.*owner/i.test(assumption)));
});

test("zero hours, frequency, and cost remain valid activity inputs", () => {
  const result = calculateCapacity({
    source: "exact",
    activities: [
      { ...owner, hoursPerOccurrence: 0, occurrencesPerYear: 0, hourlyCost: 0 },
      { ...reporting, people: 1, hoursPerOccurrence: 0, occurrencesPerYear: 0, hourlyCost: 0 },
    ],
  });
  assert.equal(result.estimateType, "calculated");
  assert.deepEqual(result.annualValue, { low: 0, high: 0 });
});

test("invalid activity numbers do not count toward the two-category precision gate", () => {
  const invalidReporting = [
    { people: 0, hoursPerOccurrence: 3, occurrencesPerYear: 12, hourlyCost: 50 },
    { people: 1.5, hoursPerOccurrence: 3, occurrencesPerYear: 12, hourlyCost: 50 },
    { people: Number.NaN, hoursPerOccurrence: 3, occurrencesPerYear: 12, hourlyCost: 50 },
    { people: Number.POSITIVE_INFINITY, hoursPerOccurrence: 3, occurrencesPerYear: 12, hourlyCost: 50 },
    { people: 1, hoursPerOccurrence: -1, occurrencesPerYear: 12, hourlyCost: 50 },
    { people: 1, hoursPerOccurrence: Number.NaN, occurrencesPerYear: 12, hourlyCost: 50 },
    { people: 1, hoursPerOccurrence: Number.POSITIVE_INFINITY, occurrencesPerYear: 12, hourlyCost: 50 },
    { people: 1, hoursPerOccurrence: 3, occurrencesPerYear: -1, hourlyCost: 50 },
    { people: 1, hoursPerOccurrence: 3, occurrencesPerYear: Number.NaN, hourlyCost: 50 },
    { people: 1, hoursPerOccurrence: 3, occurrencesPerYear: Number.POSITIVE_INFINITY, hourlyCost: 50 },
    { people: 1, hoursPerOccurrence: 3, occurrencesPerYear: 12, hourlyCost: -1 },
    { people: 1, hoursPerOccurrence: 3, occurrencesPerYear: 12, hourlyCost: Number.NaN },
    { people: 1, hoursPerOccurrence: 3, occurrencesPerYear: 12, hourlyCost: Number.POSITIVE_INFINITY },
  ];

  for (const values of invalidReporting) {
    const result = calculateCapacity({
      source: "exact",
      activities: [owner, { ...reporting, ...values }],
    });
    assert.equal(result.annualValue, null);
    assert.deepEqual(result.grossHours, { owner: 48, reporting: 0, rework: 0, total: 48 });
    assert.ok(result.assumptions.some((assumption) => /invalid.*reporting/i.test(assumption)));
  }
});
