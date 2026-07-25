# Business Independence Assessment — Experience and Report Design

## Purpose

Create a five-minute, executive-level assessment that helps a founder or CEO see where the business still depends on individual intervention, informal operating practices, or delayed management information.

The assessment is a lead-generation and qualification product, but it must deliver credible standalone value. Its role is to reveal likely exposure and the scale of recoverable capacity. It must not claim to validate root causes or replace the paid Business Independence Diagnostic.

## Product Promise

Primary promise:

> In five minutes, identify where your business depends most on owner intervention, how much operating capacity may be recoverable, and where to focus first.

The result must help a visitor answer four questions:

1. How independently can the business operate today?
2. Which operating constraints create the greatest exposure?
3. How confident can the visitor be in the result and impact estimate?
4. What is the proportionate next step?

## Design Principles

1. **Deterministic before generative.** Scores, risk flags, confidence, estimates, and recommendations come from versioned rules. AI may explain those outputs but may not create or alter them.
2. **Result-first design.** Every question must earn its place by changing a score, confidence level, risk flag, capacity estimate, recommendation, or lead route.
3. **Consistent score direction.** A higher number is always better. `100` means greater independence or maturity.
4. **Evidence-aware precision.** Exact figures produce calculated estimates; complete bands produce directional ranges; weak inputs produce non-financial indicators.
5. **Value before contact capture.** Visitors see a credible preliminary result before being asked for contact information.
6. **One primary commercial entry point.** High-fit respondents are invited to the Business Independence Diagnostic. The assessment does not fragment the offer into multiple consulting services.
7. **Visible limits.** All outputs distinguish self-reported indications from validated findings.

## Result Architecture

### Primary scores

The assessment produces three component scores and one overall score:

| Score | Weight in overall score | What it measures |
|---|---:|---|
| Owner Independence | 35% | Whether routine decisions, exceptions, and operating continuity depend on the owner |
| Operating-System Maturity | 35% | Whether ownership, workflows, documentation, cross-training, and management cadence are established |
| Information Visibility | 30% | Whether leaders receive timely, reliable, decision-ready operating information |
| Business Independence Score | 100% | Weighted composite of the three component scores |

AI Readiness and Automation Opportunity are secondary indicators. They may appear as opportunity flags or narrative observations, but they do not affect the Business Independence Score in version 1.

### Score categories

| Score | Category | Interpretation |
|---:|---|---|
| 80–100 | Strong independence | Core operating mechanisms are largely established; remaining issues are targeted rather than systemic |
| 65–79 | Emerging independence | The business can operate with partial independence, but important exceptions still rely on individuals |
| 45–64 | Developing independence | Several operating mechanisms are informal or inconsistent, creating recurring intervention |
| 0–44 | High dependency | Routine continuity, decisions, or visibility depend heavily on the owner or a small number of people |

If scoring coverage is below 60%, do not show a numeric overall score. Show `Result incomplete` and identify the unanswered areas required to calculate it.

## Confidence Architecture

### Score confidence

Score confidence reflects answer completeness and component coverage. It does not assess whether self-reported answers are objectively accurate.

| Level | Required conditions | Result treatment |
|---|---|---|
| High | At least 90% of applicable weighted questions answered; every component has at least 80% coverage; no more than one `Unknown` | Show overall and component scores with normal interpretation |
| Medium | At least 75% overall coverage; every component has at least 65% coverage; no more than three `Unknown` answers | Show scores and identify the missing evidence that would improve confidence |
| Low | Below medium thresholds, four or more `Unknown` answers, or inadequate coverage in one component | Show the score only if total coverage is at least 60%; emphasize that it is preliminary |
| Incomplete | Below 60% total coverage | Suppress numeric overall score |

Two or more `Unknown` answers within one component cap that component's narrative interpretation at `Developing independence`, even if its numeric score is higher. This prevents lack of visibility from being mistaken for maturity.

### Impact confidence

Impact confidence applies only to recoverable-capacity outputs and is calculated independently from score confidence.

| Level | Required conditions | Output |
|---|---|---|
| High | Exact time, frequency, and labor-cost inputs are available for at least two eligible capacity categories | Calculated gross and recoverable hours plus a calculated annual capacity-value range |
| Medium | Complete banded inputs are available for at least two eligible capacity categories | Directional gross and recoverable hours plus a directional annual capacity-value range |
| Low | Inputs are missing or incomplete for two or more eligible categories | Non-financial impact indicators only; no monetary figure |

Every result states why the confidence level was assigned and which missing inputs would improve it.

## Question Model

### Response anchors

Every scored response maps to one of five values:

| Value | General behavioral anchor |
|---:|---|
| 0 | Almost always owner-dependent, reactive, undocumented, delayed, or unavailable |
| 25 | Usually dependent or informal; isolated exceptions exist |
| 50 | Mixed and inconsistent; the mechanism works in some areas but not reliably |
| 75 | Usually delegated, standardized, or decision-ready; limited exceptions remain |
| 100 | Consistently independent, documented, timely, and resilient |

Question copy must describe observable behavior, not ask visitors to rate themselves with abstract labels such as `good` or `mature`.

### Required and conditional count

- 15 required scored questions: five per primary component.
- Up to three conditional scored questions: customer-relationship concentration, cross-team consistency, and system connectivity.
- Six required context inputs used for normalization, qualification, or branching.
- Three optional cost/time bands before the preliminary result.
- Optional exact financial and time inputs after the contact gate.

The default path should require approximately 21 inputs before the preliminary result. The interface displays estimated time remaining rather than a question count, because conditional branching changes the total.

### Owner Independence — 35% of overall score

| Question behavior | Internal weight | 0 anchor | 50 anchor | 100 anchor |
|---|---:|---|---|---|
| Critical decisions requiring owner approval | 30% | Nearly all material operating decisions wait for the owner | Decision rights vary by manager or situation | Defined decisions are made at the appropriate level without owner approval |
| Ability to operate during a two-week owner absence | 25% | Routine work or decisions would stall | Core work continues, but several issues accumulate or require contact | Operations and management cadence continue without owner contact |
| Manager decision authority | 20% | Managers execute tasks but lack genuine decision authority | Authority exists in selected functions or within unclear limits | Managers have explicit decision rights, limits, and escalation paths |
| Exception resolution | 15% | Exceptions routinely escalate to the owner | Teams resolve common exceptions but escalate inconsistent cases | Standard exceptions are resolved at the correct level using defined rules |
| Work waiting for owner input | 10% | Work queues regularly form while awaiting owner input | Waiting occurs intermittently in specific areas | Owner input rarely blocks routine execution |
| Customer or partner relationship concentration — conditional | 10% | Key relationships depend primarily on the owner | Relationships are shared but the owner remains central | Relationships are institutionally owned with documented coverage |

When the conditional relationship question applies, the five base weights are proportionally scaled to 90% and the conditional question receives 10%.

### Operating-System Maturity — 35% of overall score

| Question behavior | Internal weight | 0 anchor | 50 anchor | 100 anchor |
|---|---:|---|---|---|
| Documentation of recurring workflows | 25% | Critical workflows reside in individual memory | Selected workflows are documented but incomplete or outdated | Critical workflows are current, accessible, and routinely used |
| Clear process and outcome ownership | 20% | Ownership is assumed or disputed | Ownership is clear in some functions but weak across boundaries | Critical outcomes and workflows have explicit accountable owners |
| Decision and escalation rules | 20% | Teams rely on personal judgment or owner intervention | Informal rules exist but vary by manager | Decision thresholds and escalation paths are explicit and consistently used |
| Cross-training and continuity | 15% | Important work has a single point of failure | Backup coverage exists for selected roles | Critical responsibilities have tested backup coverage |
| Management operating cadence | 20% | Reviews are reactive or irregular | Recurring meetings exist but do not consistently drive decisions | A defined cadence connects performance, decisions, actions, and accountability |
| Cross-team process consistency — conditional | 15% | Teams perform the same critical work in materially different ways | Common intent exists but execution varies | Shared standards govern critical cross-team workflows |

When cross-team consistency applies, the five base weights are proportionally scaled to 85% and the conditional question receives 15%.

### Information Visibility — 30% of overall score

| Question behavior | Internal weight | 0 anchor | 50 anchor | 100 anchor |
|---|---:|---|---|---|
| KPI availability at the point of decision | 25% | Leaders cannot access current performance measures when needed | Core KPIs exist but require preparation or interpretation | Current, decision-relevant KPIs are available within the management cadence |
| Manual report preparation | 20% | Most recurring reporting is manually assembled | Some recurring reports are automated, but material manual work remains | Routine reporting is largely automated with controlled human review |
| Reconciliation and data trust | 20% | Leaders regularly debate whose numbers are correct | Reconciliation occurs for selected measures or periods | Definitions, sources, and controls produce broadly trusted information |
| Speed of detecting operating problems | 20% | Problems surface through customer impact, cash impact, or owner intervention | Reviews identify problems after a meaningful delay | Leading and lagging indicators reveal issues early enough to act |
| KPI review cadence and action | 15% | Metrics are reviewed irregularly or without ownership | Reviews occur but actions and follow-through vary | Reviews consistently produce decisions, owners, and tracked actions |
| System connectivity — conditional | 10% | Critical information is repeatedly re-keyed or moved manually | Selected integrations exist, with significant gaps | Critical systems exchange required information through controlled workflows |

When system connectivity applies, the five base weights are proportionally scaled to 90% and the conditional question receives 10%.

## Unknown and Not-Applicable Treatment

### Unknown

- Exclude the question weight from both numerator and denominator.
- Lower score confidence according to the published thresholds.
- Add a `measurement_gap` risk flag when the unknown answer relates to a critical decision, workflow, or KPI.
- Never silently impute the most common, midpoint, or favorable response.
- Explain that inability to answer may itself indicate limited operating visibility, without converting that inference into a score penalty.

### Not applicable

`Not applicable` is allowed only for:

- customer or partner relationship concentration;
- cross-team process consistency;
- system connectivity.

The option is shown only when a prior context answer supports it. A valid not-applicable response removes the weight without reducing confidence. It must not be offered as a general escape option.

## Recoverable-Capacity Model

### Eligible categories

The deterministic model estimates three mutually exclusive categories:

1. **Owner intervention:** avoidable owner time spent approving routine decisions, resolving standard exceptions, or unblocking work.
2. **Team reporting and reconciliation:** employee and manager time spent collecting, re-keying, compiling, and reconciling recurring management information.
3. **Rework:** time spent correcting preventable workflow errors or repeating work due to unclear ownership, documentation, or handoffs.

### Excluded categories

Do not monetize:

- decision-delay opportunity cost;
- missed revenue or growth;
- relationship concentration;
- enterprise valuation;
- employee disengagement or turnover;
- strategic opportunity cost.

These may appear as qualitative risk indicators when supported by answers.

### Double-counting controls

- Owner hours are excluded from team reporting and rework hours.
- Time spent correcting a report is counted as rework only when it is excluded from report-preparation time.
- A single event may contribute to only one capacity category.
- Where the respondent cannot separate overlapping activities, assign the time to the most direct category and disclose the classification.
- No score-derived multiplier may create hours that the visitor did not report directly or through a stated band.

### Realization rules

The model distinguishes theoretical gross capacity from realistically recoverable capacity:

- High impact confidence: apply a 50%–70% realization range.
- Medium impact confidence: apply a 35%–55% realization range.
- Low impact confidence: do not calculate financial value.

The result displays gross hours, estimated recoverable hours, and—when eligible—annual capacity value. It does not label the result as a loss, savings guarantee, or productivity leakage.

Every financial figure must identify:

- whether the source was exact, banded, or derived;
- the time and frequency assumptions;
- the labor-cost input or band;
- the realization factor;
- the assessment version.

## Screen-by-Screen Experience

### Screen 0 — Assessment landing

**Purpose:** Establish value, fit, time, and trust before the first question.

**Content:**

- Headline: `How independently can your business operate?`
- Promise: score operating independence, identify the primary constraints, and estimate recoverable capacity in approximately five minutes.
- Deliverables preview: overall score, three component scores, top risks, capacity indication, priority direction, and executive-summary PDF.
- Method note: deterministic scoring based on self-reported information; AI may explain but does not score.
- Privacy note: detailed operating answers are not retained as a permanent lead profile.
- Primary action: `Start the assessment`.

### Screen 1 — Business context

**Purpose:** Establish applicability, branching, qualification, and optional impact inputs.

**Required inputs:**

- employee-count band;
- number of managers or management layers;
- annual-revenue band;
- visitor role;
- number and type of core operating systems;
- whether the company has multiple teams, locations, or operating units.

**Conditional inputs:**

- whether important customer or partner relationships are owner-led;
- whether workflows cross multiple teams;
- whether critical information moves between two or more systems.

**Optional precision inputs:**

- blended employee-cost band;
- approximate owner-time band;
- recurring reporting-effort band.

If the respondent identifies a restricted competitive situation under Eddie's professional boundaries, the assessment may continue as an educational tool but cannot route to a commercial inquiry.

### Screen 2 — Owner independence

**Purpose:** Measure concentration of decisions, continuity, authority, and exceptions.

Show one behaviorally anchored question at a time. Use plain-language response choices and a brief `Why this matters` disclosure on request. Avoid displaying points or weights.

### Screen 3 — Operating-system maturity

**Purpose:** Measure whether the organization has the minimum mechanisms required to operate consistently without individual memory or intervention.

Use the same interaction pattern as Screen 2. Conditional cross-team consistency appears only when business context makes it relevant.

### Screen 4 — Information visibility

**Purpose:** Measure management reporting readiness, data trust, issue detection, and recurring manual effort.

System connectivity appears only when more than one critical system is used. The question focuses on required information flow, not the number of software products.

### Screen 5 — Preliminary result

**Purpose:** Deliver enough value to establish credibility before contact capture.

Display:

- Business Independence Score or `Result incomplete`;
- score category;
- score-confidence label;
- top two deterministic risk flags;
- one quantified non-financial insight, such as reported owner or team hours;
- a locked preview of the three component scores, recoverable-capacity analysis, priority direction, and PDF.

Do not show a monetary capacity estimate before the gate. Do not manufacture a quantified insight from score values; it must come from a direct or banded time response.

Primary action: `Unlock my full assessment`.
Secondary action: `Review my answers`.

### Screen 6 — Contact and consent

**Purpose:** Exchange the full result for proportionate contact information.

**Required:**

- name;
- work email;
- company;
- explicit consent to generate and email the report.

**Optional:**

- phone;
- job title if not already captured.

Marketing consent must be separate and optional. Report delivery consent does not imply newsletter consent. The form states what compact assessment information will be retained.

### Screen 7 — Improve estimate precision

**Purpose:** Offer, but not require, exact inputs that can improve impact confidence.

Allow exact entry for:

- owner hours and frequency;
- team participants, hours, and frequency for reporting/reconciliation;
- rework participants, hours, and frequency;
- applicable hourly or annual labor costs.

Provide `Use my earlier ranges` and `Skip financial estimate` options. Explain immediately how exact data changes the output. Never hold the already-promised report hostage to these optional questions.

### Screen 8 — Calculation and narrative generation

**Purpose:** Produce a complete result while making processing transparent.

Processing order:

1. validate and normalize inputs;
2. run the deterministic scoring engine;
3. calculate score and impact confidence independently;
4. generate component scores and risk flags;
5. calculate eligible capacity outputs;
6. select priorities through the rules engine;
7. classify lead fit and urgency;
8. generate an optional AI narrative;
9. validate the AI narrative;
10. use the rules-based narrative if AI is unavailable, times out, or fails validation.

The visitor sees a short progress state framed around analysis steps, not artificial waiting.

### Screen 9 — Full results

**Purpose:** Explain the result in an executive sequence: conclusion, evidence, implications, action.

Display sections in this order:

1. overall score, category, and both confidence measures;
2. executive interpretation;
3. three component scores;
4. top three risks with answer-based evidence;
5. recoverable-capacity output or non-financial indicators;
6. three category-level 90-day priorities;
7. what would improve confidence;
8. methodology and limitations;
9. report download and next-step route.

The on-screen result must be useful without downloading the PDF.

### Screen 10 — Proportionate next step

**Purpose:** Route respondents without turning the assessment into a generic sales funnel.

| Route | Conditions | Primary action |
|---|---|---|
| Diagnostic fit | Sufficient company scale, material dependency, meaningful urgency, and no professional-boundary conflict | `Discuss the Business Independence Diagnostic` |
| Nurture | Moderate exposure, low urgency, incomplete readiness, or early-stage scale | `Get the 90-Day Business Independence Checklist` |
| Insights | Strong independence or primarily educational interest | `Explore executive operating insights` |
| Restricted | Potential conflict with stated professional boundaries | Educational resources only; no consulting invitation |

Lead-fit classification is not shown as a grade. The visitor sees only the relevant recommendation and the reason it fits the result.

## Rules-Based Priority Engine

Priorities are selected from a controlled library and ranked by:

1. lowest component score;
2. severity of deterministic risk flags;
3. reported capacity exposure;
4. prerequisite order;
5. feasibility within 90 days.

Each priority includes:

- the observed pattern;
- why it matters;
- a category-level action;
- a measurable leading indicator.

The free result does not provide a bespoke implementation sequence, detailed workflow redesign, named system architecture, or implementation estimate.

## AI Narrative Guardrails

AI receives only normalized score outputs, approved risk evidence, capacity outputs, confidence labels, selected priorities, and safe business context. It should not require all raw answers.

The generated narrative is accepted only if:

- every factual claim maps to an input, deterministic output, or approved rule;
- every financial figure exactly matches the capacity engine;
- it introduces no new risk category;
- it does not introduce an unsupported benchmark;
- it distinguishes self-reported inputs, estimates, and validated facts;
- recommendations come only from the controlled priority library;
- it does not make promises about revenue, valuation, savings, or implementation results;
- it respects professional-boundary routing;
- it contains no prohibited or sensitive content.

Failure of any validation check triggers the complete rules-based narrative. The interface must not display an AI error or deliver a diminished report.

## Executive-Summary PDF

The PDF is a seven-page executive artifact, not a transcript of the questionnaire.

### Page 1 — Cover

- company and respondent name;
- Business Independence Score and category;
- assessment date and methodology version;
- confidentiality and self-reported-data note.

### Page 2 — Executive summary

- concise interpretation of the overall result;
- top three risk patterns;
- principal capacity observation;
- recommended next step.

### Page 3 — Component scores

- Owner Independence;
- Operating-System Maturity;
- Information Visibility;
- score confidence and coverage explanation.

Each component includes one strength, one constraint, and the evidence basis.

### Page 4 — Recoverable capacity

- gross owner/team/rework hours;
- estimated recoverable hours;
- calculated or directional annual capacity-value range when eligible;
- impact-confidence label;
- assumptions and excluded categories.

For low confidence, replace monetary output with non-financial impact indicators and the inputs required to calculate a range.

### Page 5 — Risk profile

- top three deterministic risks;
- supporting self-reported behaviors;
- likely operating implication;
- explicit statement that causes require validation.

### Page 6 — 90-day priority direction

- three controlled category-level priorities;
- recommended order;
- one leading indicator per priority;
- boundary note explaining that the paid diagnostic validates causes and designs the implementation roadmap.

### Page 7 — Methodology and next step

- scoring and confidence summary;
- source labels for estimates;
- limitations and disclaimer;
- appropriate routed CTA;
- Eddie's contact details and professional-boundary statement.

### Report presentation requirements

- Preserve the website's Quiet Authority visual system.
- Use clear typographic hierarchy and restrained data visualization.
- Avoid gauges, speedometers, or decorative dashboards.
- Make all figures printable and understandable in grayscale.
- Label every figure as `exact input`, `banded input`, `derived`, or `realization-adjusted`.
- Include a unique assessment reference and version for reproducibility.

## Free Assessment and Paid Diagnostic Boundary

### Free assessment includes

- self-reported overall and component scores;
- score and impact confidence;
- likely dependency patterns;
- up to three risk flags;
- direct or directional recoverable-capacity indication;
- three category-level priorities;
- validated AI or rules-based executive narrative;
- seven-page executive-summary PDF.

### Paid Business Independence Diagnostic includes

- stakeholder interviews;
- inspection of management reports and operating evidence;
- validation of decision rights and escalation patterns;
- review of up to five critical workflows;
- validation of time, volume, and financial assumptions;
- root-cause analysis;
- prioritization based on impact and implementation dependency;
- a sequenced 90-day implementation roadmap;
- an executive readout and decision session;
- an agreed prototype or management-system design where in scope.

Required boundary language:

> The assessment identifies likely operating exposure using self-reported information. The Business Independence Diagnostic validates the causes, quantifies defensible impact, and designs the implementation path.

## Data Retention and Reproducibility

Retain a compact assessment record:

- assessment reference and methodology version;
- timestamp;
- component and overall scores;
- question coverage, score confidence, and impact confidence;
- estimate type and summarized capacity output;
- top three risk codes;
- selected recommendations;
- lead-fit route;
- consent state;
- contact fields supplied by the respondent.

Do not retain detailed free-text operating answers by default. Store the minimum normalized values required to reproduce the reported score when that can be done without creating an unnecessarily detailed operating profile.

The report and contact records must use an explicit retention policy before launch. A respondent must be able to request deletion using the contact channel stated in the privacy notice.

## States and Failure Handling

The experience must define:

- save-and-resume behavior within the current browser session;
- validation for conflicting answers;
- recovery from page refresh;
- timeout and retry behavior;
- duplicate email/report requests;
- email-delivery failure with immediate on-screen download;
- AI unavailability with rules-based fallback;
- insufficient scoring coverage;
- insufficient impact inputs;
- restricted-market routing.

No failure state may erase completed answers or prevent the visitor from viewing an already-calculated result.

## Analytics and Launch Measures

Track only the events needed to improve the assessment:

- assessment started;
- each section completed;
- preliminary result reached;
- contact gate completed;
- optional precision inputs completed or skipped;
- full result viewed;
- PDF downloaded;
- CTA route shown;
- inquiry submitted.

Initial product measures:

- start-to-preliminary-result completion;
- preliminary-result-to-contact conversion;
- share of high/medium/low score confidence;
- share of high/medium/low impact confidence;
- PDF download rate;
- diagnostic inquiry rate by result category;
- question-level abandonment and `Unknown` rates.

Do not optimize gate conversion at the expense of report credibility or informed consent.

## Acceptance Criteria

The design is ready for implementation planning when:

1. Every scored question has a behavioral anchor and explicit weight.
2. Required and conditional paths are enumerated.
3. Unknown and not-applicable rules are testable.
4. Score confidence and impact confidence can be calculated independently.
5. Capacity categories cannot double-count the same reported time.
6. Exact, banded, and insufficient-input outputs are visibly different.
7. Every preliminary-result and report figure maps to a deterministic source.
8. AI can be removed entirely without breaking the customer promise.
9. The free result stops short of root-cause validation and implementation design.
10. Lead routing preserves the Business Independence Diagnostic as the primary paid entry point.
11. The report can be reproduced from the stored compact assessment record.
12. Professional-boundary conflicts cannot generate a consulting invitation.

## Explicitly Deferred from Version 1

- automated proposal drafting;
- calendar scheduling integration;
- CRM enrichment;
- industry benchmark comparisons;
- valuation or revenue-opportunity estimates;
- conversational AI scoring;
- respondent accounts and long-term result history;
- multiple paid-service routes;
- automated implementation roadmaps.

These capabilities should be reconsidered only after real completion, confidence, conversion, and discovery-call data show that they solve a demonstrated constraint.
