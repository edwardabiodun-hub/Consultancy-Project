import assert from "node:assert/strict";
import test from "node:test";
import "./setup.mjs";

const React = await import("react");
const { cleanup, render, screen, within } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
const { QUESTION_BANK } = await import("../../lib/assessment/questions.ts");
const { buildAssessmentResult } = await import("../../lib/assessment/result.ts");
const { PreliminaryResult } = await import(
  "../../app/assessment/PreliminaryResult.tsx"
);
const { ContactGate } = await import("../../app/assessment/ContactGate.tsx");
const { PrecisionInputs } = await import("../../app/assessment/PrecisionInputs.tsx");
const { FullResult } = await import("../../app/assessment/FullResult.tsx");

const exactAnswers = {
  employeeBand: "20-49",
  managerBand: "3-5",
  revenueBand: "5m-20m",
  role: "Owner-operator",
  coreSystemCount: "one",
  organizationShape: "singleTeam",
  relationshipLedByOwner: false,
  restrictedMarket: false,
  scored: Object.fromEntries(QUESTION_BANK.map((question) => [question.id, 50])),
  capacity: {
    source: "exact",
    activities: [
      {
        activityId: "owner-exact-v1",
        category: "owner",
        hoursPerOccurrence: 2,
        occurrencesPerYear: 12,
        hourlyCost: 100,
      },
      {
        activityId: "reporting-exact-v1",
        category: "reporting",
        people: 2,
        hoursPerOccurrence: 3,
        occurrencesPerYear: 12,
        hourlyCost: 50,
      },
    ],
  },
};

test.afterEach(() => {
  cleanup();
});

test("preliminary result provides evidence without exposing monetary capacity", async () => {
  const user = userEvent.setup();
  const result = buildAssessmentResult(exactAnswers);
  let action = "";

  const view = render(
    React.createElement(PreliminaryResult, {
      answers: exactAnswers,
      result,
      onUnlock: () => {
        action = "unlock";
      },
      onReview: () => {
        action = "review";
      },
    }),
  );

  assert.ok(screen.getByRole("heading", { name: /50 out of 100/i }));
  assert.match(view.container.textContent, /developing/i);
  assert.match(view.container.textContent, /score confidence: high/i);
  assert.equal(
    within(screen.getByRole("list", { name: "Preliminary risks" })).getAllByRole("listitem")
      .length,
    2,
  );
  assert.match(view.container.textContent, /24 reported owner intervention hours per year/i);
  assert.equal(view.container.textContent.includes("$"), false);
  for (const preview of [
    "Component scores",
    "Recoverable capacity",
    "Priority direction",
    "Executive-summary PDF",
  ]) {
    assert.ok(screen.getByText(preview));
  }

  await user.click(screen.getByRole("button", { name: "Unlock my full assessment" }));
  assert.equal(action, "unlock");
  await user.click(screen.getByRole("button", { name: "Review my answers" }));
  assert.equal(action, "review");
});

test("contact gate requires report fields while phone and marketing remain independent", async () => {
  const user = userEvent.setup();
  let submitted = null;
  render(
    React.createElement(ContactGate, {
      onBack: () => {},
      onSubmit: (lead) => {
        submitted = lead;
      },
    }),
  );

  const unlock = screen.getByRole("button", { name: "Continue to full assessment" });
  assert.equal(unlock.disabled, true);
  assert.match(screen.getByText(/phone is optional/i).textContent, /marketing updates are optional/i);

  await user.type(screen.getByRole("textbox", { name: "Name" }), "Eddie Example");
  await user.type(screen.getByRole("textbox", { name: "Work email" }), "not-an-email");
  await user.type(screen.getByRole("textbox", { name: "Company" }), "Example Co");
  await user.click(
    screen.getByRole("checkbox", { name: /generate and email my assessment report/i }),
  );
  assert.equal(unlock.disabled, true);

  const email = screen.getByRole("textbox", { name: "Work email" });
  await user.clear(email);
  await user.type(email, "eddie@example.com");
  assert.equal(unlock.disabled, false);
  await user.click(unlock);

  assert.deepEqual(submitted, {
    name: "Eddie Example",
    workEmail: "eddie@example.com",
    company: "Example Co",
    phone: undefined,
    reportConsent: true,
    marketingConsent: false,
  });
});

test("exact inputs produce exclusive activities with stable unique IDs", async () => {
  const user = userEvent.setup();
  let submitted = null;
  render(
    React.createElement(PrecisionInputs, {
      onBack: () => {},
      onUseEarlierRanges: () => {},
      onSkip: () => {},
      onComplete: (capacity) => {
        submitted = capacity;
      },
    }),
  );

  const owner = screen.getByRole("group", { name: "Owner intervention" });
  const reporting = screen.getByRole("group", {
    name: "Team reporting and reconciliation",
  });
  const rework = screen.getByRole("group", { name: "Rework" });

  for (const [group, values] of [
    [owner, ["2", "12", "100"]],
    [reporting, ["3", "4", "12", "50"]],
  ]) {
    const fields = within(group).getAllByRole("spinbutton");
    for (let index = 0; index < values.length; index += 1) {
      await user.type(fields[index], values[index]);
    }
  }

  await user.type(within(rework).getAllByRole("spinbutton")[0], "1");
  const calculate = screen.getByRole("button", { name: "Calculate with exact inputs" });
  assert.equal(calculate.disabled, true);
  assert.match(
    within(rework).getByText(/correcting a report is counted as rework/i).textContent,
    /excluded from report-preparation time/i,
  );

  const remainingRework = within(rework).getAllByRole("spinbutton").slice(1);
  for (const [field, value] of remainingRework.map((field, index) => [
    field,
    ["2", "6", "40"][index],
  ])) {
    await user.type(field, value);
  }
  assert.equal(calculate.disabled, false);
  await user.click(calculate);

  assert.deepEqual(submitted, {
    source: "exact",
    activities: [
      {
        activityId: "precision-owner-v1",
        category: "owner",
        hoursPerOccurrence: 2,
        occurrencesPerYear: 12,
        hourlyCost: 100,
      },
      {
        activityId: "precision-reporting-v1",
        category: "reporting",
        people: 3,
        hoursPerOccurrence: 4,
        occurrencesPerYear: 12,
        hourlyCost: 50,
      },
      {
        activityId: "precision-rework-v1",
        category: "rework",
        people: 1,
        hoursPerOccurrence: 2,
        occurrencesPerYear: 6,
        hourlyCost: 40,
      },
    ],
  });
  assert.equal(new Set(submitted.activities.map((activity) => activity.activityId)).size, 3);
  assert.equal(new Set(submitted.activities.map((activity) => activity.category)).size, 3);
  assert.ok(screen.getByRole("button", { name: "Use my earlier ranges" }));
  assert.ok(screen.getByRole("button", { name: "Skip financial estimate" }));
});

test("full result renders the controlled executive sequence and bounded outputs", () => {
  const result = buildAssessmentResult(exactAnswers);
  const view = render(
    React.createElement(FullResult, {
      answers: exactAnswers,
      result,
    }),
  );

  assert.match(view.container.textContent, /score confidence: high/i);
  assert.match(view.container.textContent, /impact confidence: high/i);
  assert.match(view.container.textContent, /\$3,000/);
  assert.match(view.container.textContent, /\$4,200/);
  assert.equal(
    within(screen.getByRole("list", { name: "Component scores" })).getAllByRole("listitem")
      .length,
    3,
  );
  assert.equal(
    within(screen.getByRole("list", { name: "Evidence-backed risks" })).getAllByRole("listitem")
      .length,
    3,
  );
  assert.equal(
    within(screen.getByRole("list", { name: "Controlled priorities" })).getAllByRole("listitem")
      .length,
    3,
  );

  const orderedHeadings = [
    "Executive interpretation",
    "Component scores",
    "Risk profile",
    "Recoverable capacity",
    "90-day priorities",
    "Evidence that would improve confidence",
    "Methodology and limitations",
    "Recommended next step",
  ].map((name) => screen.getByRole("heading", { name }));
  for (let index = 1; index < orderedHeadings.length; index += 1) {
    assert.ok(
      orderedHeadings[index - 1].compareDocumentPosition(orderedHeadings[index]) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    );
  }
  assert.match(view.container.textContent, /self-reported/i);
  assert.match(view.container.textContent, /not an audit/i);
  assert.ok(
    screen.getByRole("link", {
      name: "Get the 90-Day Business Independence Checklist",
    }),
  );
  assert.equal(screen.queryByRole("meter"), null);
});
