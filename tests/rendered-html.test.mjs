import assert from "node:assert/strict";
import test from "node:test";

async function request(path = "/", init, env = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
      ...env,
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

const validAssessmentPayload = (overrides = {}) => ({
  answers: {
    employeeBand: "20-49",
    managerBand: "3-5",
    revenueBand: "5m-20m",
    role: "Owner-operator",
    coreSystemCount: "one",
    organizationShape: "singleTeam",
    relationshipLedByOwner: false,
    restrictedMarket: false,
    scored: {
      criticalDecisions: 0,
      twoWeekAbsence: 0,
      managerAuthority: 0,
      exceptionResolution: 0,
      workWaiting: 0,
      workflowDocumentation: 0,
      processOwnership: 0,
      decisionRules: 0,
      crossTraining: 0,
      managementCadence: 0,
      kpiAvailability: 0,
      manualReporting: 0,
      dataTrust: 0,
      detectionSpeed: 0,
      kpiCadence: 0,
    },
    capacity: { source: "none", activities: [] },
    ...overrides.answers,
  },
  lead: {
    name: "Eddie Example",
    workEmail: "eddie@example.com",
    company: "Example Co",
    reportConsent: true,
    marketingConsent: false,
    ...overrides.lead,
  },
  ...Object.fromEntries(
    Object.entries(overrides).filter(([key]) => !["answers", "lead"].includes(key)),
  ),
});

test("renders the founder-independence homepage and six-page navigation", async () => {
  const response = await request("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Build a business that can grow/);
  assert.match(html, /Decision Margin/);
  for (const href of [
    "/diagnostic",
    "/how-i-help#dependency",
    "/founder-resources",
    "/about",
    "/contact",
  ]) {
    assert.match(html, new RegExp(`href="${href}"`));
  }
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("renders the accessible RunRate Advisory identity in the shared site chrome", async () => {
  const response = await request("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /src="\/brand\/runrate-icon\.svg"/);
  assert.match(html, /width="76"[^>]+height="76"/);
  assert.match(html, />RUNRATE</);
  assert.match(html, />ADVISORY</);
  assert.match(html, /aria-label="RunRate Advisory home"/);
  assert.doesNotMatch(html, /EA Advisory|Edward Abiodun Advisory/);
});

test("orders shared header navigation around education before assessment", async () => {
  const response = await request("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  const header = html.match(/<header[\s\S]*?<\/header>/)?.[0];
  assert.ok(header);

  const labels = [
    "Reduce Owner Dependency",
    "Improve Executive Decisions",
    "Automate Manual Operations",
    "Insights",
    "About Eddie",
    "Take the assessment",
    "Start a Conversation",
  ];
  const positions = labels.map((label) => header.indexOf(label));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((left, right) => left - right), positions);

  assert.match(html, /href="\/how-i-help#dependency"[^>]*>Reduce Owner Dependency/);
  assert.match(html, /href="\/how-i-help#decisions"[^>]*>Improve Executive Decisions/);
  assert.match(html, /href="\/how-i-help#automation"[^>]*>Automate Manual Operations/);
});

test("renders every primary route with unique substantive content", async () => {
  const routes = new Map([
    ["/diagnostic", /10 business days/],
    ["/how-i-help", /Improve executive decisions/],
    ["/founder-resources", /Build a Business That Runs Without You/],
    ["/about", /The perspective behind the work/],
    ["/contact", /Decisions or operational dependencies/],
  ]);
  for (const [path, expected] of routes) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), expected, path);
  }
});

test("renders the human-led About Eddie page with professional proof", async () => {
  const response = await request("/about");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Clearer decisions\. Stronger operating systems\. Less dependence on one person\./);
  assert.match(html, /src="\/edward-abiodun-identity-locked\.png"/);
  assert.match(html, /alt="Edward Abiodun"/);
  assert.match(html, /linkedin\.com\/in\/edward-abiodun-09600a10/);
  assert.match(html, /Christoph Brand/);
  assert.match(html, /Christian Bischof/);
  assert.match(html, /does not use confidential employer information/i);
  assert.match(html, /Start a focused conversation/);
  assert.match(html, /See the diagnostic/);
});

test("renders the premium advisory positioning and staged client journey", async () => {
  const response = await request("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /grow without routing every important decision through the owner/i);
  assert.match(html, /Reduce Owner Dependency/);
  assert.match(html, /Improve Executive Decisions/);
  assert.match(html, /Automate Manual Operations/);
  assert.match(html, /Diagnose/);
  assert.match(html, /Build/);
  assert.match(html, /Sustain/);
  assert.match(html, /continuation paths/i);
  assert.doesNotMatch(html, /\$3,500|fixed-scope pilot|three pilot clients/i);
});

test("renders a defensible two-week Business Independence Diagnostic", async () => {
  const response = await request("/diagnostic");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /In two weeks, identify where your business still depends on you/i);
  assert.match(html, /estimate the operational cost/i);
  assert.match(html, /Investment is confirmed after an initial discovery conversation/i);
  assert.match(html, /Founder intervention time/);
  assert.match(html, /Decision and approval delays/);
  assert.match(html, /available when the findings justify/i);
  assert.doesNotMatch(html, /\$3,500|fixed-scope pilot|three pilot clients/i);
});

test("renders qualification fields for a focused discovery conversation", async () => {
  const response = await request("/contact");
  assert.equal(response.status, 200);
  const html = await response.text();
  for (const field of ["managerCount", "ownerHours", "reportingMaturity", "timeframe"]) {
    assert.match(html, new RegExp(`name="${field}"`));
  }
  assert.match(html, /Discuss your business dependency/);
});

test("uses the new advisory naming across supporting routes", async () => {
  for (const path of [
    "/about",
    "/founder-resources",
    "/founder-resources/business-that-lives-in-your-head",
    "/contact/thank-you",
  ]) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.doesNotMatch(html, /Owner Independence Diagnostic|Explore Founder Resources/i, path);
  }
});

test("renders the Business Independence Assessment entry experience", async () => {
  const response = await request("/assessment");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /How independently can your business operate/i);
  assert.match(html, /approximately five minutes/i);
  assert.match(html, /deterministic scoring/i);
  assert.match(html, /Start the assessment/i);
});

test("renders a guided illustrative assessment result without requiring submission", async () => {
  const response = await request("/assessment");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /Illustrative example/);
  assert.match(html, /58[\s\S]*?\/100/);
  assert.match(html, /Assessment confidence[\s\S]*Medium/);
  assert.match(html, /Owner Dependency/);
  assert.match(html, /Operating-System Maturity/);
  assert.match(html, /Information Visibility/);
  assert.match(html, /Owner capacity[\s\S]*12 to 18 hours per month/);
  assert.match(
    html,
    /directional and illustrative[\s\S]*not an audit, valuation, financial opinion, benchmark, or promise/i,
  );
});


test("insight Explore links render the provided article and guide drafts", async () => {
  const executiveResponse = await request("/founder-resources/executive-reports-that-drive-action");
  assert.equal(executiveResponse.status, 200);
  const executiveHtml = await executiveResponse.text();
  assert.match(executiveHtml, /The executive reporting trap/i);
  assert.match(executiveHtml, /Last-Minute Assembly Tax/i);
  assert.match(executiveHtml, /Build an automated truth engine/i);
  assert.match(executiveHtml, /Executive rule/i);
  assert.match(executiveHtml, /Historical reporting/i);
  assert.match(executiveHtml, /Decision-driven reporting/i);
  assert.match(executiveHtml, /\/insights\/stuck-in-reporting-trap\.png/);
  assert.match(executiveHtml, /\/insights\/rearview-mirror-management\.png/);
  assert.match(executiveHtml, /\/insights\/signal-or-management-noise\.png/);
  assert.match(executiveHtml, /\/insights\/automated-visibility-plan\.png/);

  const automationResponse = await request("/founder-resources/automation-before-ai");
  assert.equal(automationResponse.status, 200);
  const automationHtml = await automationResponse.text();
  assert.match(automationHtml, /The automation trap/i);
  assert.match(automationHtml, /The pre-automation blueprint/i);
  assert.match(automationHtml, /Technology scales process quality/i);
  assert.match(automationHtml, /Operational warning/i);
  assert.match(automationHtml, /Weak sequence/i);
  assert.match(automationHtml, /Stronger sequence/i);
  assert.match(automationHtml, /Map the real workflow/i);
  assert.match(automationHtml, /\/insights\/hidden-sources-operational-friction\.png/);
  assert.match(automationHtml, /\/insights\/pre-automation-blueprint\.png/);
  assert.match(automationHtml, /\/insights\/where-practical-ai-creates-value\.png/);
});
test("assessment and paid diagnostic remain separate, non-overlapping routes", async () => {
  const [diagnosticHtml, assessmentHtml] = await Promise.all([
    request("/diagnostic").then((response) => response.text()),
    request("/assessment").then((response) => response.text()),
  ]);
  assert.match(diagnosticHtml, /In two weeks, identify where your business still depends on you/i);
  assert.match(diagnosticHtml, /Investment is confirmed after an initial discovery conversation/i);
  assert.doesNotMatch(diagnosticHtml, /approximately five minutes|deterministic scoring|Start the assessment/i);

  assert.match(assessmentHtml, /How independently can your business operate\?/i);
  assert.match(assessmentHtml, /Start the assessment/i);
  assert.doesNotMatch(
    assessmentHtml,
    /In two weeks, identify where your business still depends on you|Investment is confirmed after an initial discovery conversation/i,
  );
});

test("privacy route describes complete R2 report retention, access limits, and deletion", async () => {
  const response = await request("/privacy");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(
    html,
    /complete assessment answers, report snapshot, generated PDF, and accepted AI\/rules narrative.*encrypted Cloudflare R2 storage/i,
  );
  assert.match(
    html,
    /stored in encrypted Cloudflare R2 storage for 90 days.*normally within 24 hours after the 90-day mark/i,
  );
  assert.match(html, /respondent report link and authorized RunRate follow-up/i);
  assert.match(
    html,
    /request deletion.*using the contact page/i,
  );
  assert.doesNotMatch(html, /raw answers.*not retained|full reports.*not retained/i);
});

test("assessment calculation succeeds whether or not the optional phone and marketing consent fields are provided", async (t) => {
  const fixtures = [
    { label: "no phone, marketing consent declined", lead: {} },
    {
      label: "phone provided, marketing consent accepted",
      lead: { phone: "+1 843 555 0100", marketingConsent: true },
    },
  ];

  for (const fixture of fixtures) {
    await t.test(fixture.label, async () => {
      const response = await request("/api/assessment/calculate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validAssessmentPayload({ lead: fixture.lead })),
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.ok, true);
    });
  }
});

test("a restricted-market submission's routed result never contains a consulting invitation", async () => {
  const response = await request("/api/assessment/calculate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(validAssessmentPayload({ answers: { restrictedMarket: true } })),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.result.interpretation.route, "restricted");
  assert.equal(body.result.cta.href, "/founder-resources");
  const commercialSurface = `${body.result.cta.label} ${body.result.cta.reason} ${body.result.narrative.summary}`;
  assert.doesNotMatch(commercialSurface, /consult|diagnostic|schedule a call|discovery conversation/i);
});

test("assessment calculation reports unavailable persistence without discarding the deterministic result", async () => {
  // In this build/test environment no D1 binding is configured (only ASSETS
  // is provided to worker.fetch), so this exercises the same
  // persistence-unavailable path that drives the client's "Print or save as
  // PDF" fallback copy (see FullResult.tsx and
  // tests/component/assessment-results.test.mjs "full result offers browser
  // print when report persistence is unavailable"). It also confirms the
  // methodologyVersion contract the "Methodology and limitations" section
  // relies on is present and correctly versioned.
  const response = await request("/api/assessment/calculate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(validAssessmentPayload()),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.persistenceAvailable, false);
  assert.equal(body.result.methodologyVersion, "1.0.0");
});

test("contact endpoint rejects invalid inquiries", async () => {
  const response = await request("/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "not-an-email", bottleneck: "Busy" }),
  });
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.ok(body.errors.email);
  assert.ok(body.errors.bottleneck);
});

test("contact endpoint does not claim delivery when email is not configured", async () => {
  const response = await request("/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Eddie Abiodun",
      email: "eddie@example.com",
      company: "Example Co",
      role: "Founder",
      managerCount: "3-5",
      ownerHours: "11-20 hours",
      reportingMaturity: "Mostly manual",
      timeframe: "Within 90 days",
      employeeCount: "25-100",
      bottleneck: "Too many operating decisions still depend on the founder.",
      desiredOutcome: "A practical operating system that gives the team more autonomy.",
    }),
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.match(body.errors.form, /not yet configured/i);
});

test("assessment calculation rejects client-supplied scores and recomputes the result", async () => {
  const response = await request("/api/assessment/calculate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers: { scored: {} }, overall: 100 }),
  });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).ok, false);
});

test("assessment calculation ignores browser result fields and returns a server result", async () => {
  const response = await request("/api/assessment/calculate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      validAssessmentPayload({
        overall: 100,
        components: { ownerIndependence: { score: 100 } },
        riskCodes: ["invented"],
        route: "diagnostic",
        financialOutputs: { annualValue: { low: 999999, high: 999999 } },
      }),
    ),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.match(
    body.assessmentId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  assert.equal(body.result.score.overall, 0);
  assert.equal(body.result.interpretation.route, "diagnostic");
  assert.equal(body.result.capacity.annualValue, null);
  assert.deepEqual(body.result.score.riskCodes, []);
});

test("assessment calculation returns field-specific validation errors", async () => {
  const response = await request("/api/assessment/calculate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      validAssessmentPayload({
        answers: {
          scored: { criticalDecisions: 17 },
          unexpected: "tampered",
        },
        lead: { reportConsent: false },
      }),
    ),
  });
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.ok(body.errors["answers.scored.criticalDecisions"]);
  assert.ok(body.errors["answers.unexpected"]);
  assert.ok(body.errors["lead.reportConsent"]);
});

test("assessment calculation rejects malformed JSON with a 422 response", async () => {
  const response = await request("/api/assessment/calculate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not-json",
  });
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.ok(body.errors.form);
});

test("assessment calculation rejects adversarial capacity values and duplicate categories", async (t) => {
  const invalidActivities = [
    {
      label: "people above limit",
      activities: [{
        activityId: "precision-reporting-v1",
        category: "reporting",
        people: 10001,
        hoursPerOccurrence: 1,
        occurrencesPerYear: 1,
        hourlyCost: 1,
      }],
      field: "answers.capacity.activities.0.people",
    },
    {
      label: "hours above limit",
      activities: [{
        activityId: "precision-owner-v1",
        category: "owner",
        hoursPerOccurrence: 169,
        occurrencesPerYear: 1,
        hourlyCost: 1,
      }],
      field: "answers.capacity.activities.0.hoursPerOccurrence",
    },
    {
      label: "occurrences above limit",
      activities: [{
        activityId: "precision-owner-v1",
        category: "owner",
        hoursPerOccurrence: 1,
        occurrencesPerYear: 366,
        hourlyCost: 1,
      }],
      field: "answers.capacity.activities.0.occurrencesPerYear",
    },
    {
      label: "cost above limit",
      activities: [{
        activityId: "precision-owner-v1",
        category: "owner",
        hoursPerOccurrence: 1,
        occurrencesPerYear: 1,
        hourlyCost: 10001,
      }],
      field: "answers.capacity.activities.0.hourlyCost",
    },
    {
      label: "negative value",
      activities: [{
        activityId: "precision-owner-v1",
        category: "owner",
        hoursPerOccurrence: -1,
        occurrencesPerYear: 1,
        hourlyCost: 1,
      }],
      field: "answers.capacity.activities.0.hoursPerOccurrence",
    },
    {
      label: "duplicate category",
      activities: [
        {
          activityId: "precision-owner-v1",
          category: "owner",
          hoursPerOccurrence: 1,
          occurrencesPerYear: 1,
          hourlyCost: 1,
        },
        {
          activityId: "precision-owner-v1",
          category: "owner",
          hoursPerOccurrence: 2,
          occurrencesPerYear: 2,
          hourlyCost: 2,
        },
      ],
      field: "answers.capacity.activities.1.category",
    },
  ];

  for (const fixture of invalidActivities) {
    await t.test(fixture.label, async () => {
      const response = await request("/api/assessment/calculate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          validAssessmentPayload({
            answers: {
              capacity: { source: "exact", activities: fixture.activities },
            },
          }),
        ),
      });
      assert.equal(response.status, 422);
      const body = await response.json();
      assert.ok(body.errors[fixture.field]);
    });
  }
});

test("assessment calculation rejects non-canonical capacity identities and modified bands", async (t) => {
  const baseOwner = {
    activityId: "precision-owner-v1",
    category: "owner",
    hoursPerOccurrence: 1,
    occurrencesPerYear: 1,
    hourlyCost: 1,
  };
  const fixtures = [
    {
      label: "invented exact ID",
      source: "exact",
      activity: { ...baseOwner, activityId: "invented-owner" },
    },
    {
      label: "banded ID used for exact source",
      source: "exact",
      activity: { ...baseOwner, activityId: "banded-owner-v1" },
    },
    {
      label: "precision ID used for banded source",
      source: "banded",
      activity: { ...baseOwner },
    },
    {
      label: "owner ID crossed to reporting category",
      source: "exact",
      activity: {
        ...baseOwner,
        category: "reporting",
        people: 1,
      },
    },
    {
      label: "modified banded midpoint",
      source: "banded",
      activity: {
        activityId: "banded-owner-v1",
        category: "owner",
        hoursPerOccurrence: 1.6,
        occurrencesPerYear: 52,
        hourlyCost: 100,
      },
    },
  ];

  for (const fixture of fixtures) {
    await t.test(fixture.label, async () => {
      const response = await request("/api/assessment/calculate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          validAssessmentPayload({
            answers: {
              capacity: {
                source: fixture.source,
                activities: [fixture.activity],
              },
            },
          }),
        ),
      });
      assert.equal(response.status, 422);
      const body = await response.json();
      assert.equal(body.ok, false);
      assert.ok(
        body.errors["answers.capacity.activities.0.activityId"] ||
          body.errors["answers.capacity.activities.0"],
      );
    });
  }
});

test("assessment calculation accepts canonical exact and banded capacity contracts", async (t) => {
  const fixtures = [
    {
      label: "exact inclusive maximums",
      source: "exact",
      activities: [
        {
          activityId: "precision-owner-v1",
          category: "owner",
          hoursPerOccurrence: 168,
          occurrencesPerYear: 365,
          hourlyCost: 10000,
        },
        {
          activityId: "precision-reporting-v1",
          category: "reporting",
          people: 10000,
          hoursPerOccurrence: 0,
          occurrencesPerYear: 0,
          hourlyCost: 0,
        },
      ],
      estimateType: "calculated",
    },
    {
      label: "banded disclosed presets",
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
      estimateType: "directional",
    },
  ];

  for (const fixture of fixtures) {
    await t.test(fixture.label, async () => {
      const response = await request("/api/assessment/calculate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          validAssessmentPayload({
            answers: {
              capacity: {
                source: fixture.source,
                activities: fixture.activities,
              },
            },
          }),
        ),
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.ok, true);
      assert.equal(body.result.capacity.estimateType, fixture.estimateType);
    });
  }
});

test("assessment calculation rejects duplicate activity IDs", async () => {
  const response = await request("/api/assessment/calculate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      validAssessmentPayload({
        answers: {
          capacity: {
            source: "exact",
            activities: [
              {
                activityId: "precision-owner-v1",
                category: "owner",
                hoursPerOccurrence: 1,
                occurrencesPerYear: 1,
                hourlyCost: 1,
              },
              {
                activityId: "precision-owner-v1",
                category: "reporting",
                people: 1,
                hoursPerOccurrence: 1,
                occurrencesPerYear: 1,
                hourlyCost: 1,
              },
            ],
          },
        },
      }),
    ),
  });
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.ok(body.errors["answers.capacity.activities.1.activityId"]);
});

test("assessment calculation rejects raw own __proto__ without reflecting PII", async () => {
  const validJson = JSON.stringify(
    validAssessmentPayload({
      lead: {
        name: "Private Person",
        workEmail: "private.person@example.com",
        company: "Private Company",
        phone: "+1 843 555 0199",
      },
    }),
  );
  const tamperedJson = validJson.replace(
    "{",
    '{"__proto__":{"polluted":true},',
  );
  const response = await request("/api/assessment/calculate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: tamperedJson,
  });
  assert.equal(response.status, 422);
  const rawBody = await response.text();
  assert.doesNotMatch(
    rawBody,
    /Private Person|private\.person@example\.com|Private Company|843 555 0199/,
  );
  const body = JSON.parse(rawBody);
  assert.equal(body.ok, false);
  assert.equal(Object.hasOwn(body.errors, "__proto__"), true);
});

test("assessment calculation rejects unknown keys at every raw input level", async (t) => {
  const fixtures = [
    {
      label: "top level",
      payload: validAssessmentPayload({ unexpected: true }),
      field: "unexpected",
    },
    {
      label: "lead",
      payload: validAssessmentPayload({ lead: { unexpected: true } }),
      field: "lead.unexpected",
    },
    {
      label: "capacity",
      payload: validAssessmentPayload({
        answers: {
          capacity: {
            source: "none",
            activities: [],
            unexpected: true,
          },
        },
      }),
      field: "answers.capacity.unexpected",
    },
    {
      label: "activity",
      payload: validAssessmentPayload({
        answers: {
          capacity: {
            source: "exact",
            activities: [
              {
                activityId: "precision-owner-v1",
                category: "owner",
                hoursPerOccurrence: 1,
                occurrencesPerYear: 1,
                hourlyCost: 1,
                unexpected: true,
              },
            ],
          },
        },
      }),
      field: "answers.capacity.activities.0.unexpected",
    },
  ];

  for (const fixture of fixtures) {
    await t.test(fixture.label, async () => {
      const response = await request("/api/assessment/calculate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fixture.payload),
      });
      assert.equal(response.status, 422);
      const body = await response.json();
      assert.ok(body.errors[fixture.field]);
    });
  }
});

test("assessment calculation rejects wrong collection and object shapes", async (t) => {
  const fixtures = [
    { label: "top-level array", payload: [] },
    {
      label: "answers array",
      payload: { ...validAssessmentPayload(), answers: [] },
    },
    {
      label: "scored array",
      payload: validAssessmentPayload({ answers: { scored: [] } }),
    },
    {
      label: "capacity array",
      payload: validAssessmentPayload({ answers: { capacity: [] } }),
    },
    {
      label: "activities object",
      payload: validAssessmentPayload({
        answers: { capacity: { source: "exact", activities: {} } },
      }),
    },
    {
      label: "activity array",
      payload: validAssessmentPayload({
        answers: { capacity: { source: "exact", activities: [[]] } },
      }),
    },
    {
      label: "lead array",
      payload: { ...validAssessmentPayload(), lead: [] },
    },
  ];

  for (const fixture of fixtures) {
    await t.test(fixture.label, async () => {
      const response = await request("/api/assessment/calculate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fixture.payload),
      });
      assert.equal(response.status, 422);
      assert.equal((await response.json()).ok, false);
    });
  }
});

test("assessment calculation enforces finite values and inclusive minimums", async (t) => {
  const minimumResponse = await request("/api/assessment/calculate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      validAssessmentPayload({
        answers: {
          capacity: {
            source: "exact",
            activities: [
              {
                activityId: "precision-reporting-v1",
                category: "reporting",
                people: 1,
                hoursPerOccurrence: 0,
                occurrencesPerYear: 0,
                hourlyCost: 0,
              },
            ],
          },
        },
      }),
    ),
  });
  assert.equal(minimumResponse.status, 200);

  const finiteJson = JSON.stringify(
    validAssessmentPayload({
      answers: {
        capacity: {
          source: "exact",
          activities: [
            {
              activityId: "precision-owner-v1",
              category: "owner",
              hoursPerOccurrence: 1,
              occurrencesPerYear: 1,
              hourlyCost: 1,
            },
          ],
        },
      },
    }),
  ).replace('"hoursPerOccurrence":1', '"hoursPerOccurrence":1e309');
  await t.test("non-finite parsed number", async () => {
    const response = await request("/api/assessment/calculate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: finiteJson,
    });
    assert.equal(response.status, 422);
    const body = await response.json();
    assert.ok(
      body.errors["answers.capacity.activities.0.hoursPerOccurrence"],
    );
  });
});

test("report delivery rejects a malformed assessment id", async () => {
  const response = await request("/api/assessment/not-a-uuid/deliver", {
    method: "POST",
  });
  assert.equal(response.status, 404);
});

test("report delivery does not claim success when Resend is not configured", async () => {
  const wellFormedId = "123e4567-e89b-42d3-a456-426614174000";
  const response = await request(`/api/assessment/${wellFormedId}/deliver`, {
    method: "POST",
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.match(body.errors.form, /not yet configured/i);
});

test("assessment responses never reflect submitted lead PII", async (t) => {
  const pii = {
    name: "Private Person",
    workEmail: "private.person@example.com",
    company: "Private Company",
    phone: "+1 843 555 0199",
  };
  for (const fixture of [
    { label: "success", lead: pii, expectedStatus: 200 },
    {
      label: "validation error",
      lead: { ...pii, reportConsent: false },
      expectedStatus: 422,
    },
  ]) {
    await t.test(fixture.label, async () => {
      const response = await request("/api/assessment/calculate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validAssessmentPayload({ lead: fixture.lead })),
      });
      assert.equal(response.status, fixture.expectedStatus);
      const rawBody = await response.text();
      assert.doesNotMatch(
        rawBody,
        /Private Person|private\.person@example\.com|Private Company|843 555 0199/,
      );
    });
  }
});

