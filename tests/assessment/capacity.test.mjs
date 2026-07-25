import assert from "node:assert/strict";
import test from "node:test";
import { calculateCapacity } from "../../lib/assessment/capacity.ts";

test("exact inputs for two categories produce high-confidence calculated range", () => {
  const result = calculateCapacity({
    source: "exact",
    exclusivity: { ownerExcludedFromTeam: true, reportingCorrectionsExcludedFromRework: true },
    owner: { hoursPerOccurrence: 4, occurrencesPerYear: 12, hourlyCost: 100 },
    reporting: { people: 2, hoursPerOccurrence: 3, occurrencesPerYear: 12, hourlyCost: 50 },
  });
  assert.equal(result.confidence, "high");
  assert.equal(result.estimateType, "calculated");
  assert.deepEqual(result.grossHours, { owner: 48, reporting: 72, rework: 0, total: 120 });
  assert.deepEqual(result.recoverableHours, { low: 60, high: 84 });
  assert.deepEqual(result.annualValue, { low: 4200, high: 5880 });
});

test("one eligible category does not produce a financial estimate", () => {
  const result = calculateCapacity({
    source: "exact",
    exclusivity: { ownerExcludedFromTeam: true, reportingCorrectionsExcludedFromRework: true },
    owner: { hoursPerOccurrence: 4, occurrencesPerYear: 12, hourlyCost: 100 },
  });
  assert.equal(result.confidence, "low");
  assert.equal(result.annualValue, null);
});

test("banded inputs use the directional 35 to 55 percent realization range", () => {
  const result = calculateCapacity({
    source: "banded",
    exclusivity: { ownerExcludedFromTeam: true, reportingCorrectionsExcludedFromRework: true },
    owner: { hoursPerOccurrence: 10, occurrencesPerYear: 10, hourlyCost: 100 },
    reporting: { people: 1, hoursPerOccurrence: 10, occurrencesPerYear: 10, hourlyCost: 100 },
  });
  assert.equal(result.confidence, "medium");
  assert.equal(result.estimateType, "directional");
  assert.deepEqual(result.recoverableHours, { low: 70, high: 110 });
  assert.deepEqual(result.annualValue, { low: 7000, high: 11000 });
});

test("ignored non-capacity entries never create a financial estimate", () => {
  const result = calculateCapacity({
    source: "exact",
    exclusivity: { ownerExcludedFromTeam: true, reportingCorrectionsExcludedFromRework: true },
    owner: { hoursPerOccurrence: 4, occurrencesPerYear: 12, hourlyCost: 100 },
    opportunity: { hoursPerOccurrence: 10, occurrencesPerYear: 12, hourlyCost: 100 },
  });
  assert.equal(result.annualValue, null);
  assert.deepEqual(result.grossHours, { owner: 48, reporting: 0, rework: 0, total: 48 });
});

test("an incomplete eligible category does not qualify for monetization", () => {
  const result = calculateCapacity({
    source: "exact",
    exclusivity: { ownerExcludedFromTeam: true, reportingCorrectionsExcludedFromRework: true },
    owner: { hoursPerOccurrence: 4, occurrencesPerYear: 12, hourlyCost: 100 },
    reporting: { hoursPerOccurrence: 3, occurrencesPerYear: 12, hourlyCost: 50 },
  });
  assert.equal(result.annualValue, null);
  assert.deepEqual(result.grossHours, { owner: 48, reporting: 0, rework: 0, total: 48 });
});

test("owner time cannot be counted in both owner and team reporting", () => {
  const result = calculateCapacity({
    source: "exact",
    exclusivity: { ownerExcludedFromTeam: false, reportingCorrectionsExcludedFromRework: true },
    owner: { hoursPerOccurrence: 4, occurrencesPerYear: 12, hourlyCost: 100 },
    reporting: { people: 2, hoursPerOccurrence: 3, occurrencesPerYear: 12, hourlyCost: 50 },
  });
  assert.equal(result.annualValue, null);
  assert.ok(result.assumptions.some((assumption) => /owner.*team/i.test(assumption)));
});

test("reporting corrections cannot be counted in both reporting and rework", () => {
  const result = calculateCapacity({
    source: "exact",
    exclusivity: { ownerExcludedFromTeam: true, reportingCorrectionsExcludedFromRework: false },
    reporting: { people: 2, hoursPerOccurrence: 3, occurrencesPerYear: 12, hourlyCost: 50 },
    rework: { people: 2, hoursPerOccurrence: 2, occurrencesPerYear: 12, hourlyCost: 50 },
  });
  assert.equal(result.annualValue, null);
  assert.ok(result.assumptions.some((assumption) => /reporting.*rework/i.test(assumption)));
});

test("missing overlap attestations cannot unlock a financial estimate", () => {
  const result = calculateCapacity({
    source: "exact",
    owner: { hoursPerOccurrence: 4, occurrencesPerYear: 12, hourlyCost: 100 },
    reporting: { people: 2, hoursPerOccurrence: 3, occurrencesPerYear: 12, hourlyCost: 50 },
  });
  assert.equal(result.annualValue, null);
  assert.ok(result.assumptions.some((assumption) => /owner.*team/i.test(assumption)));
  assert.ok(result.assumptions.some((assumption) => /reporting.*rework/i.test(assumption)));
});

test("zero hours, frequency, and cost remain valid capacity inputs", () => {
  const result = calculateCapacity({
    source: "exact",
    exclusivity: { ownerExcludedFromTeam: true, reportingCorrectionsExcludedFromRework: true },
    owner: { hoursPerOccurrence: 0, occurrencesPerYear: 0, hourlyCost: 0 },
    reporting: { people: 1, hoursPerOccurrence: 0, occurrencesPerYear: 0, hourlyCost: 0 },
  });
  assert.equal(result.estimateType, "calculated");
  assert.deepEqual(result.annualValue, { low: 0, high: 0 });
});

test("invalid capacity numbers do not count toward the two-category precision gate", () => {
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

  for (const reporting of invalidReporting) {
    const result = calculateCapacity({
      source: "exact",
      exclusivity: { ownerExcludedFromTeam: true, reportingCorrectionsExcludedFromRework: true },
      owner: { hoursPerOccurrence: 4, occurrencesPerYear: 12, hourlyCost: 100 },
      reporting,
    });
    assert.equal(result.annualValue, null);
    assert.deepEqual(result.grossHours, { owner: 48, reporting: 0, rework: 0, total: 48 });
    assert.ok(result.assumptions.some((assumption) => /invalid.*reporting/i.test(assumption)));
  }
});
