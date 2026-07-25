import assert from "node:assert/strict";
import test from "node:test";
import { calculateCapacity } from "../../lib/assessment/capacity.ts";

test("exact inputs for two categories produce high-confidence calculated range", () => {
  const result = calculateCapacity({
    source: "exact",
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
    owner: { hoursPerOccurrence: 4, occurrencesPerYear: 12, hourlyCost: 100 },
  });
  assert.equal(result.confidence, "low");
  assert.equal(result.annualValue, null);
});

test("banded inputs use the directional 35 to 55 percent realization range", () => {
  const result = calculateCapacity({
    source: "banded",
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
    owner: { hoursPerOccurrence: 4, occurrencesPerYear: 12, hourlyCost: 100 },
    opportunity: { hoursPerOccurrence: 10, occurrencesPerYear: 12, hourlyCost: 100 },
  });
  assert.equal(result.annualValue, null);
  assert.deepEqual(result.grossHours, { owner: 48, reporting: 0, rework: 0, total: 48 });
});

test("an incomplete eligible category does not qualify for monetization", () => {
  const result = calculateCapacity({
    source: "exact",
    owner: { hoursPerOccurrence: 4, occurrencesPerYear: 12, hourlyCost: 100 },
    reporting: { hoursPerOccurrence: 3, occurrencesPerYear: 12, hourlyCost: 50 },
  });
  assert.equal(result.annualValue, null);
  assert.deepEqual(result.grossHours, { owner: 48, reporting: 0, rework: 0, total: 48 });
});
