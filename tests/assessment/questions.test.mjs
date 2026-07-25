import assert from "node:assert/strict";
import test from "node:test";
import {
  ASSESSMENT_VERSION,
  COMPONENT_WEIGHTS,
  QUESTION_BANK,
} from "../../lib/assessment/questions.ts";

test("question bank has 15 required and at most 3 conditional scored questions", () => {
  const required = QUESTION_BANK.filter((question) => question.required);
  const conditional = QUESTION_BANK.filter((question) => question.appliesWhen);
  assert.equal(required.length, 15);
  assert.equal(conditional.length, 3);
  assert.equal(QUESTION_BANK.length, 18);
});

test("component and question weights are complete", () => {
  assert.equal(ASSESSMENT_VERSION, "1.0.0");
  assert.deepEqual(COMPONENT_WEIGHTS, {
    ownerIndependence: 0.35,
    operatingSystem: 0.35,
    informationVisibility: 0.30,
  });
  for (const component of Object.keys(COMPONENT_WEIGHTS)) {
    const base = QUESTION_BANK
      .filter((question) => question.component === component && question.required)
      .reduce((sum, question) => sum + question.weight, 0);
    assert.equal(base, 1);
  }
});

test("every scored response has observable anchors", () => {
  for (const question of QUESTION_BANK) {
    assert.deepEqual(
      question.options.map((option) => option.value),
      [0, 25, 50, 75, 100, "unknown"],
    );
    for (const option of question.options) {
      assert.ok(option.label.length >= 12, `${question.id}: ${option.value}`);
    }
  }
});
