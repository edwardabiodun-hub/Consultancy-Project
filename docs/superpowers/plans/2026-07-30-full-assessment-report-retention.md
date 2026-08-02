# Full Assessment Report Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retain a complete, reproducible copy of each consented assessment report for 90 days while keeping D1 compact and preserving secure report delivery and deletion behavior.

**Architecture:** Store a versioned JSON report snapshot and generated PDF in a Cloudflare R2 bucket. Add only object keys, content hashes, storage status, and timestamps to D1. The existing deterministic result remains authoritative; the accepted AI/rules narrative is captured in the snapshot after narrative resolution. The daily D1 retention job deletes expired records and explicitly deletes their R2 objects before recording the cleanup audit row.

**Tech Stack:** Next.js/Vinext Worker, Cloudflare D1, Cloudflare R2, Drizzle migrations, Resend, TypeScript, Node test runner.

## Global Constraints

- Retain report snapshots for exactly the existing 90-day policy; cleanup normally occurs within 24 hours after expiry.
- Store full assessment answers and report content only after required report consent is true.
- Never expose raw answers or stored report objects through an unauthenticated listing endpoint.
- Preserve the existing rules fallback when AI is unavailable or invalid.
- Keep D1 compact; store large report payloads and PDFs in R2.
- Update privacy and consent copy to disclose full-report retention, R2 storage, access, and deletion requests.

---

### Task 1: Define the stored report snapshot and storage adapter

**Files:**
- Create: `lib/report/storage.ts`
- Create: `tests/assessment/report-storage.test.mjs`

**Interfaces:**
- `ReportSnapshot` contains `schemaVersion`, `assessmentId`, `assessmentVersion`, `createdAt`, `lead`, `answers`, `result`, `narrative`, and `pdfObjectKey`.
- `ReportStorage` exposes `putSnapshot(snapshot): Promise<{ snapshotKey: string; snapshotHash: string }>` and `putPdf(objectKey, bytes): Promise<{ pdfKey: string; pdfHash: string }>`.
- `deleteReportObjects(keys): Promise<void>` deletes both snapshot and PDF objects and is idempotent.

- [ ] Write tests proving snapshots serialize deterministically, hashes are stable, object keys are assessment-scoped, and deletion is idempotent.
- [ ] Run `node --import=tsx --test tests/assessment/report-storage.test.mjs` and confirm the new tests fail before implementation.
- [ ] Implement canonical JSON serialization, SHA-256 hashing, R2 `put`, and `delete` calls without logging PII or report contents.
- [ ] Run the focused storage tests and confirm they pass.

### Task 2: Add R2 and D1 storage metadata

**Files:**
- Modify: `wrangler.jsonc`
- Modify: `.openai/hosting.json`
- Modify: `db/schema.ts`
- Create: `drizzle/0008_full_report_snapshots.sql`
- Update: `drizzle/meta/0008_snapshot.json` and `drizzle/meta/_journal.json`
- Test: `tests/cloudflare-deployment.test.mjs`, `tests/assessment/record.test.mjs`

**Interfaces:**
- Add Worker binding `REPORTS` for the R2 bucket `runrate-advisory-reports`.
- Add D1 fields `reportSnapshotKey`, `reportPdfKey`, `reportSnapshotHash`, `reportPdfHash`, `reportStorageStatus`, `reportStoredAt`.

- [ ] Add the R2 binding and create the production bucket with `npx wrangler r2 bucket create runrate-advisory-reports` if it does not exist.
- [ ] Add the migration with nullable storage fields so existing records remain readable.
- [ ] Update schema snapshots and deployment tests to require the binding and migration.
- [ ] Run `npm run db:generate` and verify no schema drift remains.
- [ ] Run focused record and deployment tests.

### Task 3: Persist the full snapshot and PDF after narrative resolution

**Files:**
- Modify: `app/api/assessment/[id]/narrative/route.ts`
- Modify: `app/api/assessment/[id]/report/route.ts`
- Modify: `app/api/assessment/[id]/deliver/route.ts`
- Modify: `lib/report/pdf.ts`
- Modify: `lib/report/storage.ts`
- Test: `tests/assessment/task9-closed-set-retry.test.mjs`, `tests/assessment/pdf.test.mjs`

**Interfaces:**
- Narrative completion calls `persistFullReportSnapshot` only after the accepted AI/rules narrative is known and only when `reportConsent` is true.
- Report route serves the stored PDF when present, otherwise preserves the existing compact-record reconstruction fallback.
- Delivery route attaches the stored PDF when present and remains idempotent.

- [ ] Add failing tests for AI snapshot persistence, rules fallback snapshot persistence, compact-record reconstruction when R2 is unavailable, and duplicate delivery.
- [ ] Implement snapshot construction from the validated request answers, server result, and accepted narrative; never persist unvalidated browser result fields.
- [ ] Generate the seven-page PDF once, store it in R2, then persist D1 keys and hashes atomically enough that partial storage is reported as `storage_failed` without blocking the on-screen result.
- [ ] Make retrieval validate the D1 hash and return a clear unavailable response on mismatch.
- [ ] Run focused narrative, delivery, and PDF tests.

### Task 4: Extend retention cleanup and deletion handling

**Files:**
- Modify: `lib/retention/assessment.ts`
- Modify: Worker scheduled handler file that calls retention cleanup
- Modify: `db/schema.ts`
- Create: `drizzle/0009_report_retention_audit.sql` only if an audit column/table is needed
- Test: `tests/assessment/retention-and-privacy.test.mjs`

**Interfaces:**
- `runAssessmentRetentionCleanup(db, reports, options)` deletes expired R2 snapshot/PDF objects before deleting D1 records and returns object deletion counts.
- Missing R2 objects are treated as already deleted; failed R2 deletion marks the cleanup audit status as `partial` and does not falsely report complete deletion.

- [ ] Add tests for successful object deletion, missing-object idempotency, partial deletion audit, and D1 cleanup ordering.
- [ ] Implement the R2 deletion pass using keys selected from records older than the 90-day cutoff.
- [ ] Preserve the existing daily schedule and audit trail.
- [ ] Run retention tests and verify the privacy copy still states the real retention period.

### Task 5: Update consent, privacy, documentation, and production verification

**Files:**
- Modify: `app/assessment/ContactGate.tsx`
- Modify: `app/privacy/page.tsx`
- Modify: `README.md`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `tests/component/assessment-flow.test.mjs`

- [ ] Update consent text to say the complete report, submitted answers, generated PDF, and accepted narrative are stored in encrypted Cloudflare R2 storage for 90 days.
- [ ] State that report access is limited to the respondent’s report link and authorized RunRate follow-up, and that deletion can be requested through the contact page.
- [ ] Document the R2 binding, snapshot schema, fallback behavior, retention cleanup, and operational mailbox policy.
- [ ] Add rendered/component assertions for the updated disclosure and no stale “raw answers are not retained” claims.
- [ ] Run `npm test`, `npm run lint`, `npm run db:generate`, and `git diff --check`.

### Task 6: Deploy and verify production lifecycle

**Files:**
- No source files; deployment state and release notes only.

- [ ] Apply the new D1 migration remotely.
- [ ] Deploy the exact pushed commit and record the Worker version ID.
- [ ] Submit a labeled production assessment with consent and verify D1 keys, R2 snapshot/PDF objects, AI/rules narrative source, and internal email delivery.
- [ ] Request the report and verify PDF content type, hash, and seven-page output.
- [ ] Repeat with AI unavailable and verify rules fallback still stores a complete snapshot.
- [ ] Run an isolated retention cleanup test against a controlled record/object pair.
- [ ] Record production URL, version, commit SHA, verification date, and the 90-day storage limitation.
