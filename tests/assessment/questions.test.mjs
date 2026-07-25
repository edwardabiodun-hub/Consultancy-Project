import assert from "node:assert/strict";
import test from "node:test";
import {
  ASSESSMENT_VERSION,
  COMPONENT_WEIGHTS,
  QUESTION_BANK,
} from "../../lib/assessment/questions.ts";

const baseContext = {
  employeeBand: "10-49",
  managerBand: "1-2",
  revenueBand: "1-5m",
  role: "owner",
  coreSystemCount: "one",
  organizationShape: "singleTeam",
  relationshipLedByOwner: false,
  restrictedMarket: false,
};

const expectedQuestionBank = [
  { id: "criticalDecisions", component: "ownerIndependence", weight: .30, required: true, labels: ["Nearly every decision waits for the owner", "Most decisions wait, with limited exceptions", "It varies by manager or situation", "Most decisions are delegated within understood limits", "Defined decisions are made at the appropriate level", "I do not know or cannot verify this"] },
  { id: "twoWeekAbsence", component: "ownerIndependence", weight: .25, required: true, labels: ["Routine work and decisions would stall", "Significant work would wait or require contact", "Core work continues but issues accumulate", "Operations continue with a few defined exceptions", "Operations and management cadence continue without contact", "I do not know or cannot verify this"] },
  { id: "managerAuthority", component: "ownerIndependence", weight: .20, required: true, labels: ["Managers execute tasks but lack decision authority", "Authority is narrow and regularly overridden", "Authority varies by function or situation", "Managers usually decide within understood limits", "Decision rights, limits, and escalation paths are explicit", "I do not know or cannot verify this"] },
  { id: "exceptionResolution", component: "ownerIndependence", weight: .15, required: true, labels: ["Exceptions routinely escalate to the owner", "Most exceptions escalate despite manager involvement", "Common issues are resolved but treatment varies", "Teams resolve most standard exceptions", "Standard exceptions follow defined rules at the correct level", "I do not know or cannot verify this"] },
  { id: "workWaiting", component: "ownerIndependence", weight: .10, required: true, labels: ["Work queues form regularly", "Waiting occurs most weeks", "Waiting occurs in specific areas", "Waiting is uncommon and limited", "Owner input rarely blocks routine execution", "I do not know or cannot verify this"] },
  { id: "relationshipConcentration", component: "ownerIndependence", weight: .10, required: false, labels: ["Key relationships depend almost entirely on the owner", "The owner remains the essential relationship holder", "Relationships are shared but the owner is central", "Coverage exists with limited owner dependence", "Relationships are institutionally owned and documented", "I do not know or cannot verify this"], applicability: { matching: { ...baseContext, relationshipLedByOwner: true }, nonMatching: baseContext } },
  { id: "workflowDocumentation", component: "operatingSystem", weight: .25, required: true, labels: ["Critical workflows reside in individual memory", "Documentation is isolated or rarely used", "Selected workflows are documented but incomplete", "Most critical workflows are current and used", "Critical workflows are current, accessible, and routinely used", "I do not know or cannot verify this"] },
  { id: "processOwnership", component: "operatingSystem", weight: .20, required: true, labels: ["Ownership is assumed or disputed", "Ownership is person-dependent and often unclear", "Ownership is clear within selected functions", "Most workflows have accountable owners", "Critical outcomes and workflows have explicit accountable owners", "I do not know or cannot verify this"] },
  { id: "decisionRules", component: "operatingSystem", weight: .20, required: true, labels: ["Teams rely on owner intervention", "Rules are informal and manager-specific", "Common rules exist but vary", "Most thresholds are understood and followed", "Decision thresholds and escalation paths are explicit", "I do not know or cannot verify this"] },
  { id: "crossTraining", component: "operatingSystem", weight: .15, required: true, labels: ["Critical work has single points of failure", "Backup coverage is informal or untested", "Selected roles have workable backup coverage", "Most critical responsibilities have trained backups", "Critical responsibilities have tested backup coverage", "I do not know or cannot verify this"] },
  { id: "managementCadence", component: "operatingSystem", weight: .20, required: true, labels: ["Reviews are reactive or irregular", "Meetings occur without consistent decisions", "Recurring reviews exist but follow-through varies", "Reviews usually connect measures, decisions, and owners", "A defined cadence consistently drives decisions and accountability", "I do not know or cannot verify this"] },
  { id: "crossTeamConsistency", component: "operatingSystem", weight: .15, required: false, labels: ["Teams use materially different approaches", "Differences regularly create handoff problems", "Common intent exists but execution varies", "Shared standards govern most handoffs", "Shared standards consistently govern critical workflows", "I do not know or cannot verify this"], applicability: { matching: { ...baseContext, organizationShape: "multipleTeams" }, nonMatching: baseContext } },
  { id: "kpiAvailability", component: "informationVisibility", weight: .25, required: true, labels: ["Leaders cannot access current measures", "Measures require significant ad hoc preparation", "Core KPIs exist but are delayed or incomplete", "Most decision-relevant KPIs are timely", "Current decision-relevant KPIs are available within cadence", "I do not know or cannot verify this"] },
  { id: "manualReporting", component: "informationVisibility", weight: .20, required: true, labels: ["Nearly all recurring reporting is manual", "Most reporting requires manual assembly", "Automation exists but material manual work remains", "Routine reporting is mostly automated with review", "Routine reporting is automated with controlled human review", "I do not know or cannot verify this"] },
  { id: "dataTrust", component: "informationVisibility", weight: .20, required: true, labels: ["Leaders regularly debate whose numbers are correct", "Reconciliation is required for most reviews", "Selected measures are trusted after reconciliation", "Most measures use common definitions and sources", "Controlled definitions and sources produce trusted information", "I do not know or cannot verify this"] },
  { id: "detectionSpeed", component: "informationVisibility", weight: .20, required: true, labels: ["Problems surface through customer or cash impact", "Problems are usually detected after material impact", "Reviews identify problems after a meaningful delay", "Most issues surface early enough for corrective action", "Leading and lagging indicators reveal issues early enough to act", "I do not know or cannot verify this"] },
  { id: "kpiCadence", component: "informationVisibility", weight: .15, required: true, labels: ["Metrics are irregular and have no clear owner", "Reviews occur without consistent actions", "Actions are assigned but follow-through varies", "Reviews usually produce owned and tracked actions", "Reviews consistently produce decisions, owners, and tracked actions", "I do not know or cannot verify this"] },
  { id: "systemConnectivity", component: "informationVisibility", weight: .10, required: false, labels: ["Critical information is repeatedly re-keyed", "Manual transfers dominate and cause recurring errors", "Selected integrations exist with significant gaps", "Most critical flows are controlled with limited gaps", "Critical systems exchange required information through controlled workflows", "I do not know or cannot verify this"], applicability: { matching: { ...baseContext, coreSystemCount: "twoOrMore" }, nonMatching: baseContext } },
];

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

test("question bank matches the approved v1 scoring contract", () => {
  assert.deepEqual(
    QUESTION_BANK.map(({ id, component, weight, required }) => ({ id, component, weight, required })),
    expectedQuestionBank.map(({ id, component, weight, required }) => ({ id, component, weight, required })),
  );

  for (const [index, expected] of expectedQuestionBank.entries()) {
    const question = QUESTION_BANK[index];
    assert.deepEqual(
      question.options.map(({ value, label }) => ({ value, label })),
      expected.labels.map((label, optionIndex) => ({
        value: [0, 25, 50, 75, 100, "unknown"][optionIndex],
        label,
      })),
      `${expected.id} options`,
    );

    if (expected.applicability) {
      assert.equal(typeof question.appliesWhen, "function", `${expected.id} predicate`);
      assert.equal(question.appliesWhen(expected.applicability.matching), true, `${expected.id} matching context`);
      assert.equal(question.appliesWhen(expected.applicability.nonMatching), false, `${expected.id} non-matching context`);
    } else {
      assert.equal(question.appliesWhen, undefined, `${expected.id} has no predicate`);
    }
  }
});
