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
const { BandedCapacityInputs } = await import(
  "../../app/assessment/BandedCapacityInputs.tsx"
);

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
        activityId: "precision-owner-v1",
        category: "owner",
        hoursPerOccurrence: 2,
        occurrencesPerYear: 12,
        hourlyCost: 100,
      },
      {
        activityId: "precision-reporting-v1",
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
    within(screen.getByRole("list", { name: "Preliminary findings" })).getAllByRole("listitem")
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
  assert.equal(unlock.disabled, false);
  assert.match(screen.getByText(/phone is optional/i).textContent, /marketing updates are optional/i);

  await user.click(unlock);
  const name = screen.getByRole("textbox", { name: "Name" });
  const email = screen.getByRole("textbox", { name: "Work email" });
  const company = screen.getByRole("textbox", { name: "Company" });
  const consent = screen.getByRole("checkbox", {
    name: /generate and email my assessment report/i,
  });
  assert.equal(document.activeElement, name);
  assert.equal(name.getAttribute("aria-invalid"), "true");
  assert.equal(name.getAttribute("aria-describedby"), "lead-name-error");
  assert.ok(screen.getByText("Enter your name."));
  assert.equal(consent.getAttribute("aria-invalid"), "true");
  assert.equal(consent.getAttribute("aria-describedby"), "lead-report-consent-error");

  await user.type(name, "Eddie Example");
  await user.type(email, "not-an-email");
  await user.click(company);
  assert.equal(email.getAttribute("aria-invalid"), "true");
  assert.equal(email.getAttribute("aria-describedby"), "lead-work-email-error");
  assert.ok(screen.getByText("Enter a valid work email."));

  await user.type(company, "Example Co");
  await user.click(unlock);
  assert.equal(document.activeElement, email);
  await user.clear(email);
  await user.type(email, "eddie@example.com");
  await user.click(unlock);
  assert.equal(document.activeElement, consent);
  assert.ok(
    screen.getByText("Consent is required to generate and email the report."),
  );
  await user.click(consent);
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
      hasEarlierRanges: true,
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
  assert.equal(calculate.disabled, false);
  await user.click(calculate);
  const reworkFields = within(rework).getAllByRole("spinbutton");
  assert.equal(document.activeElement, reworkFields[1]);
  assert.equal(reworkFields[1].getAttribute("aria-invalid"), "true");
  assert.equal(reworkFields[1].getAttribute("aria-describedby"), "precision-rework-error");
  assert.match(
    within(rework).getByRole("alert").textContent,
    /hours per occurrence, occurrences per year, and hourly cost are required/i,
  );
  assert.match(
    within(rework).getByText(/correcting a report is counted as rework/i).textContent,
    /excluded from report-preparation time/i,
  );

  const remainingRework = reworkFields.slice(1);
  for (const [field, value] of remainingRework.map((field, index) => [
    field,
    ["2", "6", "40"][index],
  ])) {
    await user.type(field, value);
  }
  assert.equal(calculate.disabled, false);
  assert.equal(within(rework).queryByRole("alert"), null);
  assert.equal(reworkFields[1].getAttribute("aria-invalid"), "false");
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

test("precision copy is truthful when no earlier banded range exists", async () => {
  const user = userEvent.setup();
  let skipped = false;
  render(
    React.createElement(PrecisionInputs, {
      onBack: () => {},
      onUseEarlierRanges: () => {
        assert.fail("earlier ranges action must not be exposed");
      },
      onSkip: () => {
        skipped = true;
      },
      hasEarlierRanges: false,
      onComplete: () => {},
    }),
  );

  assert.equal(screen.queryByRole("button", { name: "Use my earlier ranges" }), null);
  await user.click(
    screen.getByRole("button", { name: "Continue without a financial range" }),
  );
  assert.equal(skipped, true);
});

test("blank exact calculation exposes an accessible form error that clears after completion", async () => {
  const user = userEvent.setup();
  let submitted = null;
  render(
    React.createElement(PrecisionInputs, {
      onBack: () => {},
      onUseEarlierRanges: () => {},
      onSkip: () => {},
      hasEarlierRanges: false,
      onComplete: (capacity) => {
        submitted = capacity;
      },
    }),
  );

  await user.click(screen.getByRole("button", { name: "Calculate with exact inputs" }));
  const summary = screen.getByRole("alert");
  const owner = screen.getByRole("group", { name: "Owner intervention" });
  const ownerHours = within(owner).getByRole("spinbutton", {
    name: "Hours per occurrence",
  });
  assert.match(summary.textContent, /at least one complete category is required/i);
  assert.equal(document.activeElement, ownerHours);
  assert.equal(ownerHours.getAttribute("aria-invalid"), "true");
  assert.equal(ownerHours.getAttribute("aria-describedby"), "precision-form-error");

  const ownerFields = within(owner).getAllByRole("spinbutton");
  for (const [field, value] of ownerFields.map((field, index) => [
    field,
    ["2", "12", "100"][index],
  ])) {
    await user.type(field, value);
  }

  assert.equal(screen.queryByText(/at least one complete category is required/i), null);
  assert.equal(ownerHours.getAttribute("aria-invalid"), "false");
  assert.equal(ownerHours.getAttribute("aria-describedby"), null);
  await user.click(screen.getByRole("button", { name: "Calculate with exact inputs" }));
  assert.equal(submitted.activities.length, 1);
  assert.equal(submitted.activities[0].activityId, "precision-owner-v1");
});

test("banded choices create stable exclusive activities from disclosed self-reported midpoints", async () => {
  const user = userEvent.setup();
  let capacity = null;
  function BandedHarness() {
    const [value, setValue] = React.useState({ source: "none", activities: [] });
    return React.createElement(BandedCapacityInputs, {
      value,
      onChange: (next) => {
        capacity = next;
        setValue(next);
      },
    });
  }
  render(React.createElement(BandedHarness));

  assert.match(
    screen.getByText(/calculations use the midpoint/i).textContent,
    /selected self-reported band/i,
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Owner intervention range" }),
    "owner-1-2-weekly",
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Team reporting and reconciliation range" }),
    "reporting-2-4-monthly",
  );

  assert.deepEqual(capacity, {
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
  });
  assert.equal(new Set(capacity.activities.map((activity) => activity.activityId)).size, 2);
  assert.equal(new Set(capacity.activities.map((activity) => activity.category)).size, 2);

  const ownerRange = screen.getByRole("combobox", { name: "Owner intervention range" });
  await user.selectOptions(ownerRange, "owner-3-5-weekly");
  assert.equal(ownerRange.value, "owner-3-5-weekly");
  assert.equal(
    capacity.activities.find((activity) => activity.category === "owner")
      .hoursPerOccurrence,
    4,
  );
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
    within(screen.getByRole("list", { name: "Evidence-backed findings" })).getAllByRole("listitem")
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
    "Operating findings",
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
