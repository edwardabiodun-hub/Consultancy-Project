# About Eddie Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic About page with a portrait-led, evidence-based introduction to Eddie that builds trust with founders and CEOs.

**Architecture:** Keep the existing route and shared site shell. Add one optimized portrait asset, replace the About page composition, extend the existing stylesheet with page-scoped selectors, and expand rendered-HTML coverage before deployment.

**Tech Stack:** Vinext, React, TypeScript, CSS, Node test runner, Poppler/Python for source-image extraction, Sites hosting.

## Global Constraints

- Preserve the Quiet Authority design system and Decision Margin signature.
- Use only claims supported by the supplied LinkedIn PDF, approved site context, or attributed LinkedIn recommendations.
- Use the supplied LinkedIn headshot without generative retouching.
- Do not add a dependency, CMS, carousel, animation library, or second biography route.
- Preserve the existing professional-boundaries disclosure.
- Support 390, 768, and 1440 pixel viewports without horizontal overflow.

---

### Task 1: Define the About-page contract

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: built worker entrypoint at `dist/server/index.js`
- Produces: a rendering contract for `/about`

- [ ] **Step 1: Write the failing test**

Add a test that requests `/about` and asserts the approved headline, portrait path and alt text, LinkedIn URL, both recommendation attributions, professional-boundary wording, and both calls to action.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm.cmd test`

Expected: FAIL because the current About page lacks the approved headline, portrait, recommendations, and LinkedIn link.

- [ ] **Step 3: Preserve the red-state evidence**

Confirm the failure is caused by missing About-page content rather than a build or syntax error.

### Task 2: Prepare the portrait asset

**Files:**
- Create: `public/edward-abiodun.png`

**Interfaces:**
- Consumes: `Edward Abiodun _ LinkedIn.pdf`, page 1
- Produces: `/edward-abiodun.png`

- [ ] **Step 1: Extract the embedded profile image**

Use `pypdf` or `pdfimages` to enumerate page-one images and identify the circular profile photograph by visual inspection.

- [ ] **Step 2: Crop and optimize**

Create a tightly cropped PNG with Eddie centered. Preserve his actual appearance, avoid generative edits, and constrain the output dimensions to the source resolution.

- [ ] **Step 3: Inspect the final asset**

Open the output image and verify that it is Eddie's headshot, not the LinkedIn banner, icon, or page screenshot.

### Task 3: Implement the page and page-scoped styling

**Files:**
- Modify: `app/about/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `/edward-abiodun.png`, existing `SiteParts`, site tokens
- Produces: the complete `/about` experience

- [ ] **Step 1: Replace the About page**

Implement the approved seven-section content architecture:

1. Portrait-led hero
2. First-person biography
3. Three capability groups
4. Decision Margin operating philosophy
5. Two attributed recommendation excerpts
6. Professional boundaries
7. Closing invitation

- [ ] **Step 2: Add page-scoped CSS**

Add selectors prefixed with `.about-` for the portrait frame, hero grid, biography, capability groups, recommendations, boundary block, and responsive stacking.

- [ ] **Step 3: Run the tests to verify green**

Run: `npm.cmd test`

Expected: all rendered-HTML tests pass.

- [ ] **Step 4: Run lint**

Run: `npm.cmd run lint`

Expected: exit 0 with no errors.

### Task 4: Verify and publish

**Files:**
- Modify: `.openai/hosting.json` only if required by the current Sites version
- Create: deployment archive outside the repository

**Interfaces:**
- Consumes: validated Git commit
- Produces: a new private production version of the existing Sites project

- [ ] **Step 1: Review the final diff**

Confirm the diff contains only the approved About-page work, portrait asset, test, plan, and required metadata changes.

- [ ] **Step 2: Run fresh verification**

Run: `npm.cmd test` and `npm.cmd run lint`.

Expected: build succeeds, all tests pass, and lint exits 0.

- [ ] **Step 3: Commit and push**

Commit the exact validated source and push the branch head to the existing Sites source repository.

- [ ] **Step 4: Package and save**

Use the Sites packaging helper to produce an archive from the exact commit, then save a new site version with that commit SHA.

- [ ] **Step 5: Deploy privately**

Deploy the saved version with owner-only access and poll until the deployment succeeds or fails.

- [ ] **Step 6: Report the result**

Return the production URL, summarize the humanizing changes, and state any factual or image-quality limitation that remains.

