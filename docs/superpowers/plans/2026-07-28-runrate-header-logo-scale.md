# RunRate Header Logo Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the RunRate Advisory header lockup a prominent brand anchor while preserving responsive navigation.

**Architecture:** Update the shared logo component’s intrinsic dimensions and the global header presentation rules. Protect the approved desktop size with the existing rendered-HTML integration test and verify responsive behavior through the established browser suite.

**Tech Stack:** React, TypeScript, Next Image, CSS, Node test runner, Playwright, vinext

## Global Constraints

- Desktop icon size is exactly 76px by 76px.
- Desktop `RUNRATE` size is exactly 30px and `ADVISORY` is exactly 12px.
- Header minimum height is exactly 116px.
- Below 900px, use a 64px icon, 26px wordmark, and 11px descriptor.
- Preserve existing logo artwork, colors, accessible label, and navigation copy.
- Do not modify unrelated working-tree files.

---

### Task 1: Enlarge and protect the shared header lockup

**Files:**
- Modify: `components/Logo.tsx`
- Modify: `app/globals.css`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: Existing `.brand`, `.brand-mark`, `.brand-name`, `.brand-descriptor`, and `.site-header` classes.
- Produces: A shared 76px desktop lockup with a 64px responsive presentation.

- [ ] **Step 1: Write the failing rendered-output test**

Change the existing intrinsic-size assertion to:

```js
assert.match(html, /width="76"[^>]+height="76"/);
```

- [ ] **Step 2: Run the rendered-HTML test and verify it fails**

Run:

```powershell
npm.cmd run build
node --test tests\rendered-html.test.mjs
```

Expected: the RunRate identity test fails because the rendered image remains 56 by 56.

- [ ] **Step 3: Implement the approved desktop and responsive dimensions**

Set the `Image` width and height in `components/Logo.tsx` to `76`.

In `app/globals.css`, set the desktop values to:

```css
.site-header{min-height:116px;padding:16px max(3vw,24px);gap:20px}
.brand{gap:16px}
.brand-mark{width:76px;height:76px}
.brand-name{font-size:30px}
.brand-descriptor{font-size:12px;letter-spacing:.3em;margin-top:7px}
.site-header nav{gap:clamp(8px,1.05vw,18px)}
```

Add these overrides inside the existing `@media(max-width:900px)` block:

```css
.brand-mark{width:64px;height:64px}
.brand-name{font-size:26px}
.brand-descriptor{font-size:11px}
```

- [ ] **Step 4: Verify the complete application**

Run:

```powershell
npm.cmd test
npx.cmd playwright test
```

Expected: all application tests pass and all five browser accessibility tests pass, including mobile horizontal overflow.

- [ ] **Step 5: Commit and publish**

Stage only the component, stylesheet, rendered test, specification, and plan. Commit the exact validated source, push it, save a new version of the existing Sites project, and deploy that saved version.

