# Education-First Assessment Journey Design

## Objective

Help visitors understand the problems RunRate Advisory addresses before asking them to complete an assessment. Improve visual accessibility across the site and show an illustrative assessment result so visitors know what they will receive.

## 1. Navigation Journey

The primary navigation will follow this order:

1. Reduce Owner Dependency
2. Improve Executive Decisions
3. Automate Manual Operations
4. Insights
5. About Eddie
6. Take the Assessment
7. Start a Conversation

The first three links will point to the relevant educational sections on `/how-i-help`. The paid Business Independence Diagnostic remains available through contextual page calls to action, but it will not replace the educational owner-dependency link.

This sequence moves from business problem, to education, to credibility, to self-assessment, and finally to a direct conversation.

## 2. Guided Sample Result

The assessment landing screen will include a clearly labeled illustrative example before the real assessment begins.

### Example business profile

- 42 employees
- 6 managers
- Most operating exceptions still require owner approval
- KPI reporting is prepared monthly and involves manual reconciliation
- Several recurring workflows are not documented

### Example result

- Business Independence Score: 58/100
- Result category: Developing
- Assessment confidence: Medium
- Owner Dependency: 44/100
- Operating-System Maturity: 61/100
- Information Visibility: 69/100

### Example findings

- Owner bottleneck
- Manual reporting burden
- Undocumented workflows

### Example capacity estimate

- Owner capacity potentially recoverable: 12 to 18 hours per month
- Team capacity potentially recoverable: 30 to 45 hours per month
- Directional annual capacity value: $36,000 to $58,000

The estimate will be labeled as directional and illustrative. It will not be presented as an audit, valuation, financial opinion, benchmark, or promise.

### Example 90-day priorities

1. Define decision rights for recurring operating exceptions.
2. Standardize the monthly KPI reporting process.
3. Document the two workflows that depend most heavily on owner knowledge.

### Interaction

The sample is a guided, read-only demonstration. It does not submit data, alter the real score, create a lead, or call assessment APIs. A clear “Start your assessment” button begins the existing assessment flow.

## 3. Visibility and Contrast

The dark callout pattern will receive an explicit dark-surface treatment:

- Secondary buttons use white text and a visible light border.
- Eyebrow labels use the brighter RunRate accent color.
- Links inside dark callouts remain visible in default, hover, focus, and visited states.
- Dark panels elsewhere on the site will be checked for inherited dark text, muted labels, and low-contrast borders.

The scorecard download button shown in the reported screenshot is the first required fix.

## 4. Responsive Behavior

The sample result uses a two-column summary on wide screens and a single-column sequence below 760px. The real assessment retains its current 760px reading width. Navigation may wrap at the existing tablet breakpoint and remains left-aligned on mobile.

## 5. Accessibility

- The sample uses semantic headings, lists, and definition lists.
- “Illustrative example” appears before the score and capacity figures.
- The sample does not use controls that imply editable or real assessment data.
- Text and controls must meet WCAG AA contrast requirements.
- Keyboard focus remains visible.
- No horizontal overflow is allowed at the existing mobile test viewport.

## 6. Verification

- Add a rendered-output test for the new navigation order and corrected owner-dependency destination.
- Add component coverage for the sample result content and its illustrative disclaimer.
- Extend browser contrast checks to cover dark callout buttons and labels.
- Run the full application and browser accessibility suites.
- Review all public routes for inherited dark text on dark surfaces before deployment.

