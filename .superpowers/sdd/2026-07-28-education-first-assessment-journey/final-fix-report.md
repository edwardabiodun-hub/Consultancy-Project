# Final Review Fix Report

## Status

Complete. All four final-review findings are addressed in one scoped fix wave.

## Files

- `app/globals.css`
- `tests/e2e/assessment-accessibility.spec.ts`
- `tests/component/assessment-results.test.mjs`
- `.superpowers/sdd/2026-07-28-education-first-assessment-journey/final-fix-report.md`

## TDD Evidence

### Red

- Focus/mobile browser regressions: the focused Playwright run failed both new tests against the original CSS. `Start a Conversation` was absent from the mobile primary-navigation accessibility tree, and the scorecard callout focus ring measured `1.68:1` against the forest background.
- Sample isolation mutation: after adding the guard, a temporary `<button>` mutation caused the focused component test to fail with `sample must not contain buttons or links`.
- Selector coverage mutation: a temporary missing selector caused the dark-surface contrast test to fail with `contrast target must resolve: .selector-that-must-not-exist`.

All temporary mutations were removed before implementation verification.

### Green

- Focused sample isolation test: `1 passed`.
- Focused Playwright coverage for dark-surface text contrast, mobile journey visibility/overflow, and dark-surface focus contrast: `3 passed`.
- `npm.cmd test`: exit `0`; domain, component (`29 passed`), production build, and rendered HTML (`62 passed`) stages all passed.
- Full Playwright suite: `8 passed`.
- `git diff --check`: exit `0`.

## Finding-by-Finding Resolution

### Important 1: Dark-surface focus contrast

Added an explicit light `var(--paper)` focus-visible outline color for native interactive elements inside `footer`, `.callout`, `.recognition`, `.about-proof`, and `.about-profile-note`. The existing global forest-blue focus treatment remains unchanged on light surfaces.

Real-browser coverage focuses the scorecard download link, footer Privacy link, and About proof link, then calculates the outline-to-adjacent-background contrast and requires at least `3:1`.

### Important 2: Mobile primary journey

Replaced the broad mobile `.nav-cta { display: none }` rule with a navigation-scoped `.site-header nav .nav-cta` treatment. Every approved primary-navigation item remains visible, while contextual `.nav-cta` links such as the diagnostic-band `Take the assessment` link are unaffected.

The mobile browser test verifies all seven primary-navigation links, the diagnostic-band assessment link, and no horizontal overflow at `375px`.

### Minor 1: Selector coverage

The contrast utility now asserts that every requested selector resolves before computing contrast. It no longer filters missing elements silently, and the same strict resolution behavior covers the new focus targets.

### Minor 2: Sample isolation guardrail

The component/source test now rejects buttons, links, JSX handlers, `addEventListener`, `fetch`, local/session storage, imports, require calls, and API dependencies. DOM assertions independently confirm that no rendered button or link exists.

## Self-Review

- Navigation order and visitor-facing content are unchanged.
- Guided sample values, structure, and layout are unchanged.
- No scoring, API, lead-capture, persistence, or paid-diagnostic code was touched.
- Production changes are limited to the two scoped CSS behaviors; the remaining changes are regression coverage and this report.
- Unrelated pre-existing working-tree changes were not staged.

## Commit SHA

The exact SHA is the single commit containing this report and is returned in the task handoff. A commit cannot embed its own final SHA because changing this file changes that SHA.

## Concerns

None in the scoped change. The worktree retains unrelated pre-existing modifications and untracked files, including `package-lock.json`; they remain outside this commit.
