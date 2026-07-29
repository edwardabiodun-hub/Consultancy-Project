import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import "./setup.mjs";

const React = await import("react");
const { cleanup, render, screen, waitFor, within } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
const { AssessmentFlow } = await import("../../app/assessment/AssessmentFlow.tsx");
const { buildAssessmentResult } = await import("../../lib/assessment/result.ts");
const { SESSION_KEY } = await import("../../lib/assessment/session.ts");
const assessmentFlowSource = await readFile(
  new URL("../../app/assessment/AssessmentFlow.tsx", import.meta.url),
  "utf8",
);

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

const successfulCalculationFetch = async (_input, init) => {
  const payload = JSON.parse(String(init?.body));
  return Response.json({
    ok: true,
    assessmentId: "123e4567-e89b-42d3-a456-426614174000",
    result: buildAssessmentResult(payload.answers),
  });
};

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

const finishAssessment = async (user, seenPrompts = [], optionIndex = 0) => {
  let safety = 0;
  while (!screen.queryByRole("button", { name: "Unlock my full assessment" })) {
    const question = screen.getByRole("group");
    seenPrompts.push(question.textContent);
    await answerCurrentQuestion(user, optionIndex);
    safety += 1;
    assert.ok(safety <= 18, "assessment should complete within 18 scored questions");
  }
};

const reachPreliminary = async (
  user,
  { optionIndex = 0, restricted = false, banded = false } = {},
) => {
  await user.click(screen.getByRole("button", { name: "Start the assessment" }));
  await fillRequiredContext(user);
  if (restricted) {
    await user.click(
      screen.getByRole("checkbox", {
        name: /market where employment, confidentiality, or conflict obligations/i,
      }),
    );
  }
  if (banded) {
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Owner intervention range" }),
      "owner-1-2-weekly",
    );
    await user.selectOptions(
      screen.getByRole("combobox", {
        name: "Team reporting and reconciliation range",
      }),
      "reporting-2-4-monthly",
    );
  }
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await finishAssessment(user, [], optionIndex);
};

const submitLead = async (user) => {
  await user.click(screen.getByRole("button", { name: "Unlock my full assessment" }));
  await user.type(screen.getByRole("textbox", { name: "Name" }), "Eddie Example");
  await user.type(screen.getByRole("textbox", { name: "Work email" }), "eddie@example.com");
  await user.type(screen.getByRole("textbox", { name: "Company" }), "Example Co");
  await user.click(
    screen.getByRole("checkbox", { name: /generate and email my assessment report/i }),
  );
  await user.click(screen.getByRole("button", { name: "Continue to full assessment" }));
};

test.afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

test.beforeEach(() => {
  globalThis.fetch = successfulCalculationFetch;
});

test("the six required context fields gate entry to scored questions", async () => {
  const user = userEvent.setup();
  renderAssessment();

  assert.equal(document.activeElement, document.body);
  await user.click(screen.getByRole("button", { name: "Start the assessment" }));

  assert.equal(screen.getAllByRole("combobox").length, 7);
  assert.ok(screen.getByRole("combobox", { name: "Owner intervention range" }));
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
  await user.click(screen.getByRole("button", { name: "Review my answers" }));
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
  await user.click(screen.getByRole("button", { name: "Review my answers" }));
  assert.equal(document.activeElement, step);
});

test("valid contact details unlock the full result when precision is skipped", async () => {
  const user = userEvent.setup();
  renderAssessment();
  const step = screen.getByRole("region", { name: "Assessment step" });

  await reachPreliminary(user);

  assert.ok(screen.getByRole("heading", { name: "0 out of 100" }));
  assert.equal(document.body.textContent.includes("$"), false);
  await submitLead(user);
  assert.ok(screen.getByRole("heading", { name: "Improve the capacity estimate." }));
  assert.equal(document.activeElement, step);
  await user.click(
    screen.getByRole("button", { name: "Continue without a financial range" }),
  );

  assert.match(screen.getByRole("status").textContent, /recalculating scores/i);
  await screen.findByRole("heading", { name: "0 out of 100" });
  assert.equal(document.activeElement, step);
  assert.equal(
    within(screen.getByRole("list", { name: "Component scores" })).getAllByRole("listitem")
      .length,
    3,
  );
  assert.match(document.body.textContent, /No financial estimate is available/i);
  assert.match(document.body.textContent, /Unavailable estimate · Low impact confidence/i);
  assert.equal(document.body.textContent.includes("$"), false);
  assert.ok(
    screen.getByRole("link", { name: "Discuss the Business Independence Diagnostic" }),
  );
});

test("exact precision produces calculated high-confidence capacity in the integrated flow", async () => {
  const user = userEvent.setup();
  renderAssessment();
  await reachPreliminary(user);
  await submitLead(user);

  const owner = screen.getByRole("group", { name: "Owner intervention" });
  const reporting = screen.getByRole("group", {
    name: "Team reporting and reconciliation",
  });
  for (const [group, values] of [
    [owner, ["2", "12", "100"]],
    [reporting, ["3", "4", "12", "50"]],
  ]) {
    const fields = within(group).getAllByRole("spinbutton");
    for (let index = 0; index < values.length; index += 1) {
      await user.type(fields[index], values[index]);
    }
  }
  await user.click(screen.getByRole("button", { name: "Calculate with exact inputs" }));

  assert.match(screen.getByRole("status").textContent, /recalculating scores/i);
  await screen.findByRole("heading", { name: "0 out of 100" });
  assert.match(document.body.textContent, /Calculated estimate · High impact confidence/i);
  assert.match(document.body.textContent, /\$4,800/);
  assert.match(document.body.textContent, /\$6,720/);
  assert.ok(
    screen.getByRole("link", { name: "Discuss the Business Independence Diagnostic" }),
  );
});

test("earlier banded ranges produce a directional medium-confidence result", async () => {
  const user = userEvent.setup();
  renderAssessment();
  await reachPreliminary(user, { banded: true });

  assert.equal(document.body.textContent.includes("$"), false);
  await submitLead(user);
  await user.click(screen.getByRole("button", { name: "Use my earlier ranges" }));

  assert.match(screen.getByRole("status").textContent, /recalculating scores/i);
  await screen.findByRole("heading", { name: "0 out of 100" });
  assert.match(document.body.textContent, /Directional estimate · Medium impact confidence/i);
  assert.match(document.body.textContent, /\$4,620/);
  assert.match(document.body.textContent, /\$7,260/);
  assert.match(document.body.textContent, /midpoints of selected self-reported bands/i);
});

test("restricted integrated results suppress the consulting route", async () => {
  const user = userEvent.setup();
  renderAssessment();
  await reachPreliminary(user, { restricted: true });
  await submitLead(user);
  await user.click(
    screen.getByRole("button", { name: "Continue without a financial range" }),
  );
  await screen.findByRole("heading", { name: "0 out of 100" });

  assert.ok(
    screen.getByRole("link", { name: "Explore educational founder resources" }),
  );
  assert.equal(
    screen.queryByRole("link", { name: /Business Independence Diagnostic/i }),
    null,
  );
});

test("Back from contact and precision retains contact and assessment state", async () => {
  const user = userEvent.setup();
  renderAssessment();
  await reachPreliminary(user, { banded: true });
  await user.click(screen.getByRole("button", { name: "Unlock my full assessment" }));
  await user.type(screen.getByRole("textbox", { name: "Name" }), "Eddie Example");
  await user.click(screen.getByRole("button", { name: "Back" }));
  await user.click(screen.getByRole("button", { name: "Unlock my full assessment" }));
  assert.equal(screen.getByRole("textbox", { name: "Name" }).value, "Eddie Example");

  await user.type(screen.getByRole("textbox", { name: "Work email" }), "eddie@example.com");
  await user.type(screen.getByRole("textbox", { name: "Company" }), "Example Co");
  await user.click(
    screen.getByRole("checkbox", { name: /generate and email my assessment report/i }),
  );
  await user.click(screen.getByRole("button", { name: "Continue to full assessment" }));
  assert.ok(screen.getByRole("button", { name: "Use my earlier ranges" }));
  const ownerPrecision = screen.getByRole("group", { name: "Owner intervention" });
  const reportingPrecision = screen.getByRole("group", {
    name: "Team reporting and reconciliation",
  });
  const ownerPrecisionFields = within(ownerPrecision).getAllByRole("spinbutton");
  const reportingPrecisionFields = within(reportingPrecision).getAllByRole("spinbutton");
  await user.type(ownerPrecisionFields[0], "2.5");
  await user.type(ownerPrecisionFields[1], "12");
  await user.type(reportingPrecisionFields[0], "3");
  await user.type(reportingPrecisionFields[1], "4.5");
  await user.click(screen.getByRole("button", { name: "Back" }));

  assert.equal(screen.getByRole("textbox", { name: "Name" }).value, "Eddie Example");
  assert.equal(
    screen.getByRole("textbox", { name: "Work email" }).value,
    "eddie@example.com",
  );
  assert.equal(screen.getByRole("textbox", { name: "Company" }).value, "Example Co");
  assert.equal(
    screen.getByRole("checkbox", {
      name: /generate and email my assessment report/i,
    }).checked,
    true,
  );
  await user.click(screen.getByRole("button", { name: "Continue to full assessment" }));
  const retainedOwner = within(
    screen.getByRole("group", { name: "Owner intervention" }),
  ).getAllByRole("spinbutton");
  const retainedReporting = within(
    screen.getByRole("group", { name: "Team reporting and reconciliation" }),
  ).getAllByRole("spinbutton");
  assert.equal(retainedOwner[0].value, "2.5");
  assert.equal(retainedOwner[1].value, "12");
  assert.equal(retainedReporting[0].value, "3");
  assert.equal(retainedReporting[1].value, "4.5");
});

test("strong integrated results present strengths and an insights route", async () => {
  const user = userEvent.setup();
  renderAssessment();
  await reachPreliminary(user, { optionIndex: 4 });
  await submitLead(user);
  await user.click(
    screen.getByRole("button", { name: "Continue without a financial range" }),
  );
  await screen.findByRole("heading", { name: "100 out of 100" });

  assert.match(document.body.textContent, /Strong independence is indicated/i);
  const findings = within(
    screen.getByRole("list", { name: "Evidence-backed findings" }),
  ).getAllByRole("listitem");
  assert.equal(findings.length, 3);
  assert.ok(findings.every((finding) => /strength/i.test(finding.textContent)));
  assert.doesNotMatch(
    findings.map((finding) => finding.textContent).join(" "),
    /owner_bottleneck|operating_system_gap|information_bottleneck/,
  );
  assert.ok(
    screen.getByRole("link", { name: "Explore executive operating insights" }),
  );
  assert.equal(
    screen.queryByRole("link", { name: /Business Independence Diagnostic/i }),
    null,
  );
});

test("full assessment renders the server result and sends only raw answers and lead details", async () => {
  let submittedPayload;
  globalThis.fetch = async (input, init) => {
    // The analytics beacon (POST /api/assessment/events) shares the fetch
    // mock in this test environment; only /api/assessment/calculate carries
    // the answers/lead payload under assertion here.
    if (!String(input).includes("/api/assessment/calculate")) {
      return Response.json({ ok: true }, { status: 202 });
    }
    submittedPayload = JSON.parse(String(init?.body));
    const serverAnswers = {
      ...submittedPayload.answers,
      scored: Object.fromEntries(
        Object.keys(submittedPayload.answers.scored).map((questionId) => [
          questionId,
          100,
        ]),
      ),
    };
    return Response.json({
      ok: true,
      assessmentId: "123e4567-e89b-42d3-a456-426614174000",
      result: buildAssessmentResult(serverAnswers),
    });
  };
  const user = userEvent.setup();
  renderAssessment();
  await reachPreliminary(user);
  await submitLead(user);
  await user.click(
    screen.getByRole("button", { name: "Continue without a financial range" }),
  );

  await screen.findByRole("heading", { name: "100 out of 100" });
  assert.deepEqual(Object.keys(submittedPayload).sort(), ["answers", "lead"]);
  assert.equal(submittedPayload.answers.scored.criticalDecisions, 0);
  assert.equal(submittedPayload.answers.capacity.source, "none");
  assert.deepEqual(submittedPayload.answers.capacity.activities, []);
  assert.deepEqual(submittedPayload.lead, {
    name: "Eddie Example",
    workEmail: "eddie@example.com",
    company: "Example Co",
    phone: "",
    reportConsent: true,
    marketingConsent: false,
  });
});

test("server failure retains the local rules result and reports unavailable persistence", async () => {
  globalThis.fetch = async () => {
    throw new Error("network unavailable");
  };
  const user = userEvent.setup();
  renderAssessment();
  await reachPreliminary(user);
  await submitLead(user);
  await user.click(
    screen.getByRole("button", { name: "Continue without a financial range" }),
  );

  await screen.findByRole("heading", { name: "0 out of 100" });
  assert.match(
    screen.getByRole("status").textContent,
    /your result is available on screen, but report storage and delivery are temporarily unavailable/i,
  );
});

test("a structured 422 returns to precision without rendering a result or server error values", async () => {
  globalThis.fetch = async () =>
    Response.json(
      {
        ok: false,
        errors: {
          "answers.capacity.activities.0.hourlyCost":
            "Private Person private.person@example.com",
        },
      },
      { status: 422 },
    );
  const user = userEvent.setup();
  renderAssessment();
  await reachPreliminary(user);
  await submitLead(user);
  await user.click(
    screen.getByRole("button", { name: "Continue without a financial range" }),
  );

  await screen.findByRole("heading", { name: "Improve the capacity estimate." });
  assert.equal(
    screen.queryByRole("heading", { name: "0 out of 100" }),
    null,
  );
  assert.doesNotMatch(
    document.body.textContent,
    /report storage and delivery are temporarily unavailable/i,
  );
  assert.doesNotMatch(
    document.body.textContent,
    /Private Person|private\.person@example\.com/i,
  );
  assert.match(
    screen.getByRole("alert").textContent,
    /could not validate the capacity inputs/i,
  );
});

test("a 5xx response retains the valid local result with the outage warning", async () => {
  globalThis.fetch = async () =>
    Response.json({ ok: false }, { status: 503 });
  const user = userEvent.setup();
  renderAssessment();
  await reachPreliminary(user);
  await submitLead(user);
  await user.click(
    screen.getByRole("button", { name: "Continue without a financial range" }),
  );

  await screen.findByRole("heading", { name: "0 out of 100" });
  assert.match(
    screen.getByRole("status").textContent,
    /report storage and delivery are temporarily unavailable/i,
  );
});

test("the persisted result renders before one deferred narrative request upgrades its interpretation", async () => {
  let calculationPayload;
  let narrativePayload;
  let narrativeRequests = 0;
  let resolveNarrative;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/api/assessment/calculate")) {
      calculationPayload = JSON.parse(String(init?.body));
      return Response.json({
        ok: true,
        assessmentId: "123e4567-e89b-42d3-a456-426614174000",
        persistenceAvailable: true,
        result: buildAssessmentResult(calculationPayload.answers),
      });
    }
    if (url.includes("/narrative")) {
      narrativeRequests += 1;
      narrativePayload = JSON.parse(String(init?.body));
      return new Promise((resolve) => {
        resolveNarrative = resolve;
      });
    }
    return Response.json({ ok: true }, { status: 202 });
  };

  const user = userEvent.setup();
  renderAssessment();
  await reachPreliminary(user);
  await submitLead(user);
  await user.click(
    screen.getByRole("button", { name: "Continue without a financial range" }),
  );

  await screen.findByRole("heading", { name: "0 out of 100" });
  const rulesSummary = buildAssessmentResult(calculationPayload.answers).narrative.summary;
  assert.ok(screen.getByText(rulesSummary));
  assert.match(screen.getByRole("status").textContent, /preparing a validated narrative/i);
  await waitFor(() => assert.ok(narrativePayload));
  assert.deepEqual(narrativePayload, {
    answers: calculationPayload.answers,
    lead: calculationPayload.lead,
  });
  assert.equal(narrativeRequests, 1);

  resolveNarrative(
    Response.json({
      ok: true,
      narrative: { source: "ai", text: "Validated operating interpretation." },
    }),
  );

  await screen.findByText("Validated operating interpretation.");
  await waitFor(() => assert.equal(screen.queryByRole("status"), null));
  assert.equal(narrativeRequests, 1);
});

test("a failed narrative request preserves the rules interpretation and clears loading", async () => {
  let deterministicResult;
  let narrativeRequests = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/api/assessment/calculate")) {
      const payload = JSON.parse(String(init?.body));
      deterministicResult = buildAssessmentResult(payload.answers);
      return Response.json({
        ok: true,
        assessmentId: "123e4567-e89b-42d3-a456-426614174000",
        persistenceAvailable: true,
        result: deterministicResult,
      });
    }
    if (url.includes("/narrative")) {
      narrativeRequests += 1;
      return Response.json({ ok: false }, { status: 503 });
    }
    return Response.json({ ok: true }, { status: 202 });
  };

  const user = userEvent.setup();
  renderAssessment();
  await reachPreliminary(user);
  await submitLead(user);
  await user.click(
    screen.getByRole("button", { name: "Continue without a financial range" }),
  );

  await screen.findByRole("heading", { name: "0 out of 100" });
  await waitFor(() => assert.equal(screen.queryByRole("status"), null));
  assert.ok(screen.getByText(deterministicResult.narrative.summary));
  assert.ok(screen.getByText("Rules-based"));
  assert.equal(narrativeRequests, 1);
});

test("a fresh assessment aborts the prior narrative and rejects its stale resolution", async () => {
  let calculationRequests = 0;
  let narrativeRequests = 0;
  let firstNarrativeSignal;
  let resolveFirstNarrative;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/api/assessment/calculate")) {
      calculationRequests += 1;
      const payload = JSON.parse(String(init?.body));
      return Response.json({
        ok: true,
        assessmentId: `123e4567-e89b-42d3-a456-42661417400${calculationRequests}`,
        persistenceAvailable: true,
        result: buildAssessmentResult(payload.answers),
      });
    }
    if (url.includes("/narrative")) {
      narrativeRequests += 1;
      if (narrativeRequests === 1) {
        firstNarrativeSignal = init?.signal;
        return new Promise((resolve) => {
          resolveFirstNarrative = resolve;
        });
      }
      return Response.json({
        ok: true,
        narrative: { source: "ai", text: "Interpretation for the fresh assessment." },
      });
    }
    return Response.json({ ok: true }, { status: 202 });
  };

  const firstUser = userEvent.setup();
  renderAssessment();
  await reachPreliminary(firstUser);
  await submitLead(firstUser);
  await firstUser.click(
    screen.getByRole("button", { name: "Continue without a financial range" }),
  );
  await screen.findByRole("heading", { name: "0 out of 100" });
  await waitFor(() => assert.equal(narrativeRequests, 1));

  cleanup();
  sessionStorage.clear();
  assert.equal(firstNarrativeSignal?.aborted, true);

  const secondUser = userEvent.setup();
  renderAssessment();
  await reachPreliminary(secondUser);
  await submitLead(secondUser);
  await secondUser.click(
    screen.getByRole("button", { name: "Continue without a financial range" }),
  );
  await screen.findByText("Interpretation for the fresh assessment.");

  resolveFirstNarrative(
    Response.json({
      ok: true,
      narrative: { source: "ai", text: "Stale interpretation from the prior assessment." },
    }),
  );

  await new Promise((resolve) => window.setTimeout(resolve, 0));
  assert.equal(screen.queryByText("Stale interpretation from the prior assessment."), null);
  assert.ok(screen.getByText("Interpretation for the fresh assessment."));
  assert.equal(calculationRequests, 2);
  assert.equal(narrativeRequests, 2);
});
test("both mounted calculation-entry handlers reset narrative state before processing", () => {
  assert.match(
    assessmentFlowSource,
    /const continueWithCapacity = \(capacity: CapacityInputs\) => \{[\s\S]*?resetNarrativeState\(\);[\s\S]*?setScreen\("processing"\);[\s\S]*?\};/,
  );
  assert.match(
    assessmentFlowSource,
    /onUseEarlierRanges=\{\(\) => \{[\s\S]*?resetNarrativeState\(\);[\s\S]*?setScreen\("processing"\);[\s\S]*?\}\}/,
  );
});
test("unpersisted or unidentified results do not request narratives", async () => {
  for (const calculationResponse of [
    { persistenceAvailable: false, assessmentId: "123e4567-e89b-42d3-a456-426614174000" },
    { persistenceAvailable: true },
  ]) {
    let narrativeRequests = 0;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("/api/assessment/calculate")) {
        const payload = JSON.parse(String(init?.body));
        return Response.json({
          ok: true,
          ...calculationResponse,
          result: buildAssessmentResult(payload.answers),
        });
      }
      if (url.includes("/narrative")) narrativeRequests += 1;
      return Response.json({ ok: true }, { status: 202 });
    };

    const user = userEvent.setup();
    renderAssessment();
    await reachPreliminary(user);
    await submitLead(user);
    await user.click(
      screen.getByRole("button", { name: "Continue without a financial range" }),
    );
    await screen.findByRole("heading", { name: "0 out of 100" });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.equal(narrativeRequests, 0);
    cleanup();
    sessionStorage.clear();
  }
});