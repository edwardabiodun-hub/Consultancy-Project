# vinext-starter

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

`wrangler.jsonc` is the committed Cloudflare deployment source for the Worker, D1 database, assets, Images binding, rate limiters, and retention schedule.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` defines the production D1 assessment, analytics, and retention tables
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: run domain tests, component tests, then build and verify the rendered worker output (see [Testing](#testing) below)
- `npm run lint`: run ESLint across the project
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Business Independence Assessment

The site includes a free, deterministic **Business Independence Assessment**
at `/assessment` (18 scored questions, ~5 minutes) that is distinct from the
paid, two-week **Business Independence Diagnostic** described at
`/diagnostic`. The assessment never claims to deliver diagnostic-grade
validation; it only routes qualified respondents toward the diagnostic
conversation.

**Methodology version:** `1.0.0` (`ASSESSMENT_VERSION` in
`lib/assessment/questions.ts`). Every persisted record and generated report
carries this version so a future scoring change can be identified against
past results without silently re-scoring them.

### Architecture

- `lib/assessment/questions.ts` - the versioned question bank (15 required +
  3 conditional questions across three weighted components: Owner
  Independence 35%, Operating-System Maturity 35%, Information Visibility
  30%).
- `lib/assessment/scoring.ts` - deterministic scoring and score-confidence
  (`high` / `medium` / `low` / `incomplete`) from answer coverage and `Unknown`
  counts. Below 60% coverage, no numeric overall score is produced.
- `lib/assessment/capacity.ts` - deterministic recoverable-capacity
  calculation and impact confidence (`high` for exact inputs, `medium` for
  banded inputs across at least two eligible categories, `low`/unavailable
  otherwise). Impact confidence is independent of score confidence.
- `lib/assessment/interpretation.ts` - risk codes, 90-day priorities, and lead
  routing (`diagnostic` / `nurture` / `insights` / `restricted`).
- `lib/assessment/result.ts` (`buildAssessmentResult`) - composes the above
  into the single result object the UI, PDF, email, and narrative all consume.
  The server always recomputes this from raw answers; client-supplied score,
  capacity, or route values in a request body are ignored (see
  `app/api/assessment/calculate/route.ts`).
- `app/assessment/*.tsx` - the client-rendered assessment flow
  (`AssessmentFlow.tsx`) and its screens (`PreliminaryResult.tsx`,
  `ContactGate.tsx`, `PrecisionInputs.tsx`/`BandedCapacityInputs.tsx`,
  `FullResult.tsx`).
- `lib/report/pdf.ts` - builds the seven-page executive-summary PDF from a
  compact persisted record (no raw answers or free text).
- `lib/email/assessment-report.ts` and
  `app/api/assessment/[id]/deliver/route.ts` - optional report email delivery
  via Resend.
- `lib/assessment/narrative.ts` - the result screen renders the deterministic result and rules summary first, then requests an optional closed-set narrative selection. OpenAI receives only finite candidate block IDs for locally approved text. It receives no identity, raw answers, raw evidence, numeric results, risk prose, priority prose, or other narrative text. Missing, duplicate, unknown, or incompatible IDs cause a complete rules fallback. The endpoint uses per-assessment and global service rate limits, and an atomic D1 claim permits at most one OpenAI attempt for the lifetime of each assessment. One durable internal notification goes to `info@runrategroup.com` with respondent name, email, company, role, deterministic result, and the accepted local narrative. Phone, raw answers, and free text are excluded. Narrative prose is not persisted in D1; only the `ai` or `rules` source tag, validated closed-set selection IDs, and non-reversible notification payload hash are retained.
### Environment variables

From `.env.example`. None are required for the assessment to function in
rules-only mode; each group below only unlocks the associated feature when
fully configured.

| Variable | Required for | Behavior when unset |
|---|---|---|
| `RESEND_API_KEY` | Contact form, assessment-report delivery, and internal assessment notification | `/api/contact` and `/api/assessment/:id/deliver` return `503` with a clear "not yet configured" error; no email is sent and no result data is lost |
| `CONTACT_TO_EMAIL` | Contact form and internal assessment-notification destination | The contact form returns `503` when required email configuration is absent. For the internal assessment notification, missing configuration returns `internalNotificationAccepted: false`; the narrative route still returns `200` and the visitor result remains available. |
| `CONTACT_FROM_EMAIL` | Contact form and internal assessment-notification sender identity | Same as above |
| `ASSESSMENT_REPORT_FROM_EMAIL` | Assessment report sender identity | `/api/assessment/:id/deliver` returns `503`, same as above |
| `NEXT_PUBLIC_SITE_URL` | Absolute URLs in emails/metadata | Falls back to relative paths |
| `OPENAI_API_KEY` | AI-selected local narrative | Narrative source falls back to the deterministic rules summary |
| `ASSESSMENT_NARRATIVE_MODEL` | AI-selected local narrative | Same as above - **both** `OPENAI_API_KEY` and `ASSESSMENT_NARRATIVE_MODEL` must be set together, or the rules narrative is used |

D1 (`DB` binding, declared in `.openai/hosting.json`) is likewise optional at
runtime: see [Local rules-only mode](#local-rules-only-mode).

### D1 schema and migrations

Run after any change to `db/schema.ts`:

```bash
npm run db:generate
```

This runs `drizzle-kit generate` and writes a new numbered SQL migration into
`drizzle/` (see `drizzle/0001_assessment_records.sql` through
`drizzle/0007_happy_dust.sql` for the assessment-record schema history) plus a
matching snapshot in `drizzle/meta/`. `drizzle.config.ts` targets the `sqlite`
dialect against `db/schema.ts`. Applying generated migrations to the live D1
database is a deployment-time step for the `DB` binding declared in
`wrangler.jsonc`.

Before enabling this release in production, apply all pending D1 migrations
through `drizzle/0007_happy_dust.sql` with `npm run cf:migrate`. Migrations
`0005` through `0007` provide the persisted role, internal notification claim
and hash fields, narrative-attempt state, normalized findings, and closed-set
selection IDs required by the narrative endpoint. Pre-migration role-null
records are rejected rather than allowing a weaker match; submit a new
assessment after migration.

### Local rules-only mode

With no `DB` binding, no `RESEND_API_KEY`, and no
`OPENAI_API_KEY`/`ASSESSMENT_NARRATIVE_MODEL` configured - the default state
of a fresh checkout - the assessment still fully functions:

- Scoring, capacity calculation, risk findings, priorities, and routing are
  100% deterministic and require no external service.
- `POST /api/assessment/calculate` still returns a complete `result` object;
  it reports `persistenceAvailable: false` instead of failing the request, and
  the UI shows the result on screen with a "Print or save as PDF" fallback
  (`app/assessment/FullResult.tsx`) instead of the persisted-download and
  email-report actions.
- The narrative is always the deterministic rules summary
  (`result.narrative.source === "rules"`).
- Contact-form and report-email delivery return `503` with an explicit
  "not yet configured" error rather than a silent failure or a false success.

This is also exactly the environment `npm test`'s rendered-route suite runs
against (`tests/rendered-html.test.mjs` invokes the built worker with only an
`ASSETS` binding, no `DB`), so this fallback path is exercised on every test
run, not just manually.

### Email and AI fallback behavior

- **Email** (Task 9): report delivery
  (`POST /api/assessment/:id/deliver`) and the contact form
  (`POST /api/contact`) both require Resend configuration; if it is missing
  they return `503` and never claim success. Delivery is idempotent - a
  second delivery request for an already-sent report returns
  `status: "already_sent"` without re-sending or re-attempting Resend
  (`app/api/assessment/[id]/deliver/route.ts`). A downstream Resend failure
  (non-2xx) leaves the persisted record's delivery status unchanged so a
  retry remains possible.
- **AI narrative**: `lib/assessment/narrative.ts` calls OpenAI only when both `OPENAI_API_KEY` and `ASSESSMENT_NARRATIVE_MODEL` are set and the assessment wins its one-time atomic claim. The model receives only finite candidate block IDs and returns only selected IDs under a strict JSON schema. All displayed and emailed prose is authored locally. Validated selection IDs are retained so a notification retry reconstructs the identical local narrative and payload hash without a second OpenAI call. Existing or failed-attempt records without a valid retained selection use the complete deterministic rules narrative. Missing configuration, exhausted service budget, network error, timeout, malformed output, duplicate IDs, unknown IDs, or incompatible IDs also falls back to rules. AI selection cannot alter scores, capacity, routing, or the local priority library.
### Data deletion procedure

Compact D1 assessment records and related assessment events are retained for a 90-day period and removed by the next daily cleanup, normally within 24 hours after the 90-day mark. A Cloudflare cleanup scheduled for 03:17 UTC each day deletes expired data and writes the cutoff and deletion counts to `retention_cleanup_runs` for auditability. Narrative prose is not stored in D1; validated closed-set selection IDs may be retained to reproduce an accepted local narrative for delivery retries. The internal notification mailbox copy sent to `info@runrategroup.com` contains name, email, company, role, deterministic result, and accepted narrative. Mailbox deletion follows the same 90-day operational policy managed outside the website application; it is not application-enforced. OpenAI receives only candidate block IDs, with no identity, raw answers, evidence, numeric results, or prose. A respondent may request earlier correction or deletion using the contact page.

### Production smoke-test checklist
This is a manual checklist for a human to run after any future deployment
(deployment itself is out of scope for this document - no production
deployment has occurred as of this writing):

- [ ] `/assessment` loads and the six-question flow can be completed with the
      keyboard.
- [ ] A rules-only result completes end to end (context - to scored questions - to
      preliminary result - to contact - to precision or skip - to full result) with no
      AI or email configuration present.
- [ ] With a real `DB` binding, submitting the assessment persists a compact
      record and `persistenceAvailable: true` is returned.
- [ ] The "Download executive summary" PDF link on the full result produces a
      seven-page report matching the persisted record.
- [ ] With `OPENAI_API_KEY`/`ASSESSMENT_NARRATIVE_MODEL` absent or
      misconfigured, the narrative still renders (deterministic rules
      summary) with no visible error.
- [ ] With `RESEND_API_KEY` absent or misconfigured, "Email me this report"
      reports a clear delivery failure while the on-screen result and PDF
      download remain available.
- [ ] A submission with the restricted-market checkbox checked routes to
      "Explore educational founder resources" and never shows a diagnostic or
      other consulting invitation.

## Testing

```bash
npm run lint    # ESLint
npm test        # tests/assessment/*.test.mjs, tests/component/*.test.mjs,
                # then a build and tests/rendered-html.test.mjs against the
                # built worker
```

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
