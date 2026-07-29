# Education-First Assessment Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair dark-surface visibility, place educational pages before conversion actions, and add a guided sample result to the assessment landing experience.

**Architecture:** Keep the existing route structure and assessment state machine. Change shared navigation data in `app/layout.tsx`, add a read-only `AssessmentSampleResult` component rendered only on the landing screen, and add explicit dark-surface CSS rules instead of changing the global secondary-button style.

**Tech Stack:** React, TypeScript, CSS, vinext, Node test runner, Playwright

## Global Constraints

- Preserve all existing routes, scoring logic, APIs, lead capture, and paid-diagnostic boundaries.
- The sample result is illustrative, read-only, and does not submit or persist data.
- Use the approved education-first navigation order.
- All visible text and controls must meet WCAG AA contrast.
- Preserve visible keyboard focus and prevent mobile horizontal overflow.
- Do not stage or modify unrelated working-tree files.

---

### Task 1: Repair dark-surface contrast

**Files:**
- Modify: `app/globals.css`
- Modify: `tests/e2e/assessment-accessibility.spec.ts`

**Interfaces:**
- Consumes: Existing `.callout`, `.button.secondary`, `.eyebrow`, and `.recognition` classes.
- Produces: Explicit readable colors for buttons, labels, and links on dark surfaces.

- [ ] **Step 1: Add a failing browser contrast check**

Add a test that loads `/founder-resources` and passes these selectors to the existing `contrastPairsFor` and `assertAA` helpers:

```ts
[
  ".callout .eyebrow",
  ".callout p",
  ".callout .button.secondary",
]
```

Also load `/` and check:

```ts
[".recognition .eyebrow", ".recognition p"]
```

- [ ] **Step 2: Run the focused browser test**

Run:

```powershell
npx.cmd playwright test --grep "dark surfaces"
```

Expected: FAIL because `.callout .button.secondary` inherits dark text on a dark background.

- [ ] **Step 3: Add explicit dark-surface styles**

Add:

```css
.callout .eyebrow,
.recognition .eyebrow {
  color: var(--brand-accent-dark);
}

.callout .button.secondary {
  border-color: #fff;
  color: #fff;
}

.callout .button.secondary:hover,
.callout .button.secondary:focus-visible {
  background: #fff;
  color: var(--forest);
}
```

- [ ] **Step 4: Verify the focused browser test**

Run:

```powershell
npx.cmd playwright test --grep "dark surfaces"
```

Expected: PASS with every checked pair at or above 4.5:1.

- [ ] **Step 5: Commit the contrast repair**

Stage only `app/globals.css` and `tests/e2e/assessment-accessibility.spec.ts`. Commit as:

```text
Fix dark-surface text and button contrast
```

---

### Task 2: Reorder navigation around education

**Files:**
- Modify: `app/layout.tsx`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: The shared `nav` tuple array used by the header and footer.
- Produces: The approved education-first order and correct outcome-section destinations.

- [ ] **Step 1: Add a failing rendered-navigation test**

Parse the homepage HTML and assert that the first occurrence of each label follows this order:

```js
[
  "Reduce Owner Dependency",
  "Improve Executive Decisions",
  "Automate Manual Operations",
  "Insights",
  "About Eddie",
  "Take the assessment",
  "Start a Conversation",
]
```

Assert these destinations:

```js
assert.match(html, /href="\/how-i-help#dependency"[^>]*>Reduce Owner Dependency/);
assert.match(html, /href="\/how-i-help#decisions"[^>]*>Improve Executive Decisions/);
assert.match(html, /href="\/how-i-help#automation"[^>]*>Automate Manual Operations/);
```

- [ ] **Step 2: Run the rendered-HTML test**

Run:

```powershell
npm.cmd run build
node --test tests\rendered-html.test.mjs
```

Expected: FAIL because assessment currently appears first and owner dependency points to `/diagnostic`.

- [ ] **Step 3: Replace the shared navigation order**

Use:

```ts
const nav = [
  ["/how-i-help#dependency", "Reduce Owner Dependency"],
  ["/how-i-help#decisions", "Improve Executive Decisions"],
  ["/how-i-help#automation", "Automate Manual Operations"],
  ["/founder-resources", "Insights"],
  ["/about", "About Eddie"],
  ["/assessment", "Take the assessment"],
] as const;
```

Keep “Start a Conversation” as the final emphasized link.

- [ ] **Step 4: Rebuild and verify**

Run:

```powershell
npm.cmd run build
node --test tests\rendered-html.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit the navigation change**

Stage only `app/layout.tsx` and `tests/rendered-html.test.mjs`. Commit as:

```text
Reorder navigation around education
```

---

### Task 3: Add the guided sample result

**Files:**
- Create: `app/assessment/AssessmentSampleResult.tsx`
- Modify: `app/assessment/AssessmentFlow.tsx`
- Modify: `app/assessment/assessment.css`
- Modify: `tests/component/assessment-results.test.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: No assessment answers, result types, API clients, or persistence bindings.
- Produces: `AssessmentSampleResult(): React.ReactElement`, a static semantic preview rendered only when `screen === "landing"`.

- [ ] **Step 1: Add failing sample-result tests**

Add rendered assertions for:

```js
assert.match(html, /Illustrative example/i);
assert.match(html, /58\s*\/\s*100/);
assert.match(html, /Medium confidence/i);
assert.match(html, /Owner Dependency/);
assert.match(html, /Operating-System Maturity/);
assert.match(html, /Information Visibility/);
assert.match(html, /\$36,000[^]*\$58,000/);
assert.match(html, /not an audit, valuation, financial opinion, benchmark, or promise/i);
```

Add a component test confirming the sample contains no form, input, email field, or submission handler.

- [ ] **Step 2: Run the focused tests**

Run:

```powershell
npm.cmd run build
node --test tests\component\assessment-results.test.mjs tests\rendered-html.test.mjs
```

Expected: FAIL because the sample component does not exist.

- [ ] **Step 3: Create `AssessmentSampleResult`**

Build a semantic read-only section containing:

```tsx
<section className="assessment-sample" aria-labelledby="assessment-sample-title">
  <div className="assessment-kicker">Illustrative example</div>
  <h2 id="assessment-sample-title">See what a completed assessment can reveal.</h2>
  {/* example profile, 58/100 result, three component scores, risks,
      directional capacity range, disclaimer, and three 90-day priorities */}
</section>
```

Use the exact example values and language from the confirmed specification.

- [ ] **Step 4: Render the sample on the landing screen**

Import `AssessmentSampleResult` into `AssessmentFlow.tsx` and place it after `.assessment-notes` and before `.assessment-actions`. Keep the existing “Start the assessment” handler unchanged.

- [ ] **Step 5: Add responsive sample styles**

Use a two-column summary at desktop widths. Collapse all sample grids to one column below 760px. Reuse existing assessment colors, typography, score bars, and borders.

- [ ] **Step 6: Verify focused tests**

Run:

```powershell
npm.cmd run build
node --test tests\component\assessment-results.test.mjs tests\rendered-html.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Run complete verification**

Run:

```powershell
node --test tests\copy-style.test.mjs
npm.cmd test
npx.cmd playwright test
```

Expected: all tests pass, all contrast checks meet WCAG AA, and mobile overflow remains at or below one pixel.

- [ ] **Step 8: Commit and publish**

Stage only the sample-result files and related tests. Commit as:

```text
Add guided assessment result sample
```

Push the branch, save the exact validated Sites version, deploy it privately, and verify the production deployment succeeds.

