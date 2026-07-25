# Business Independence Assessment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a deterministic five-minute Business Independence Assessment with confidence-aware results, gated lead capture, recoverable-capacity analysis, a downloadable executive PDF, resilient rules-based narrative, and optional validated AI explanation.

**Architecture:** Keep the scoring domain as pure, versioned TypeScript with no React, database, or AI dependencies. A client-side assessment flow uses that engine for immediate preliminary and full results; server routes independently recompute results before storing a compact D1 record or producing a PDF. AI can explain only the normalized deterministic result and must pass validation before use.

**Tech Stack:** TypeScript 5.9, React 19, Next.js 16 via Vinext, Cloudflare Workers, Drizzle ORM with D1, `pdf-lib` for edge-compatible PDF generation, Node test runner, ESLint, Sites deployment.

## Global Constraints

- Scores, risk flags, confidence, estimates, and recommendations must come from versioned deterministic rules.
- A higher score is always better; `100` means greater independence or maturity.
- Overall score weights are Owner Independence 35%, Operating-System Maturity 35%, and Information Visibility 30%.
- AI Readiness and Automation Opportunity do not affect the Business Independence Score in version 1.
- Below 60% scoring coverage, suppress the numeric overall score and show `Result incomplete`.
- Score confidence and impact confidence must be calculated independently.
- Exact eligible capacity inputs produce a calculated range; complete bands produce a directional range; weak inputs produce non-financial indicators.
- Do not monetize decision delay, missed revenue, relationship concentration, enterprise valuation, turnover, or strategic opportunity cost.
- The free assessment reveals likely exposure but does not validate root causes or design a bespoke implementation roadmap.
- Phone and exact financial inputs remain optional.
- Marketing consent is separate from report-delivery consent.
- The experience remains complete when AI or email delivery is unavailable.
- Detailed free-text operating answers are not retained by default.
- Preserve the Quiet Authority visual system and professional-boundary routing.

---

## Release Structure

1. **Release A — Deterministic assessment:** Tasks 1–6. A complete on-site assessment with rules-based results and no persistence dependency.
2. **Release B — Lead and report delivery:** Tasks 7–9. D1 persistence, PDF generation, email delivery, privacy updates, and graceful failure behavior.
3. **Release C — Narrative and optimization:** Tasks 10–12. Validated AI explanation, analytics, complete QA, and production deployment.

Each release must pass its own verification gate before the next begins.

### Task 1: Define the versioned assessment contract and question bank

**Files:**
- Create: `lib/assessment/types.ts`
- Create: `lib/assessment/questions.ts`
- Test: `tests/assessment/questions.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `ASSESSMENT_VERSION`, `AssessmentAnswers`, `QuestionDefinition`, `AnswerValue`, `COMPONENT_WEIGHTS`, and `QUESTION_BANK`.
- Consumes: No application code.

- [ ] **Step 1: Add a domain-test script**

Modify `package.json`:

```json
"scripts": {
  "test:domain": "node --import=tsx --test tests/assessment/*.test.mjs",
  "test": "npm run test:domain && npm run build && node --test tests/rendered-html.test.mjs"
}
```

Run:

```powershell
npm install --save-dev tsx@4.20.6
```

- [ ] **Step 2: Write a failing question-bank test**

Create `tests/assessment/questions.test.mjs`:

```js
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
```

- [ ] **Step 3: Run the test and verify failure**

Run:

```powershell
npm run test:domain
```

Expected: FAIL because `lib/assessment/questions.ts` does not exist.

- [ ] **Step 4: Define exact domain types**

Create `lib/assessment/types.ts`:

```ts
export type ComponentId =
  | "ownerIndependence"
  | "operatingSystem"
  | "informationVisibility";

export type ScoredValue = 0 | 25 | 50 | 75 | 100;
export type AnswerValue = ScoredValue | "unknown" | "notApplicable";

export type ContextAnswers = {
  employeeBand: string;
  managerBand: string;
  revenueBand: string;
  role: string;
  coreSystemCount: "one" | "twoOrMore";
  organizationShape: "singleTeam" | "multipleTeams";
  relationshipLedByOwner: boolean;
  restrictedMarket: boolean;
};

export type CapacityInputs = {
  source: "none" | "banded" | "exact";
  owner?: { hoursPerOccurrence: number; occurrencesPerYear: number; hourlyCost: number };
  reporting?: { people: number; hoursPerOccurrence: number; occurrencesPerYear: number; hourlyCost: number };
  rework?: { people: number; hoursPerOccurrence: number; occurrencesPerYear: number; hourlyCost: number };
};

export type AssessmentAnswers = ContextAnswers & {
  scored: Partial<Record<string, AnswerValue>>;
  capacity: CapacityInputs;
};

export type QuestionDefinition = {
  id: string;
  component: ComponentId;
  prompt: string;
  weight: number;
  required: boolean;
  appliesWhen?: (context: ContextAnswers) => boolean;
  options: Array<{ value: Exclude<AnswerValue, "notApplicable">; label: string }>;
};
```

- [ ] **Step 5: Implement the question bank**

Create `lib/assessment/questions.ts` with:

```ts
import type { QuestionDefinition } from "./types";

export const ASSESSMENT_VERSION = "1.0.0";
export const COMPONENT_WEIGHTS = {
  ownerIndependence: 0.35,
  operatingSystem: 0.35,
  informationVisibility: 0.30,
} as const;

const anchors = (labels: [string, string, string, string, string]) => [
  { value: 0 as const, label: labels[0] },
  { value: 25 as const, label: labels[1] },
  { value: 50 as const, label: labels[2] },
  { value: 75 as const, label: labels[3] },
  { value: 100 as const, label: labels[4] },
  { value: "unknown" as const, label: "I do not know or cannot verify this" },
];
```

Add the 18 questions using the IDs and weights below, with six behavioral labels per question as required by the approved specification:

```ts
export const QUESTION_BANK: QuestionDefinition[] = [
  { id: "criticalDecisions", component: "ownerIndependence", weight: .30, required: true, prompt: "How often do material operating decisions wait for owner approval?", options: anchors(["Nearly every decision waits for the owner", "Most decisions wait, with limited exceptions", "It varies by manager or situation", "Most decisions are delegated within understood limits", "Defined decisions are made at the appropriate level"]) },
  { id: "twoWeekAbsence", component: "ownerIndependence", weight: .25, required: true, prompt: "What would happen if the owner were unavailable for two weeks?", options: anchors(["Routine work and decisions would stall", "Significant work would wait or require contact", "Core work continues but issues accumulate", "Operations continue with a few defined exceptions", "Operations and management cadence continue without contact"]) },
  { id: "managerAuthority", component: "ownerIndependence", weight: .20, required: true, prompt: "How clearly can managers make decisions without owner approval?", options: anchors(["Managers execute tasks but lack decision authority", "Authority is narrow and regularly overridden", "Authority varies by function or situation", "Managers usually decide within understood limits", "Decision rights, limits, and escalation paths are explicit"]) },
  { id: "exceptionResolution", component: "ownerIndependence", weight: .15, required: true, prompt: "How are recurring operating exceptions resolved?", options: anchors(["Exceptions routinely escalate to the owner", "Most exceptions escalate despite manager involvement", "Common issues are resolved but treatment varies", "Teams resolve most standard exceptions", "Standard exceptions follow defined rules at the correct level"]) },
  { id: "workWaiting", component: "ownerIndependence", weight: .10, required: true, prompt: "How often does routine work wait for owner input?", options: anchors(["Work queues form regularly", "Waiting occurs most weeks", "Waiting occurs in specific areas", "Waiting is uncommon and limited", "Owner input rarely blocks routine execution"]) },
  { id: "relationshipConcentration", component: "ownerIndependence", weight: .10, required: false, appliesWhen: (c) => c.relationshipLedByOwner, prompt: "How dependent are key external relationships on the owner?", options: anchors(["Key relationships depend almost entirely on the owner", "The owner remains the essential relationship holder", "Relationships are shared but the owner is central", "Coverage exists with limited owner dependence", "Relationships are institutionally owned and documented"]) },

  { id: "workflowDocumentation", component: "operatingSystem", weight: .25, required: true, prompt: "How consistently are critical recurring workflows documented and used?", options: anchors(["Critical workflows reside in individual memory", "Documentation is isolated or rarely used", "Selected workflows are documented but incomplete", "Most critical workflows are current and used", "Critical workflows are current, accessible, and routinely used"]) },
  { id: "processOwnership", component: "operatingSystem", weight: .20, required: true, prompt: "How clearly are critical outcomes and workflows owned?", options: anchors(["Ownership is assumed or disputed", "Ownership is person-dependent and often unclear", "Ownership is clear within selected functions", "Most workflows have accountable owners", "Critical outcomes and workflows have explicit accountable owners"]) },
  { id: "decisionRules", component: "operatingSystem", weight: .20, required: true, prompt: "How explicit are decision thresholds and escalation rules?", options: anchors(["Teams rely on owner intervention", "Rules are informal and manager-specific", "Common rules exist but vary", "Most thresholds are understood and followed", "Decision thresholds and escalation paths are explicit"]) },
  { id: "crossTraining", component: "operatingSystem", weight: .15, required: true, prompt: "How resilient is coverage for critical responsibilities?", options: anchors(["Critical work has single points of failure", "Backup coverage is informal or untested", "Selected roles have workable backup coverage", "Most critical responsibilities have trained backups", "Critical responsibilities have tested backup coverage"]) },
  { id: "managementCadence", component: "operatingSystem", weight: .20, required: true, prompt: "How reliably does the management cadence produce decisions and accountability?", options: anchors(["Reviews are reactive or irregular", "Meetings occur without consistent decisions", "Recurring reviews exist but follow-through varies", "Reviews usually connect measures, decisions, and owners", "A defined cadence consistently drives decisions and accountability"]) },
  { id: "crossTeamConsistency", component: "operatingSystem", weight: .15, required: false, appliesWhen: (c) => c.organizationShape === "multipleTeams", prompt: "How consistently do teams execute shared critical workflows?", options: anchors(["Teams use materially different approaches", "Differences regularly create handoff problems", "Common intent exists but execution varies", "Shared standards govern most handoffs", "Shared standards consistently govern critical workflows"]) },

  { id: "kpiAvailability", component: "informationVisibility", weight: .25, required: true, prompt: "Are current KPIs available when leaders need to make decisions?", options: anchors(["Leaders cannot access current measures", "Measures require significant ad hoc preparation", "Core KPIs exist but are delayed or incomplete", "Most decision-relevant KPIs are timely", "Current decision-relevant KPIs are available within cadence"]) },
  { id: "manualReporting", component: "informationVisibility", weight: .20, required: true, prompt: "How much recurring management reporting is assembled manually?", options: anchors(["Nearly all recurring reporting is manual", "Most reporting requires manual assembly", "Automation exists but material manual work remains", "Routine reporting is mostly automated with review", "Routine reporting is automated with controlled human review"]) },
  { id: "dataTrust", component: "informationVisibility", weight: .20, required: true, prompt: "How much time do leaders spend reconciling competing numbers?", options: anchors(["Leaders regularly debate whose numbers are correct", "Reconciliation is required for most reviews", "Selected measures are trusted after reconciliation", "Most measures use common definitions and sources", "Controlled definitions and sources produce trusted information"]) },
  { id: "detectionSpeed", component: "informationVisibility", weight: .20, required: true, prompt: "How early are operating problems detected?", options: anchors(["Problems surface through customer or cash impact", "Problems are usually detected after material impact", "Reviews identify problems after a meaningful delay", "Most issues surface early enough for corrective action", "Leading and lagging indicators reveal issues early enough to act"]) },
  { id: "kpiCadence", component: "informationVisibility", weight: .15, required: true, prompt: "What happens after KPIs are reviewed?", options: anchors(["Metrics are irregular and have no clear owner", "Reviews occur without consistent actions", "Actions are assigned but follow-through varies", "Reviews usually produce owned and tracked actions", "Reviews consistently produce decisions, owners, and tracked actions"]) },
  { id: "systemConnectivity", component: "informationVisibility", weight: .10, required: false, appliesWhen: (c) => c.coreSystemCount === "twoOrMore", prompt: "How reliably does critical information move between systems?", options: anchors(["Critical information is repeatedly re-keyed", "Manual transfers dominate and cause recurring errors", "Selected integrations exist with significant gaps", "Most critical flows are controlled with limited gaps", "Critical systems exchange required information through controlled workflows"]) },
];
```

- [ ] **Step 6: Run the question tests**

Run:

```powershell
npm run test:domain
```

Expected: all question-bank tests PASS.

- [ ] **Step 7: Commit the domain contract**

```powershell
git add package.json package-lock.json lib/assessment/types.ts lib/assessment/questions.ts tests/assessment/questions.test.mjs
git commit -m "feat: define business independence assessment model"
```

### Task 2: Implement deterministic scoring and score confidence

**Files:**
- Create: `lib/assessment/scoring.ts`
- Test: `tests/assessment/scoring.test.mjs`

**Interfaces:**
- Consumes: `AssessmentAnswers`, `QUESTION_BANK`, `COMPONENT_WEIGHTS`.
- Produces: `scoreAssessment(answers: AssessmentAnswers): ScoreResult`.

- [ ] **Step 1: Write failing score tests**

Create `tests/assessment/scoring.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { QUESTION_BANK } from "../../lib/assessment/questions.ts";
import { scoreAssessment } from "../../lib/assessment/scoring.ts";

const context = {
  employeeBand: "20-49", managerBand: "3-5", revenueBand: "3m-10m",
  role: "Founder", coreSystemCount: "one", organizationShape: "singleTeam",
  relationshipLedByOwner: false, restrictedMarket: false,
};
const answersAt = (value) => ({
  ...context,
  scored: Object.fromEntries(QUESTION_BANK.filter((q) => q.required).map((q) => [q.id, value])),
  capacity: { source: "none" },
});

test("scores perfect required answers at 100 with high confidence", () => {
  const result = scoreAssessment(answersAt(100));
  assert.equal(result.overall, 100);
  assert.equal(result.category, "strong");
  assert.equal(result.confidence.level, "high");
});

test("suppresses overall score below 60 percent coverage", () => {
  const input = answersAt(100);
  input.scored = { criticalDecisions: 100 };
  const result = scoreAssessment(input);
  assert.equal(result.overall, null);
  assert.equal(result.category, "incomplete");
  assert.equal(result.confidence.level, "incomplete");
});

test("unknown is excluded and creates a measurement gap", () => {
  const input = answersAt(75);
  input.scored.criticalDecisions = "unknown";
  const result = scoreAssessment(input);
  assert.ok(result.riskCodes.includes("measurement_gap"));
  assert.ok(result.confidence.reasons.some((reason) => reason.includes("Unknown")));
});

test("conditional weights replace the required-base share", () => {
  const input = answersAt(100);
  input.relationshipLedByOwner = true;
  input.scored.relationshipConcentration = 0;
  const result = scoreAssessment(input);
  assert.equal(result.components.ownerIndependence.score, 90);
});
```

- [ ] **Step 2: Verify failure**

Run:

```powershell
npm run test:domain
```

Expected: FAIL because `scoreAssessment` is undefined.

- [ ] **Step 3: Implement scoring types and algorithm**

Create `lib/assessment/scoring.ts`:

```ts
import { COMPONENT_WEIGHTS, QUESTION_BANK } from "./questions";
import type { AssessmentAnswers, ComponentId, ScoredValue } from "./types";

export type ConfidenceLevel = "high" | "medium" | "low" | "incomplete";
export type ScoreResult = {
  overall: number | null;
  category: "strong" | "emerging" | "developing" | "highDependency" | "incomplete";
  components: Record<ComponentId, { score: number | null; coverage: number; unknownCount: number }>;
  confidence: { level: ConfidenceLevel; coverage: number; reasons: string[] };
  riskCodes: string[];
};

const round = (value: number) => Math.round(value);
const categoryFor = (score: number | null): ScoreResult["category"] =>
  score === null ? "incomplete" : score >= 80 ? "strong" : score >= 65 ? "emerging" : score >= 45 ? "developing" : "highDependency";

export function scoreAssessment(answers: AssessmentAnswers): ScoreResult {
  const applicable = QUESTION_BANK.filter((q) => q.required || q.appliesWhen?.(answers));
  const components = {} as ScoreResult["components"];
  let answeredApplicable = 0;
  let unknownTotal = 0;
  const riskCodes: string[] = [];

  for (const component of Object.keys(COMPONENT_WEIGHTS) as ComponentId[]) {
    const questions = applicable.filter((q) => q.component === component);
    const conditional = questions.filter((q) => !q.required);
    const conditionalShare = conditional.reduce((sum, q) => sum + q.weight, 0);
    const baseScale = 1 - conditionalShare;
    let numerator = 0;
    let denominator = 0;
    let known = 0;
    let unknownCount = 0;

    for (const question of questions) {
      const answer = answers.scored[question.id];
      const adjustedWeight = question.required ? question.weight * baseScale : question.weight;
      if (answer === "unknown" || answer === undefined) {
        unknownCount += 1;
        continue;
      }
      if (answer === "notApplicable") continue;
      numerator += (answer as ScoredValue) * adjustedWeight;
      denominator += adjustedWeight;
      known += 1;
    }
    answeredApplicable += known;
    unknownTotal += unknownCount;
    components[component] = {
      score: denominator ? round(numerator / denominator) : null,
      coverage: questions.length ? known / questions.length : 0,
      unknownCount,
    };
  }

  const coverage = applicable.length ? answeredApplicable / applicable.length : 0;
  const componentCoverage = Object.values(components).map((item) => item.coverage);
  const overall = coverage < .60 || Object.values(components).some((item) => item.score === null)
    ? null
    : round(Object.entries(COMPONENT_WEIGHTS).reduce(
        (sum, [key, weight]) => sum + (components[key as ComponentId].score ?? 0) * weight,
        0,
      ));
  const level: ConfidenceLevel =
    coverage < .60 ? "incomplete"
    : coverage >= .90 && componentCoverage.every((value) => value >= .80) && unknownTotal <= 1 ? "high"
    : coverage >= .75 && componentCoverage.every((value) => value >= .65) && unknownTotal <= 3 ? "medium"
    : "low";

  if (unknownTotal) riskCodes.push("measurement_gap");
  return {
    overall,
    category: categoryFor(overall),
    components,
    confidence: {
      level,
      coverage,
      reasons: unknownTotal ? [`${unknownTotal} Unknown response${unknownTotal === 1 ? "" : "s"} reduced confidence.`] : [],
    },
    riskCodes,
  };
}
```

- [ ] **Step 4: Run tests**

Run:

```powershell
npm run test:domain
```

Expected: all tests PASS.

- [ ] **Step 5: Commit scoring**

```powershell
git add lib/assessment/scoring.ts tests/assessment/scoring.test.mjs
git commit -m "feat: add deterministic independence scoring"
```

### Task 3: Implement risk, capacity, priority, and routing engines

**Files:**
- Create: `lib/assessment/interpretation.ts`
- Create: `lib/assessment/capacity.ts`
- Test: `tests/assessment/interpretation.test.mjs`
- Test: `tests/assessment/capacity.test.mjs`

**Interfaces:**
- Consumes: `AssessmentAnswers`, `ScoreResult`.
- Produces: `calculateCapacity`, `interpretAssessment`, `CapacityResult`, `AssessmentInterpretation`.

- [ ] **Step 1: Write failing capacity tests**

Create `tests/assessment/capacity.test.mjs`:

```js
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
```

- [ ] **Step 2: Write failing interpretation tests**

Create `tests/assessment/interpretation.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { interpretAssessment } from "../../lib/assessment/interpretation.ts";

const score = {
  overall: 42, category: "highDependency",
  components: {
    ownerIndependence: { score: 25, coverage: 1, unknownCount: 0 },
    operatingSystem: { score: 50, coverage: 1, unknownCount: 0 },
    informationVisibility: { score: 60, coverage: 1, unknownCount: 0 },
  },
  confidence: { level: "high", coverage: 1, reasons: [] },
  riskCodes: [],
};

test("high dependency and sufficient scale route to diagnostic", () => {
  const result = interpretAssessment(score, {
    employeeBand: "20-49", managerBand: "3-5", revenueBand: "3m-10m",
    role: "Founder", coreSystemCount: "twoOrMore", organizationShape: "multipleTeams",
    relationshipLedByOwner: true, restrictedMarket: false, scored: {}, capacity: { source: "none" },
  });
  assert.equal(result.route, "diagnostic");
  assert.equal(result.priorities[0].component, "ownerIndependence");
  assert.ok(result.riskCodes.includes("owner_bottleneck"));
});

test("restricted market never produces consulting route", () => {
  const result = interpretAssessment(score, {
    employeeBand: "20-49", managerBand: "3-5", revenueBand: "3m-10m",
    role: "Founder", coreSystemCount: "twoOrMore", organizationShape: "multipleTeams",
    relationshipLedByOwner: true, restrictedMarket: true, scored: {}, capacity: { source: "none" },
  });
  assert.equal(result.route, "restricted");
});
```

- [ ] **Step 3: Verify failures**

Run:

```powershell
npm run test:domain
```

Expected: FAIL because both modules are missing.

- [ ] **Step 4: Implement capacity calculations**

Create `lib/assessment/capacity.ts`:

```ts
import type { CapacityInputs } from "./types";

type Category = "owner" | "reporting" | "rework";
export type CapacityResult = {
  confidence: "high" | "medium" | "low";
  estimateType: "calculated" | "directional" | "unavailable";
  grossHours: Record<Category | "total", number>;
  recoverableHours: { low: number; high: number } | null;
  annualValue: { low: number; high: number } | null;
  assumptions: string[];
};

export function calculateCapacity(input: CapacityInputs): CapacityResult {
  const categories = (["owner", "reporting", "rework"] as Category[])
    .map((key) => [key, input[key]] as const)
    .filter((entry): entry is [Category, NonNullable<CapacityInputs[Category]>] => Boolean(entry[1]));
  const grossHours = { owner: 0, reporting: 0, rework: 0, total: 0 };
  let grossValue = 0;
  for (const [key, item] of categories) {
    const people = "people" in item ? item.people : 1;
    const hours = people * item.hoursPerOccurrence * item.occurrencesPerYear;
    grossHours[key] = hours;
    grossHours.total += hours;
    grossValue += hours * item.hourlyCost;
  }
  if (categories.length < 2 || input.source === "none") {
    return { confidence: "low", estimateType: "unavailable", grossHours, recoverableHours: null, annualValue: null, assumptions: ["At least two complete capacity categories are required."] };
  }
  const factors = input.source === "exact" ? [0.50, 0.70] : [0.35, 0.55];
  return {
    confidence: input.source === "exact" ? "high" : "medium",
    estimateType: input.source === "exact" ? "calculated" : "directional",
    grossHours,
    recoverableHours: { low: Math.round(grossHours.total * factors[0]), high: Math.round(grossHours.total * factors[1]) },
    annualValue: { low: Math.round(grossValue * factors[0]), high: Math.round(grossValue * factors[1]) },
    assumptions: [`Applied a ${factors[0] * 100}%–${factors[1] * 100}% realization range.`],
  };
}
```

- [ ] **Step 5: Implement controlled risks, priorities, and route**

Create `lib/assessment/interpretation.ts`:

```ts
import type { AssessmentAnswers, ComponentId } from "./types";
import type { ScoreResult } from "./scoring";

export type LeadRoute = "diagnostic" | "nurture" | "insights" | "restricted";
export type Priority = { component: ComponentId; title: string; action: string; indicator: string };
export type AssessmentInterpretation = { riskCodes: string[]; priorities: Priority[]; route: LeadRoute };

const LIBRARY: Record<ComponentId, Priority> = {
  ownerIndependence: { component: "ownerIndependence", title: "Clarify decision authority", action: "Define the recurring decisions managers can make and the conditions requiring escalation.", indicator: "Share of routine decisions resolved without owner intervention" },
  operatingSystem: { component: "operatingSystem", title: "Stabilize one critical workflow", action: "Assign an accountable owner and document the decision points, handoffs, and exception path.", indicator: "Exceptions resolved through the documented workflow" },
  informationVisibility: { component: "informationVisibility", title: "Create a decision-ready KPI cadence", action: "Standardize the small set of measures, definitions, owners, and review actions used for operating decisions.", indicator: "Management reviews completed with agreed data and owned actions" },
};

export function interpretAssessment(score: ScoreResult, answers: AssessmentAnswers): AssessmentInterpretation {
  const ranked = (Object.entries(score.components) as [ComponentId, ScoreResult["components"][ComponentId]][])
    .sort((a, b) => (a[1].score ?? 101) - (b[1].score ?? 101));
  const riskCodes = [...score.riskCodes];
  if ((score.components.ownerIndependence.score ?? 100) < 45) riskCodes.push("owner_bottleneck");
  if ((score.components.operatingSystem.score ?? 100) < 45) riskCodes.push("operating_system_gap");
  if ((score.components.informationVisibility.score ?? 100) < 45) riskCodes.push("information_bottleneck");
  const route: LeadRoute = answers.restrictedMarket ? "restricted"
    : score.overall !== null && score.overall < 65 && !["1-4", "5-9"].includes(answers.employeeBand) ? "diagnostic"
    : score.overall !== null && score.overall >= 80 ? "insights"
    : "nurture";
  return { riskCodes: [...new Set(riskCodes)].slice(0, 3), priorities: ranked.slice(0, 3).map(([key]) => LIBRARY[key]), route };
}
```

- [ ] **Step 6: Run domain tests and commit**

Run:

```powershell
npm run test:domain
```

Expected: all domain tests PASS.

```powershell
git add lib/assessment/capacity.ts lib/assessment/interpretation.ts tests/assessment/capacity.test.mjs tests/assessment/interpretation.test.mjs
git commit -m "feat: calculate capacity and route assessment results"
```

### Task 4: Build the assessment shell and accessible question flow

**Files:**
- Create: `app/assessment/page.tsx`
- Create: `app/assessment/AssessmentFlow.tsx`
- Create: `app/assessment/assessment.css`
- Create: `lib/assessment/session.ts`
- Modify: `app/sitemap.ts`
- Modify: `components/SiteParts.tsx`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `QUESTION_BANK`, `AssessmentAnswers`.
- Produces: browser-session state keyed as `business-independence-assessment-v1`; routes `/assessment`.

- [ ] **Step 1: Add a failing route test**

Append to `tests/rendered-html.test.mjs`:

```js
test("renders the Business Independence Assessment entry experience", async () => {
  const response = await request("/assessment");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /How independently can your business operate/i);
  assert.match(html, /approximately five minutes/i);
  assert.match(html, /deterministic scoring/i);
  assert.match(html, /Start the assessment/i);
});
```

- [ ] **Step 2: Verify the route test fails**

Run:

```powershell
npm test
```

Expected: FAIL with `/assessment` returning 404.

- [ ] **Step 3: Create the server entry page**

Create `app/assessment/page.tsx`:

```tsx
import type { Metadata } from "next";
import { AssessmentFlow } from "./AssessmentFlow";
import "./assessment.css";

export const metadata: Metadata = {
  title: "Business Independence Assessment",
  description: "Identify where owner intervention, operating practices, or delayed information constrain business independence.",
};

export default function AssessmentPage() {
  return <AssessmentFlow />;
}
```

- [ ] **Step 4: Implement browser-session serialization**

Create `lib/assessment/session.ts`:

```ts
import type { AssessmentAnswers } from "./types";
export const SESSION_KEY = "business-independence-assessment-v1";
export const saveSession = (answers: AssessmentAnswers) => sessionStorage.setItem(SESSION_KEY, JSON.stringify(answers));
export const loadSession = (): AssessmentAnswers | null => {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as AssessmentAnswers; } catch { return null; }
};
export const clearSession = () => sessionStorage.removeItem(SESSION_KEY);
```

- [ ] **Step 5: Implement the client flow**

Create `app/assessment/AssessmentFlow.tsx` as a client component with:

```tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { QUESTION_BANK } from "../../lib/assessment/questions";
import type { AssessmentAnswers, AnswerValue } from "../../lib/assessment/types";
import { loadSession, saveSession } from "../../lib/assessment/session";

const EMPTY: AssessmentAnswers = {
  employeeBand: "", managerBand: "", revenueBand: "", role: "",
  coreSystemCount: "one", organizationShape: "singleTeam",
  relationshipLedByOwner: false, restrictedMarket: false,
  scored: {}, capacity: { source: "none" },
};

export function AssessmentFlow() {
  const [answers, setAnswers] = useState(EMPTY);
  const [screen, setScreen] = useState<"landing" | "context" | "ownerIndependence" | "operatingSystem" | "informationVisibility" | "preliminary">("landing");
  useEffect(() => { const stored = loadSession(); if (stored) setAnswers(stored); }, []);
  useEffect(() => { saveSession(answers); }, [answers]);
  const applicable = useMemo(() => QUESTION_BANK.filter((q) => q.required || q.appliesWhen?.(answers)), [answers]);
  const answer = (id: string, value: AnswerValue) => setAnswers((current) => ({ ...current, scored: { ...current.scored, [id]: value } }));
  // Render the landing promise, required context selects, one fieldset per
  // component, a progress indicator, Back/Continue controls, and the
  // PreliminaryResult component introduced in Task 5.
}
```

In the same file, implement explicit JSX for:

- the landing promise and privacy/method notes;
- the six required context controls;
- the restricted-market disclosure;
- applicable question `fieldset` elements with radio buttons;
- progress using `aria-valuenow`;
- disabled Continue until required visible fields are answered;
- Back without losing state;
- a `Review answers` route from the preliminary screen.

- [ ] **Step 6: Add assessment-specific styling**

Create `app/assessment/assessment.css` using existing CSS variables from `app/globals.css`. Add:

```css
.assessment-shell { width: min(760px, calc(100% - 2rem)); margin: 0 auto; padding: 5rem 0; }
.assessment-card { background: var(--paper, #fbfaf6); border: 1px solid rgba(24,35,30,.14); padding: clamp(1.25rem, 4vw, 3rem); }
.assessment-options { display: grid; gap: .75rem; margin: 1.5rem 0; }
.assessment-option { display: grid; grid-template-columns: auto 1fr; gap: .75rem; padding: 1rem; border: 1px solid rgba(24,35,30,.16); cursor: pointer; }
.assessment-option:has(input:checked) { border-color: #173f32; background: rgba(23,63,50,.06); }
.assessment-progress { height: 4px; background: rgba(24,35,30,.12); }
.assessment-progress > span { display: block; height: 100%; background: #9a693a; }
```

- [ ] **Step 7: Add navigation and sitemap entry**

Add `/assessment` to the site navigation and sitemap. Use CTA copy `Take the assessment`, while retaining `/diagnostic` for the paid offer.

- [ ] **Step 8: Verify and commit**

Run:

```powershell
npm run lint
npm test
```

Expected: lint and all tests PASS.

```powershell
git add app/assessment components/SiteParts.tsx app/sitemap.ts lib/assessment/session.ts tests/rendered-html.test.mjs
git commit -m "feat: build guided independence assessment flow"
```

### Task 5: Add preliminary result, contact gate, exact-input option, and full result

**Files:**
- Create: `app/assessment/PreliminaryResult.tsx`
- Create: `app/assessment/ContactGate.tsx`
- Create: `app/assessment/PrecisionInputs.tsx`
- Create: `app/assessment/FullResult.tsx`
- Create: `lib/assessment/result.ts`
- Modify: `app/assessment/AssessmentFlow.tsx`
- Test: `tests/assessment/result.test.mjs`

**Interfaces:**
- Consumes: `scoreAssessment`, `calculateCapacity`, `interpretAssessment`.
- Produces: `buildAssessmentResult(answers): AssessmentResult` and the complete ungated/gated UI sequence.

- [ ] **Step 1: Write a failing orchestration test**

Create `tests/assessment/result.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { QUESTION_BANK } from "../../lib/assessment/questions.ts";
import { buildAssessmentResult } from "../../lib/assessment/result.ts";

const answers = {
  employeeBand: "20-49", managerBand: "3-5", revenueBand: "3m-10m", role: "Founder",
  coreSystemCount: "twoOrMore", organizationShape: "multipleTeams",
  relationshipLedByOwner: true, restrictedMarket: false,
  scored: Object.fromEntries(QUESTION_BANK.map((q) => [q.id, 50])),
  capacity: { source: "none" },
};

test("builds reproducible result without AI", () => {
  const result = buildAssessmentResult(answers);
  assert.equal(result.methodologyVersion, "1.0.0");
  assert.equal(result.score.overall, 50);
  assert.equal(result.capacity.annualValue, null);
  assert.equal(result.interpretation.priorities.length, 3);
  assert.match(result.narrative.summary, /self-reported/i);
});
```

- [ ] **Step 2: Verify failure**

Run `npm run test:domain`.

Expected: FAIL because `lib/assessment/result.ts` does not exist.

- [ ] **Step 3: Implement deterministic result orchestration**

Create `lib/assessment/result.ts`:

```ts
import { ASSESSMENT_VERSION } from "./questions";
import { calculateCapacity } from "./capacity";
import { interpretAssessment } from "./interpretation";
import { scoreAssessment } from "./scoring";
import type { AssessmentAnswers } from "./types";

export function buildAssessmentResult(answers: AssessmentAnswers) {
  const score = scoreAssessment(answers);
  const capacity = calculateCapacity(answers.capacity);
  const interpretation = interpretAssessment(score, answers);
  const category = score.category === "incomplete" ? "incomplete" : score.category;
  return {
    methodologyVersion: ASSESSMENT_VERSION,
    score,
    capacity,
    interpretation,
    narrative: {
      source: "rules" as const,
      summary: `This ${category} result identifies likely operating exposure from self-reported information; it does not validate root causes.`,
    },
  };
}
```

- [ ] **Step 4: Implement the preliminary result**

`PreliminaryResult.tsx` must display only:

- overall score or `Result incomplete`;
- category and score confidence;
- top two risk labels;
- one directly reported time insight when available;
- locked previews for component scores, capacity, priorities, and PDF;
- `Unlock my full assessment` and `Review my answers`.

It must never display monetary capacity before contact capture.

- [ ] **Step 5: Implement contact and consent**

`ContactGate.tsx` accepts:

```ts
export type LeadDetails = {
  name: string;
  workEmail: string;
  company: string;
  phone?: string;
  reportConsent: true;
  marketingConsent: boolean;
};
```

Validate name, work email, company, and report consent. State that phone and marketing consent are optional and independent.

- [ ] **Step 6: Implement optional exact inputs**

`PrecisionInputs.tsx` provides exact numeric fields for owner intervention, team reporting/reconciliation, and rework. Each category requires complete time, frequency, people where applicable, and cost fields before inclusion. Provide:

- `Use my earlier ranges`;
- `Skip financial estimate`;
- `Calculate with exact inputs`.

Prevent reporting-correction hours from being entered in both reporting and rework by placing the approved exclusion language beside the rework fields.

- [ ] **Step 7: Implement full results**

`FullResult.tsx` renders, in order:

1. overall score, category, score confidence, and impact confidence;
2. rules-based executive interpretation;
3. three component scores;
4. three evidence-backed risk codes;
5. calculated, directional, or unavailable capacity block;
6. three controlled priorities;
7. missing evidence that would improve confidence;
8. limitations and routed CTA.

Use bars or simple tables, not gauges or speedometers.

- [ ] **Step 8: Connect the complete flow**

Update `AssessmentFlow.tsx` states to:

```ts
type Screen =
  | "landing" | "context" | "ownerIndependence" | "operatingSystem"
  | "informationVisibility" | "preliminary" | "contact"
  | "precision" | "processing" | "full";
```

Compute the preliminary result locally. After valid lead details, proceed even if precision inputs are skipped.

- [ ] **Step 9: Verify and commit**

Run:

```powershell
npm run lint
npm test
```

Expected: all tests PASS.

```powershell
git add app/assessment lib/assessment/result.ts tests/assessment/result.test.mjs
git commit -m "feat: deliver gated assessment results"
```

### Task 6: Add deterministic API recomputation and tamper tests

**Files:**
- Create: `app/api/assessment/calculate/route.ts`
- Create: `lib/assessment/validation.ts`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: raw JSON and `buildAssessmentResult`.
- Produces: `POST /api/assessment/calculate` returning `{ ok, assessmentId, result }`.

- [ ] **Step 1: Add failing endpoint tests**

Append:

```js
test("assessment calculation rejects client-supplied scores and recomputes the result", async () => {
  const response = await request("/api/assessment/calculate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers: { scored: {} }, overall: 100 }),
  });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).ok, false);
});
```

- [ ] **Step 2: Verify failure**

Run `npm test`.

Expected: FAIL because the route returns 404.

- [ ] **Step 3: Implement strict validation**

Create `lib/assessment/validation.ts` with `parseAssessmentPayload(input: unknown)` that:

- accepts only the declared context, scored, capacity, and lead fields;
- rejects unknown score values;
- rejects negative, non-finite, or implausibly large time/cost inputs;
- requires report consent when lead fields are present;
- ignores and never trusts `overall`, `components`, `riskCodes`, `route`, or financial outputs from the browser;
- returns field-specific errors.

Use exact limits:

```ts
const LIMITS = {
  people: { min: 1, max: 10000 },
  hoursPerOccurrence: { min: 0, max: 168 },
  occurrencesPerYear: { min: 0, max: 365 },
  hourlyCost: { min: 0, max: 10000 },
} as const;
```

- [ ] **Step 4: Implement server recomputation**

Create the route:

```ts
import { NextResponse } from "next/server";
import { buildAssessmentResult } from "../../../../lib/assessment/result";
import { parseAssessmentPayload } from "../../../../lib/assessment/validation";

export async function POST(request: Request) {
  const parsed = parseAssessmentPayload(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json(parsed, { status: 422 });
  const result = buildAssessmentResult(parsed.answers);
  return NextResponse.json({ ok: true, assessmentId: crypto.randomUUID(), result });
}
```

- [ ] **Step 5: Switch final calculation to the API**

Update `AssessmentFlow.tsx` to post raw answers and lead details at the processing screen. Render only the server result. If the request fails, retain the locally computed rules result and show:

> Your result is available on screen, but report storage and delivery are temporarily unavailable.

- [ ] **Step 6: Verify Release A**

Run:

```powershell
npm run lint
npm test
```

Manually verify:

- high-, medium-, low-, and incomplete-score paths;
- conditional questions;
- refresh recovery;
- keyboard completion;
- preliminary gate boundary;
- exact-input skip;
- restricted routing;
- server failure fallback.

- [ ] **Step 7: Commit Release A**

```powershell
git add app/api/assessment lib/assessment/validation.ts app/assessment tests/rendered-html.test.mjs
git commit -m "feat: validate and recompute assessment server-side"
```

### Task 7: Provision D1 and store the compact reproducible record

**Files:**
- Modify: `.openai/hosting.json`
- Modify: `db/schema.ts`
- Create: `drizzle/0001_assessment_records.sql`
- Create: `lib/assessment/record.ts`
- Modify: `app/api/assessment/calculate/route.ts`
- Test: `tests/assessment/record.test.mjs`

**Interfaces:**
- Consumes: validated lead details and deterministic result.
- Produces: `toAssessmentRecord` and a D1 `assessment_records` row.

- [ ] **Step 1: Provision the Sites D1 binding**

Use the Sites hosting tools, reusing the exact `project_id` in `.openai/hosting.json`, to provision a D1 binding named `DB`. Update `.openai/hosting.json` only with the opaque value returned by Sites; never invent an ID.

- [ ] **Step 2: Write the compact-record test**

Create:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { toAssessmentRecord } from "../../lib/assessment/record.ts";

test("compact record excludes detailed scored answers", () => {
  const record = toAssessmentRecord({
    id: "assessment-1",
    lead: { name: "Eddie", workEmail: "e@example.com", company: "Example", reportConsent: true, marketingConsent: false },
    result: {
      methodologyVersion: "1.0.0",
      score: { overall: 58, category: "developing", confidence: { level: "high", coverage: 1 }, components: {} },
      capacity: { confidence: "low", estimateType: "unavailable", annualValue: null },
      interpretation: { riskCodes: ["owner_bottleneck"], priorities: [], route: "diagnostic" },
    },
  });
  assert.equal("answers" in record, false);
  assert.equal(record.overallScore, 58);
  assert.equal(record.reportConsent, true);
});
```

- [ ] **Step 3: Define the Drizzle table**

In `db/schema.ts`, define `assessmentRecords` with:

- `id` text primary key;
- `assessmentVersion`, `createdAt`;
- contact fields and consent booleans;
- `overallScore` nullable integer;
- three component scores nullable integer;
- `scoreCoverage`, `scoreConfidence`, `impactConfidence`;
- `estimateType`, recoverable hours low/high, annual value low/high nullable;
- JSON text for up to three risk codes and controlled priority IDs;
- `leadRoute`;
- `narrativeSource`;
- `reportDeliveryStatus`.

Do not add a raw-answer or free-text-answer column.

- [ ] **Step 4: Generate and inspect migration**

Run:

```powershell
npm run db:generate
```

Confirm the generated SQL creates only the compact fields above.

- [ ] **Step 5: Implement record mapping**

Create `lib/assessment/record.ts` with a pure `toAssessmentRecord({ id, lead, result })` mapper. Explicitly select allowed fields instead of spreading input objects.

- [ ] **Step 6: Persist without blocking on email**

Update the calculation route to:

1. recompute the result;
2. insert the compact record;
3. return the assessment ID and result;
4. return a local result with `persistenceAvailable: false` if D1 is unavailable.

Never claim report email delivery from this route.

- [ ] **Step 7: Verify and commit**

Run:

```powershell
npm run test:domain
npm run lint
npm run build
```

```powershell
git add .openai/hosting.json db/schema.ts drizzle lib/assessment/record.ts app/api/assessment/calculate/route.ts tests/assessment/record.test.mjs
git commit -m "feat: retain compact assessment records"
```

### Task 8: Generate and download the seven-page executive PDF

**Files:**
- Modify: `package.json`
- Create: `lib/report/pdf.ts`
- Create: `app/api/assessment/[id]/report/route.ts`
- Modify: `app/assessment/FullResult.tsx`
- Test: `tests/assessment/pdf.test.mjs`

**Interfaces:**
- Consumes: compact stored result by assessment ID.
- Produces: `buildAssessmentPdf(record): Promise<Uint8Array>` and `GET /api/assessment/:id/report`.

- [ ] **Step 1: Install and test PDF generation**

Run:

```powershell
npm install pdf-lib@1.17.1
```

Create a failing test asserting the output begins with `%PDF-` and contains at least seven pages when loaded with `PDFDocument.load`.

- [ ] **Step 2: Implement the report**

Create `lib/report/pdf.ts` using `pdf-lib`. Define shared helpers:

```ts
const PAGE = { width: 612, height: 792, margin: 54 };
const COLORS = {
  paper: rgb(0.984, 0.980, 0.965),
  ink: rgb(0.094, 0.137, 0.118),
  forest: rgb(0.090, 0.247, 0.196),
  bronze: rgb(0.604, 0.412, 0.227),
};
```

Generate exactly seven pages:

1. cover;
2. executive summary;
3. component scores;
4. recoverable capacity or missing-input explanation;
5. risk profile;
6. 90-day priority direction;
7. methodology, limitations, professional boundary, and routed CTA.

Every numeric estimate must include `exact input`, `banded input`, `derived`, or `realization-adjusted`.

- [ ] **Step 3: Add an authenticated-by-ID download route**

Use the unguessable UUID assessment ID, fetch the compact record, generate the PDF in memory, and return:

```ts
return new Response(pdfBytes, {
  headers: {
    "content-type": "application/pdf",
    "content-disposition": `attachment; filename="business-independence-assessment-${id}.pdf"`,
    "cache-control": "private, no-store",
  },
});
```

Return 404 for unknown IDs. Do not expose a list endpoint.

- [ ] **Step 4: Add immediate download**

Show `Download executive summary` in `FullResult.tsx` whenever persistence succeeds. If persistence is unavailable, provide a browser-print fallback with print CSS and state that email delivery is unavailable.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm run test:domain
npm run lint
npm run build
```

Open a generated PDF and verify all seven pages, wrapping, grayscale readability, and no clipped text.

```powershell
git add package.json package-lock.json lib/report app/api/assessment app/assessment/FullResult.tsx tests/assessment/pdf.test.mjs
git commit -m "feat: generate executive assessment PDF"
```

### Task 9: Add report email delivery and privacy disclosures

**Files:**
- Create: `lib/email/assessment-report.ts`
- Create: `app/api/assessment/[id]/deliver/route.ts`
- Modify: `app/assessment/AssessmentFlow.tsx`
- Modify: `app/privacy/page.tsx`
- Modify: `.env.example`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: stored assessment and generated PDF.
- Produces: `POST /api/assessment/:id/deliver`.

- [ ] **Step 1: Add delivery tests**

Test that:

- invalid IDs return 404;
- missing Resend configuration returns 503 and never reports success;
- a mocked successful Resend response updates `reportDeliveryStatus` to `sent`;
- report consent is required;
- marketing consent is not required.

- [ ] **Step 2: Implement the email builder**

Create a pure `buildAssessmentEmail(record)` returning subject, escaped HTML, plain text, and attachment filename. The email must:

- summarize score/category and confidence;
- link back to the result;
- attach the generated PDF;
- state the self-reported and non-audit limitation;
- avoid a consulting CTA for restricted records.

- [ ] **Step 3: Implement delivery**

Follow the existing Resend pattern, attaching the base64 PDF. Update status to `sent` only after Resend returns success. On failure, retain the record and immediate download.

- [ ] **Step 4: Update configuration and privacy**

Add to `.env.example`:

```text
RESEND_API_KEY=
CONTACT_TO_EMAIL=
CONTACT_FROM_EMAIL=
ASSESSMENT_REPORT_FROM_EMAIL=
```

Update the privacy page with:

- compact fields retained;
- purposes of report delivery, reproducibility, and qualification;
- separate marketing consent;
- no default retention of detailed free-text operating answers;
- retention period and deletion-request channel;
- AI explanation disclosure;
- self-reported assessment disclaimer.

Before deployment, replace the retention-period text with an explicit approved duration; if none is approved, do not enable persistence in production.

- [ ] **Step 5: Verify Release B and commit**

Run:

```powershell
npm run lint
npm test
```

Manually simulate successful and failed delivery. Confirm the result and download remain available in both cases.

```powershell
git add lib/email app/api/assessment app/assessment/AssessmentFlow.tsx app/privacy/page.tsx .env.example tests/rendered-html.test.mjs
git commit -m "feat: deliver assessment reports with explicit consent"
```

### Task 10: Add optional AI narrative with deterministic validation

**Files:**
- Create: `lib/assessment/narrative.ts`
- Create: `lib/assessment/narrative-validation.ts`
- Create: `app/api/assessment/[id]/narrative/route.ts`
- Modify: `.env.example`
- Test: `tests/assessment/narrative.test.mjs`

**Interfaces:**
- Consumes: normalized deterministic result and safe business context.
- Produces: `generateValidatedNarrative` returning either `{ source: "ai", text }` or the complete rules fallback.

- [ ] **Step 1: Write narrative-validation tests**

Create tests that reject AI output when it:

- contains a financial number absent from deterministic capacity output;
- invents a risk code or benchmark;
- recommends an item outside the controlled priority library;
- promises savings, revenue, valuation, or guaranteed results;
- mislabels an estimate as fact;
- produces a commercial CTA for a restricted record.

Also test that timeout, malformed JSON, and missing API configuration return the rules narrative.

- [ ] **Step 2: Define a strict output contract**

Use this internal shape:

```ts
type NarrativeDraft = {
  summary: string;
  componentObservations: Array<{ component: string; observation: string }>;
  priorityExplanation: string;
  limitations: string;
};
```

The model input contains only:

- component and overall scores;
- approved risk codes and their answer-based evidence labels;
- capacity output and source labels;
- both confidence levels;
- selected controlled priorities;
- employee/revenue bands and visitor role;
- restricted-market flag.

- [ ] **Step 3: Implement generation**

Call the configured model through a server-only route with a short timeout. Request JSON matching `NarrativeDraft`. Never send name, email, phone, or detailed raw answers.

Add to `.env.example`:

```text
OPENAI_API_KEY=
ASSESSMENT_NARRATIVE_MODEL=
```

If either variable is absent, immediately return the rules narrative.

- [ ] **Step 4: Implement deterministic validation**

`validateNarrative(draft, result)` must:

- extract currency, percentages, and hour figures and require exact membership in the deterministic result;
- require exactly the known component names;
- reject benchmark phrases such as `industry average`, `top quartile`, and `companies like yours`;
- reject guarantee language;
- require the limitations text to include `self-reported` and `not an audit`;
- reject any CTA not selected by deterministic routing.

- [ ] **Step 5: Store only accepted source and narrative**

Update the compact record with `narrativeSource` and the accepted narrative. When validation fails, store the rules narrative and `narrativeSource = "rules"`.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
npm run test:domain
npm run lint
npm run build
```

```powershell
git add lib/assessment/narrative.ts lib/assessment/narrative-validation.ts app/api/assessment .env.example tests/assessment/narrative.test.mjs db/schema.ts drizzle
git commit -m "feat: add validated assessment narrative"
```

### Task 11: Add privacy-conscious product analytics

**Files:**
- Create: `lib/analytics/assessment.ts`
- Create: `app/api/assessment/events/route.ts`
- Create: `db/schema.ts`
- Create: new Drizzle migration
- Modify: `app/assessment/AssessmentFlow.tsx`
- Test: `tests/assessment/analytics.test.mjs`

**Interfaces:**
- Consumes: event name, session assessment ID, screen, confidence/result category when available.
- Produces: allowlisted assessment events without raw answers or contact details.

- [ ] **Step 1: Define and test the event allowlist**

Allow only:

```ts
export const ASSESSMENT_EVENTS = [
  "assessment_started",
  "section_completed",
  "preliminary_result_reached",
  "contact_gate_completed",
  "precision_completed",
  "precision_skipped",
  "full_result_viewed",
  "pdf_downloaded",
  "cta_shown",
  "inquiry_submitted",
] as const;
```

Tests must reject unknown events and payload keys such as `answers`, `email`, `name`, `phone`, or free text.

- [ ] **Step 2: Add a minimal event table and route**

Store:

- random event ID;
- assessment ID when available;
- event name;
- screen or section;
- result category, score confidence, impact confidence, and route when applicable;
- timestamp.

Do not store IP address, user agent, raw answers, or contact details in the event record.

- [ ] **Step 3: Instrument the flow**

Send events with `navigator.sendBeacon` where appropriate and `fetch(..., { keepalive: true })` otherwise. Analytics failure must never block navigation or result generation.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
npm run test:domain
npm run lint
npm run build
```

```powershell
git add lib/analytics app/api/assessment/events app/assessment/AssessmentFlow.tsx db/schema.ts drizzle tests/assessment/analytics.test.mjs
git commit -m "feat: measure assessment funnel safely"
```

### Task 12: Complete accessibility, failure-state, production, and deployment verification

**Files:**
- Modify: `app/assessment/*.tsx`
- Modify: `app/assessment/assessment.css`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `README.md`
- Modify: `.openai/hosting.json` only through confirmed Sites responses

**Interfaces:**
- Consumes: complete Releases A–C.
- Produces: a verified saved version and production Sites deployment.

- [ ] **Step 1: Add end-to-end rendered-contract tests**

Cover:

- assessment and paid diagnostic remain separate routes;
- preliminary result contains no monetary estimate;
- phone and marketing consent are optional;
- result limitations are visible;
- restricted path contains no consulting invitation;
- PDF/download fallback copy exists;
- privacy route describes compact retention and deletion.

- [ ] **Step 2: Verify accessibility**

Using the browser QA workflow, complete the assessment using only the keyboard. Verify:

- one logical `h1`;
- fieldsets and legends for all response groups;
- visible focus;
- screen changes move focus to the new heading;
- progress has accessible text;
- errors are associated with fields and announced;
- contrast meets WCAG AA;
- reduced-motion preference is respected;
- mobile viewport has no horizontal overflow.

- [ ] **Step 3: Verify all result matrices**

Test these fixtures:

| Score confidence | Impact confidence | Expected result |
|---|---|---|
| High | High | Scores plus calculated capacity range |
| High | Medium | Scores plus directional capacity range |
| High | Low | Scores plus non-financial indicators |
| Medium | High | Scores with evidence gaps plus calculated capacity |
| Low | Medium | Preliminary score caveat plus directional range |
| Incomplete | Any | No numeric overall score |

Also verify `Unknown`, all three conditional questions, restricted routing, AI rejection, D1 failure, email failure, refresh recovery, duplicate delivery, and unknown report ID.

- [ ] **Step 4: Run the complete verification suite**

Run:

```powershell
npm run lint
npm test
```

Expected: all lint, domain, build, and rendered-route tests PASS.

- [ ] **Step 5: Document operations**

Update `README.md` with:

- assessment architecture and methodology version;
- required and optional environment variables;
- D1 migration command;
- local rules-only mode;
- email and AI fallback behavior;
- data deletion procedure;
- production smoke-test checklist.

- [ ] **Step 6: Commit verified release**

```powershell
git add app/assessment tests/rendered-html.test.mjs README.md
git commit -m "docs: finalize assessment operations and verification"
```

- [ ] **Step 7: Push exact source and save a Sites version**

Read `.openai/hosting.json`, use its exact `project_id`, push the current commit, and save a Sites version whose `commit_sha` matches the pushed source exactly.

- [ ] **Step 8: Deploy the saved version**

Deploy only the saved version. Inspect deployment status until terminal. Confirm:

- `/assessment` loads;
- a rules-only result completes;
- D1 persistence works;
- PDF download works;
- missing AI configuration falls back cleanly;
- missing email configuration reports failure without losing the result;
- restricted routing suppresses the consulting CTA.

- [ ] **Step 9: Record deployment outcome**

Add the production URL, deployed version ID, commit SHA, verification date, and known environment limitations to the release notes. Do not claim email or AI delivery works unless both were tested successfully in production.

## Self-Review Record

### Spec coverage

- Question weights and behavioral anchors: Task 1.
- Required versus conditional counts: Tasks 1 and 4.
- Unknown and not-applicable handling: Tasks 1, 2, and 12.
- Score confidence: Tasks 2, 5, and 12.
- Capacity confidence, double-counting, and realization: Tasks 3, 5, and 12.
- Preliminary value and contact gate: Task 5.
- Screen sequence and browser recovery: Tasks 4–6.
- Deterministic server recomputation: Task 6.
- Compact retention and reproducibility: Task 7.
- Seven-page report: Task 8.
- Consent, email, and privacy: Task 9.
- AI validation and fallback: Task 10.
- Qualification routing and professional boundaries: Tasks 3, 5, and 12.
- Analytics and launch measures: Task 11.
- Failure states, accessibility, and deployment: Task 12.
- Free-versus-paid boundary: Tasks 5, 8, 9, and 12.

### Deferred scope preserved

The plan does not add automated proposals, calendar scheduling, CRM enrichment, external industry benchmarks, valuation estimates, conversational scoring, respondent accounts, multiple paid-service routes, or bespoke automated implementation roadmaps.
