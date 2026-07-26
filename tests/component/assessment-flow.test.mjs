import assert from "node:assert/strict";
import test from "node:test";
import "./setup.mjs";

const React = await import("react");
const { cleanup, render, screen, within } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
const { AssessmentFlow } = await import("../../app/assessment/AssessmentFlow.tsx");
const { SESSION_KEY } = await import("../../lib/assessment/session.ts");

const validStoredAnswers = {
  employeeBand: "20-49",
  managerBand: "3-5",
  revenueBand: "5m-20m",
  role: "Owner-operator",
  coreSystemCount: "one",
  organizationShape: "singleTeam",
  relationshipLedByOwner: false,
  restrictedMarket: false,
  scored: { criticalDecisions: 75 },
  capacity: { source: "none", activities: [] },
};

const renderAssessment = () => render(React.createElement(AssessmentFlow));

const fillRequiredSelects = async (user) => {
  await user.selectOptions(screen.getByRole("combobox", { name: "Employees" }), "20-49");
  await user.selectOptions(screen.getByRole("combobox", { name: "People managers" }), "3-5");
  await user.selectOptions(screen.getByRole("combobox", { name: "Annual revenue" }), "5m-20m");
  await user.selectOptions(screen.getByRole("combobox", { name: "Your role" }), "Owner-operator");
};

const fillRequiredContext = async (
  user,
  {
    relationshipLedByOwner = false,
    multipleTeams = false,
    multipleSystems = false,
  } = {},
) => {
  await fillRequiredSelects(user);
  await user.click(
    screen.getByRole("radio", {
      name: multipleSystems ? "Two or more systems" : "One primary system",
    }),
  );
  await user.click(
    screen.getByRole("radio", {
      name: multipleTeams ? "Multiple teams or locations" : "One operating team",
    }),
  );

  if (relationshipLedByOwner) {
    await user.click(
      screen.getByRole("checkbox", {
        name: /key customer, supplier, or partner relationships/i,
      }),
    );
  }
};

const answerCurrentQuestion = async (user, optionIndex = 0) => {
  const question = screen.getByRole("group");
  const options = within(question).getAllByRole("radio");
  await user.click(options[optionIndex]);
  const next = screen.getByRole("button", { name: /continue|complete assessment/i });
  assert.equal(next.disabled, false);
  await user.click(next);
};

const finishAssessment = async (user, seenPrompts = []) => {
  let safety = 0;
  while (!screen.queryByRole("heading", { name: "Your operating picture is ready." })) {
    const question = screen.getByRole("group");
    seenPrompts.push(question.textContent);
    await answerCurrentQuestion(user);
    safety += 1;
    assert.ok(safety <= 18, "assessment should complete within 18 scored questions");
  }
};

test.afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

test("the six required context fields gate entry to scored questions", async () => {
  const user = userEvent.setup();
  renderAssessment();

  assert.equal(document.activeElement, document.body);
  await user.click(screen.getByRole("button", { name: "Start the assessment" }));

  assert.equal(screen.getAllByRole("combobox").length, 4);
  assert.ok(screen.getByRole("group", { name: "Core operating systems" }));
  assert.ok(screen.getByRole("group", { name: "Organization shape" }));
  const continueButton = screen.getByRole("button", { name: "Continue" });
  assert.equal(continueButton.disabled, true);

  await fillRequiredSelects(user);
  assert.equal(continueButton.disabled, true);
  await user.click(screen.getByRole("radio", { name: "One primary system" }));
  assert.equal(continueButton.disabled, true);
  await user.click(screen.getByRole("radio", { name: "One operating team" }));
  assert.equal(continueButton.disabled, false);
});

test("an unanswered scored question keeps Continue disabled", async () => {
  const user = userEvent.setup();
  renderAssessment();
  await user.click(screen.getByRole("button", { name: "Start the assessment" }));
  await fillRequiredContext(user);
  await user.click(screen.getByRole("button", { name: "Continue" }));

  const continueButton = screen.getByRole("button", { name: "Continue" });
  assert.equal(continueButton.disabled, true);
  await user.click(within(screen.getByRole("group")).getAllByRole("radio")[0]);
  assert.equal(continueButton.disabled, false);
});

test("conditional questions stay absent when their context conditions do not apply", async () => {
  const user = userEvent.setup();
  const seenPrompts = [];
  renderAssessment();
  await user.click(screen.getByRole("button", { name: "Start the assessment" }));
  await fillRequiredContext(user);
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await finishAssessment(user, seenPrompts);

  assert.equal(seenPrompts.length, 15);
  const allPrompts = seenPrompts.join("\n");
  assert.doesNotMatch(allPrompts, /dependent are key external relationships/i);
  assert.doesNotMatch(allPrompts, /consistently do teams execute shared critical workflows/i);
  assert.doesNotMatch(allPrompts, /reliably does critical information move between systems/i);
});

test("all three conditional questions appear when their context conditions apply", async () => {
  const user = userEvent.setup();
  const seenPrompts = [];
  renderAssessment();
  await user.click(screen.getByRole("button", { name: "Start the assessment" }));
  await fillRequiredContext(user, {
    relationshipLedByOwner: true,
    multipleTeams: true,
    multipleSystems: true,
  });
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await finishAssessment(user, seenPrompts);

  assert.equal(seenPrompts.length, 18);
  const allPrompts = seenPrompts.join("\n");
  assert.match(allPrompts, /dependent are key external relationships/i);
  assert.match(allPrompts, /consistently do teams execute shared critical workflows/i);
  assert.match(allPrompts, /reliably does critical information move between systems/i);
});

test("Back and Review answers retain scored selections", async () => {
  const user = userEvent.setup();
  renderAssessment();
  await user.click(screen.getByRole("button", { name: "Start the assessment" }));
  await fillRequiredContext(user);
  await user.click(screen.getByRole("button", { name: "Continue" }));

  const selectedOption = within(screen.getByRole("group")).getAllByRole("radio")[2];
  const selectedLabel = selectedOption.closest("label").textContent;
  await user.click(selectedOption);
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Back" }));
  assert.equal(screen.getByRole("radio", { name: selectedLabel }).checked, true);

  await user.click(screen.getByRole("button", { name: "Continue" }));
  await finishAssessment(user);
  await user.click(screen.getByRole("button", { name: "Review answers" }));
  assert.equal(screen.getByRole("radio", { name: selectedLabel }).checked, true);
});

test("a valid session reloads while a malformed session falls back to empty context", async () => {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(validStoredAnswers));
  const firstRender = renderAssessment();
  let user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Start the assessment" }));
  assert.equal(screen.getByRole("combobox", { name: "Employees" }).value, "20-49");
  assert.equal(screen.getByRole("button", { name: "Continue" }).disabled, false);
  await user.click(screen.getByRole("button", { name: "Continue" }));
  assert.equal(
    screen.getByRole("radio", {
      name: "Most decisions are delegated within understood limits",
    }).checked,
    true,
  );
  firstRender.unmount();

  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ ...validStoredAnswers, scored: null }),
  );
  renderAssessment();
  user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Start the assessment" }));
  assert.equal(screen.getByRole("combobox", { name: "Employees" }).value, "");
  assert.equal(screen.getByRole("button", { name: "Continue" }).disabled, true);
});

test("progress exposes bounded values and question position semantics", async () => {
  const user = userEvent.setup();
  renderAssessment();

  const progress = screen.getByRole("progressbar");
  assert.equal(progress.getAttribute("aria-valuenow"), "0");
  await user.click(screen.getByRole("button", { name: "Start the assessment" }));
  assert.equal(progress.getAttribute("aria-valuenow"), "5");

  await fillRequiredContext(user);
  await user.click(screen.getByRole("button", { name: "Continue" }));
  assert.match(progress.getAttribute("aria-valuetext"), /question 1 of 15/i);
  await finishAssessment(user);
  assert.equal(progress.getAttribute("aria-valuenow"), "100");
  assert.match(progress.getAttribute("aria-valuetext"), /preliminary result, 100 percent/i);
});

test("focus moves for Start, Continue, Back, component changes, completion, and Review", async () => {
  const user = userEvent.setup();
  renderAssessment();
  const step = screen.getByRole("region", { name: "Assessment step" });

  assert.equal(document.activeElement, document.body);
  await user.click(screen.getByRole("button", { name: "Start the assessment" }));
  assert.equal(document.activeElement, step);

  await fillRequiredContext(user);
  await user.click(screen.getByRole("button", { name: "Continue" }));
  assert.equal(document.activeElement, step);

  await answerCurrentQuestion(user);
  assert.equal(document.activeElement, step);
  await user.click(screen.getByRole("button", { name: "Back" }));
  assert.equal(document.activeElement, step);

  await user.click(screen.getByRole("button", { name: "Continue" }));
  for (let question = 1; question < 5; question += 1) {
    await answerCurrentQuestion(user);
    assert.equal(document.activeElement, step);
  }
  assert.match(step.textContent, /Operating system/i);

  await finishAssessment(user);
  assert.equal(document.activeElement, step);
  await user.click(screen.getByRole("button", { name: "Review answers" }));
  assert.equal(document.activeElement, step);
});
