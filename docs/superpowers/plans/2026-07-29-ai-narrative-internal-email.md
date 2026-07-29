# AI Narrative and Internal Assessment Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display the validated AI narrative in the completed assessment and send one actionable internal assessment email to `info@runrategroup.com`.

**Architecture:** Keep deterministic scoring as the authoritative first response. After a persisted result renders, the client calls the existing narrative endpoint in the background. That endpoint recomputes the deterministic result, generates and validates an AI narrative or rules fallback, sends a best-effort idempotent internal email through Resend, stores only the source tag, and returns the accepted narrative to the visitor.

**Tech Stack:** Next.js/Vinext, React, TypeScript, Cloudflare Workers, D1/Drizzle, OpenAI Chat Completions, Resend, Node test runner, Testing Library, Playwright.

## Global Constraints

- Deterministic scoring, capacity, risks, priorities, confidence, and routing remain authoritative.
- OpenAI never receives respondent name, email, company, phone, consent data, free text, or raw scored answers.
- Internal email includes respondent name, work email, company, and role.
- Internal email excludes phone number, raw answers, and unapproved free text.
- A rules fallback is displayed and emailed when OpenAI is unavailable or rejected by validation.
- Narrative or email failure never removes the deterministic result.
- D1 stores only `narrativeSource`; narrative prose is not persisted.
- Resend requests use a stable assessment-derived idempotency key.
- Secrets remain in ignored `.env` files and encrypted Cloudflare Worker secrets.
- Recommended model is `gpt-5-mini`.

---

## File structure

- Create `lib/email/internal-assessment.ts`: build and send the internal assessment notification.
- Create `tests/assessment/internal-assessment-email.test.mjs`: verify contents, exclusions, escaping, idempotency, and provider failure.
- Modify `app/api/assessment/[id]/narrative/route.ts`: orchestrate narrative generation, source persistence, and best-effort internal notification.
- Modify `tests/assessment/narrative.test.mjs`: verify route-level notification inputs and failure isolation.
- Modify `app/assessment/FullResult.tsx`: display the accepted narrative, source label, and accessible loading status.
- Modify `tests/component/assessment-results.test.mjs`: verify rules, loading, AI, and fallback presentation.
- Modify `app/assessment/AssessmentFlow.tsx`: request the narrative after a persisted deterministic result renders.
- Modify `tests/component/assessment-flow.test.mjs`: verify background upgrade, fallback, payload, and missing-persistence behavior.
- Modify `README.md`: document that the feature is wired, the internal email behavior, and production fallback.

---

### Task 1: Internal assessment email module

**Files:**
- Create: `lib/email/internal-assessment.ts`
- Create: `tests/assessment/internal-assessment-email.test.mjs`

**Interfaces:**
- Consumes: `AssessmentResult` from `lib/assessment/result.ts` and `NarrativeOutcome` from `lib/assessment/narrative.ts`.
- Produces:

```ts
export type InternalAssessmentEmailInput = {
  assessmentId: string;
  lead: { name: string; email: string; company: string; role: string };
  result: AssessmentResult;
  narrative: NarrativeOutcome;
};

export function buildInternalAssessmentEmail(
  input: InternalAssessmentEmailInput,
): {
  subject: string;
  html: string;
  idempotencyKey: string;
};

export async function sendInternalAssessmentEmail(
  input: InternalAssessmentEmailInput,
  config?: {
    apiKey?: string;
    from?: string;
    to?: string;
    fetchImpl?: typeof fetch;
  },
): Promise<{ accepted: boolean }>;
```

- [ ] **Step 1: Write failing content and privacy tests**

Add tests that build a message containing the assessment reference, approved lead fields, overall/component scores, confidence, route, source label, narrative text, and deterministic-method statement.

Use sentinel values:

```js
const input = {
  assessmentId: "123e4567-e89b-42d3-a456-426614174000",
  lead: {
    name: "Avery Founder",
    email: "avery@example.com",
    company: "Example Operations",
    role: "Owner-operator",
  },
  result,
  narrative: { source: "ai", text: "Validated narrative." },
};
```

Assert the HTML contains all four approved lead values and does not contain sentinel phone, raw-answer, or free-text values.

- [ ] **Step 2: Run the new test and verify RED**

Run:

```powershell
node --import=tsx --test tests/assessment/internal-assessment-email.test.mjs
```

Expected: FAIL because `lib/email/internal-assessment.ts` does not exist.

- [ ] **Step 3: Implement escaped message construction**

Implement a local HTML escaper and map exactly three component labels. Use:

```ts
const sourceLabel =
  input.narrative.source === "ai"
    ? "AI-generated and validated"
    : "Rules fallback";

const idempotencyKey = `assessment-narrative-${input.assessmentId}`;
```

Subject:

```ts
`Business Independence Assessment: ${input.lead.company}`
```

Do not accept phone, raw answers, or free text in `InternalAssessmentEmailInput`.

- [ ] **Step 4: Add failing send/idempotency tests**

Inject a capturing `fetchImpl`. Assert:

```js
assert.equal(url, "https://api.resend.com/emails");
assert.equal(init.headers["Idempotency-Key"], `assessment-narrative-${assessmentId}`);
assert.deepEqual(JSON.parse(init.body).to, ["info@runrategroup.com"]);
```

Also assert missing configuration and non-2xx Resend responses return `{ accepted: false }` without throwing.

- [ ] **Step 5: Implement best-effort Resend delivery**

Read defaults from:

```ts
process.env.RESEND_API_KEY
process.env.CONTACT_FROM_EMAIL
process.env.CONTACT_TO_EMAIL
```

POST the constructed message to `https://api.resend.com/emails`. Return `{ accepted: response.ok }`; catch provider/network errors and return `{ accepted: false }`.

- [ ] **Step 6: Run the focused tests**

Run:

```powershell
node --import=tsx --test tests/assessment/internal-assessment-email.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```powershell
git add lib/email/internal-assessment.ts tests/assessment/internal-assessment-email.test.mjs
git commit -m "Add internal assessment narrative email"
```

---

### Task 2: Narrative endpoint orchestration

**Files:**
- Modify: `app/api/assessment/[id]/narrative/route.ts`
- Modify: `tests/assessment/narrative.test.mjs`

**Interfaces:**
- Consumes: `sendInternalAssessmentEmail(input)` from Task 1.
- Produces response:

```ts
{
  ok: true;
  narrative: NarrativeOutcome;
  persistenceAvailable: boolean;
  internalNotificationAccepted: boolean;
}
```

- [ ] **Step 1: Write failing route tests**

Extend `createAssessmentNarrativeHandler` dependencies with:

```ts
sendInternalNotification: typeof sendInternalAssessmentEmail;
```

Test that the route calls it with:

```js
{
  assessmentId,
  lead: {
    name: validPayload.lead.name,
    email: validPayload.lead.email,
    company: validPayload.lead.company,
    role: validPayload.answers.role,
  },
  result: expectedServerResult,
  narrative: { source: "ai", text: "An AI narrative." },
}
```

Assert the object has no phone, consent, raw-answer, or free-text properties.

- [ ] **Step 2: Run the focused route tests and verify RED**

Run:

```powershell
node --import=tsx --test tests/assessment/narrative.test.mjs
```

Expected: FAIL because the dependency and response property do not exist.

- [ ] **Step 3: Implement orchestration**

After narrative generation and the best-effort `narrativeSource` update, call:

```ts
const { accepted: internalNotificationAccepted } =
  await sendInternalNotification({
    assessmentId: id,
    lead: {
      name: parsed.lead.name,
      email: parsed.lead.email,
      company: parsed.lead.company,
      role: parsed.answers.role,
    },
    result,
    narrative,
  });
```

Wrap the call so an unexpected notification exception becomes `false`. Always return the accepted narrative.

- [ ] **Step 4: Add failure-isolation and fallback tests**

Verify:

- notification rejection still returns HTTP 200 and the narrative;
- a thrown notification dependency becomes `internalNotificationAccepted: false`;
- a rules narrative is emailed with `source: "rules"`;
- the same assessment ID reaches the notification dependency on retries.

- [ ] **Step 5: Run focused tests**

Run:

```powershell
node --import=tsx --test tests/assessment/narrative.test.mjs tests/assessment/internal-assessment-email.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add app/api/assessment/[id]/narrative/route.ts tests/assessment/narrative.test.mjs
git commit -m "Email accepted assessment narratives internally"
```

---

### Task 3: Result narrative presentation

**Files:**
- Modify: `app/assessment/FullResult.tsx`
- Modify: `tests/component/assessment-results.test.mjs`

**Interfaces:**
- Produces new props:

```ts
type DisplayNarrative = {
  source: "ai" | "rules";
  text: string;
};

type FullResultProps = {
  // existing props
  narrative?: DisplayNarrative;
  narrativeLoading?: boolean;
};
```

- [ ] **Step 1: Write failing presentation tests**

Add cases asserting:

1. no override renders `result.narrative.summary` and `Rules-based`;
2. `narrativeLoading` renders an accessible `role="status"` message while preserving the rules text;
3. `{ source: "ai", text: "Validated AI text." }` renders that text and `AI-generated and validated`;
4. `{ source: "rules", text: "Fallback text." }` renders fallback text and `Rules-based`.

- [ ] **Step 2: Run the component test and verify RED**

Run:

```powershell
node --import=tsx --test tests/component/assessment-results.test.mjs
```

Expected: FAIL because the new props and labels are not implemented.

- [ ] **Step 3: Implement minimal presentation**

Derive:

```ts
const displayedNarrative =
  narrative?.text ?? result.narrative.summary;
const narrativeLabel =
  narrative?.source === "ai"
    ? "AI-generated and validated"
    : "Rules-based";
```

Keep the section heading `Executive interpretation`. Render a short status such as `Preparing a validated narrative…` only while loading. Do not use language suggesting AI calculated the score.

- [ ] **Step 4: Run focused tests**

Run:

```powershell
node --import=tsx --test tests/component/assessment-results.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add app/assessment/FullResult.tsx tests/component/assessment-results.test.mjs
git commit -m "Display validated assessment narratives"
```

---

### Task 4: Background narrative request

**Files:**
- Modify: `app/assessment/AssessmentFlow.tsx`
- Modify: `tests/component/assessment-flow.test.mjs`

**Interfaces:**
- Consumes `POST /api/assessment/:id/narrative`.
- Supplies `FullResult` with `narrative` and `narrativeLoading`.

- [ ] **Step 1: Write failing flow tests**

Update fetch stubs to branch by URL:

```js
if (String(input).includes("/api/assessment/calculate")) {
  return Response.json({
    ok: true,
    assessmentId,
    persistenceAvailable: true,
    result: buildAssessmentResult(payload.answers),
  });
}
if (String(input).includes(`/api/assessment/${assessmentId}/narrative`)) {
  return Response.json({
    ok: true,
    narrative: { source: "ai", text: "Validated AI text." },
    persistenceAvailable: true,
    internalNotificationAccepted: true,
  });
}
```

Assert the deterministic result appears before resolving the deferred narrative response, then assert the UI upgrades after resolution.

- [ ] **Step 2: Add privacy and fallback flow tests**

Verify:

- narrative request body matches `{ answers, lead }` required by the server validator;
- OpenAI privacy remains enforced server-side by the existing safe-context tests;
- endpoint 500/timeout preserves the rules narrative and clears loading;
- `persistenceAvailable: false` or a missing assessment ID makes no narrative request;
- a new assessment resets prior narrative state.

- [ ] **Step 3: Run the flow tests and verify RED**

Run:

```powershell
node --import=tsx --test tests/component/assessment-flow.test.mjs
```

Expected: FAIL because the client never calls the narrative endpoint.

- [ ] **Step 4: Implement the background effect**

Add state:

```ts
const [displayNarrative, setDisplayNarrative] =
  useState<{ source: "ai" | "rules"; text: string } | null>(null);
const [narrativeLoading, setNarrativeLoading] = useState(false);
```

Add a separate effect keyed to the completed persisted result:

```ts
useEffect(() => {
  if (
    screen !== "full" ||
    !assessmentId ||
    !persistenceAvailable ||
    !serverResult
  ) return;

  const controller = new AbortController();
  let active = true;
  setDisplayNarrative(null);
  setNarrativeLoading(true);

  void fetch(`/api/assessment/${encodeURIComponent(assessmentId)}/narrative`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers, lead: leadDraft }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) throw new Error("Narrative unavailable");
      return response.json();
    })
    .then((body) => {
      if (
        active &&
        body?.ok === true &&
        (body.narrative?.source === "ai" ||
          body.narrative?.source === "rules") &&
        typeof body.narrative.text === "string"
      ) {
        setDisplayNarrative(body.narrative);
      }
    })
    .catch(() => undefined)
    .finally(() => {
      if (active) setNarrativeLoading(false);
    });

  return () => {
    active = false;
    controller.abort();
  };
}, [
  answers,
  assessmentId,
  leadDraft,
  persistenceAvailable,
  screen,
  serverResult,
]);
```

Reset narrative state when beginning a new calculation. Pass both props to `FullResult`.

- [ ] **Step 5: Run focused component tests**

Run:

```powershell
node --import=tsx --test tests/component/assessment-flow.test.mjs tests/component/assessment-results.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add app/assessment/AssessmentFlow.tsx tests/component/assessment-flow.test.mjs
git commit -m "Request narratives after persisted assessments"
```

---

### Task 5: Documentation, configuration, and complete verification

**Files:**
- Modify: `README.md`
- Local only: ignored `.env`
- External only: encrypted Cloudflare Worker secrets

**Interfaces:**
- Requires populated `OPENAI_API_KEY`, `ASSESSMENT_NARRATIVE_MODEL`, `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, and `CONTACT_FROM_EMAIL`.

- [ ] **Step 1: Update documentation**

Replace the statement that Task 10 is not visitor-facing with the live behavior:

- deterministic result renders first;
- narrative enhancement runs asynchronously;
- validated AI or rules fallback is labeled;
- one internal notification is sent to `CONTACT_TO_EMAIL`;
- lead identity is included internally but excluded from OpenAI;
- narrative prose is not retained.

- [ ] **Step 2: Verify local secret readiness without printing values**

Run a PowerShell check that reports booleans only for:

```text
OPENAI_API_KEY
ASSESSMENT_NARRATIVE_MODEL
RESEND_API_KEY
CONTACT_TO_EMAIL
CONTACT_FROM_EMAIL
```

Expected: every value reports `true`.

- [ ] **Step 3: Upload encrypted Cloudflare secrets**

For each value, pipe the value from `.env` into:

```powershell
npx wrangler secret put <NAME> --name runrate-advisory
```

Do not print secret values. Verify names with:

```powershell
npx wrangler secret list --name runrate-advisory
```

- [ ] **Step 4: Run complete verification**

Run:

```powershell
npm test
npm run test:e2e
npm run lint
git diff --check
```

Expected:

- all domain, component, rendered-HTML, and deployment tests pass;
- all Playwright accessibility tests pass;
- lint exits 0;
- diff check exits 0.

- [ ] **Step 5: Commit documentation**

```powershell
git add README.md
git commit -m "Document live AI narrative workflow"
```

- [ ] **Step 6: Push exact source**

```powershell
git push origin codex/cloudflare-public-hosting
```

Record the pushed commit SHA.

- [ ] **Step 7: Build and deploy**

Run:

```powershell
npm run cf:build
npm run cf:deploy
```

Record the Cloudflare Worker version ID.

- [ ] **Step 8: Production smoke test**

Complete one clearly labeled test assessment using a non-sensitive test lead. Verify:

- the deterministic result appears first;
- the narrative resolves to either `AI-generated and validated` or `Rules-based`;
- D1 stores the corresponding source tag only;
- Resend records one internal email to `info@runrategroup.com`;
- the email includes name, email, company, and role;
- the email excludes phone and raw answers;
- retrying the narrative request does not create a duplicate email;
- home, assessment, JavaScript assets, sitemap, and robots remain HTTP 200/correct.

- [ ] **Step 9: Report outcome and limitations**

Report:

- production URL;
- commit SHA;
- Worker version ID;
- test counts;
- narrative source observed;
- Resend delivery status;
- any fallback or provider limitation.

