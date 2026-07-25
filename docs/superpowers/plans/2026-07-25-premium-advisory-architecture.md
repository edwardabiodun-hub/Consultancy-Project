# Premium Advisory Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition the website around a defensible two-week business-independence outcome, remove the low public price anchor, and introduce a staged Diagnose–Build–Sustain client journey.

**Architecture:** Preserve the existing routes and Quiet Authority system. Update the shared navigation and Diagnostic CTA, reframe the homepage and service pages around outcomes, deepen the Diagnostic deliverables with a dependency-cost estimate, and extend the existing contact flow with qualification fields.

**Tech Stack:** Vinext, React, TypeScript, CSS, Node test runner, Sites hosting.

## Global Constraints

- Keep the Business Independence Diagnostic as the only fully productized engagement.
- Present Build and Sustain as continuation paths available only when Diagnostic findings justify them.
- Publish no fixed price, starting price, or price range.
- Keep the engagement duration at two weeks / 10 business days.
- Do not claim exact financial impact; describe the output as an operational-cost estimate.
- Preserve employer-conflict boundaries and the existing About Eddie page.
- Do not add routes, dependencies, a CMS, or new imagery.

---

### Task 1: Define the new positioning contract

**Files:**
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: built worker at `dist/server/index.js`
- Produces: route-level assertions for messaging, pricing removal, journey, and qualification

- [ ] Add a failing homepage test for the strengthened promise, outcome navigation, and Diagnose–Build–Sustain journey.
- [ ] Add a failing Diagnostic test for the operational-cost estimate, flexible investment language, and removal of `$3,500`, `pilot`, and `three pilot clients`.
- [ ] Add a failing Contact test for manager count, owner intervention time, reporting maturity, and timeframe.
- [ ] Run `npm.cmd test` and confirm failures are caused by the old website content.

### Task 2: Reframe navigation and shared offer language

**Files:**
- Modify: `app/layout.tsx`
- Modify: `components/SiteParts.tsx`

**Interfaces:**
- Produces: outcome-led primary navigation and reusable Business Independence Diagnostic CTA

- [ ] Rename navigation labels to `Reduce Owner Dependency`, `Improve Executive Decisions`, `Automate Manual Operations`, `Insights`, `About Eddie`, and `Start a Conversation`.
- [ ] Replace `Owner Independence Diagnostic` with `Business Independence Diagnostic`.
- [ ] Replace pilot and fixed-price language with a two-week executive assessment, operational-cost estimate, and discovery-based investment statement.

### Task 3: Build the staged client journey

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/how-i-help/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: existing design tokens and shared Diagnostic CTA
- Produces: outcome-led homepage and Diagnose–Build–Sustain presentation

- [ ] Strengthen the homepage promise around growth without routing important decisions through the owner.
- [ ] Add a three-stage journey: Diagnose, Build, Sustain.
- [ ] State clearly that Build and Sustain are continuation paths rather than automatic next purchases.
- [ ] Reframe How I Help around owner dependency, executive decisions, and manual operations while keeping AI subordinate to the business outcome.

### Task 4: Upgrade the Diagnostic and qualification flow

**Files:**
- Modify: `app/diagnostic/page.tsx`
- Modify: `app/contact/page.tsx`
- Modify: `app/contact/ContactForm.tsx`
- Modify: `app/api/contact/route.ts`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Produces: a defensible executive assessment and richer inquiry payload

- [ ] Add the two-week promise, observable-fit criteria, dependency-cost categories, outputs, exclusions, continuation paths, and discovery-based investment language.
- [ ] Add required qualification fields: manager count, owner intervention hours, reporting maturity, and timeframe.
- [ ] Include all qualification fields in the inquiry email.
- [ ] Update valid API fixtures to satisfy the new required-field contract.
- [ ] Run `npm.cmd test` and confirm all positioning and API tests pass.

### Task 5: Verify and publish

**Files:**
- Create: deployment archive outside the repository

**Interfaces:**
- Consumes: exact validated Git commit
- Produces: private Sites version 3

- [ ] Run `npm.cmd test`, `npm.cmd run lint`, and `git diff --check`.
- [ ] Confirm no public `$3,500`, `fixed pilot`, or `three pilot clients` references remain in runtime site code.
- [ ] Commit and push the exact source.
- [ ] Package, save, privately deploy, and poll to a terminal status.
- [ ] Return the production URL and summarize the new commercial architecture.

