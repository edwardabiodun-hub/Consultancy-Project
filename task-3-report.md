# Task 3 Report ? Full Assessment Snapshot and PDF Persistence

## Outcome

- Narrative completion now persists a versioned full snapshot and a generated seven-page PDF only after an accepted AI or rules narrative is definitive and validated report consent is present.
- Snapshot inputs come from validated request answers, the server-recomputed result, and the accepted narrative. Browser-supplied result fields are ignored.
- R2 object keys, SHA-256 hashes, storage status, and storage timestamp are persisted to D1 after both objects are written.
- Failed object persistence is recorded as `storage_failed`, with best-effort partial-object cleanup, without blocking the on-screen result, compact PDF reconstruction, or internal notification.
- Report downloads and delivery reuse the retained PDF when its SHA-256 hash matches. Missing or unavailable R2 objects fall back to compact-record reconstruction; a hash mismatch returns an integrity failure instead of serving unverified bytes.
- Existing delivery duplicate protection remains in place and prevents a second send after `reportDeliveryStatus` is `sent`.

## Files Changed

- `app/api/assessment/[id]/narrative/route.ts`
- `app/api/assessment/[id]/report/route.ts`
- `app/api/assessment/[id]/deliver/route.ts`
- `lib/assessment/query.ts`
- `lib/report/pdf.ts`
- `lib/report/storage.ts`
- `tests/assessment/narrative.test.mjs`
- `tests/assessment/task9-closed-set-retry.test.mjs` (verified, unchanged)
- `tests/assessment/pdf.test.mjs`
- `tests/assessment/email.test.mjs`
- `tests/assessment/report-storage.test.mjs`

## Verification

- Focused command: `node --import=tsx --test tests/assessment/narrative.test.mjs tests/assessment/task9-closed-set-retry.test.mjs tests/assessment/pdf.test.mjs tests/assessment/email.test.mjs tests/assessment/report-storage.test.mjs`
- Result: 59 tests passed, 0 failed.
- `git diff --check`: passed.
- Standalone `npx tsc --noEmit`: repository baseline remains non-green because Cloudflare ambient types are not present and existing PDF/PrecisionInputs nullability/type errors remain. Task 3 focused runtime tests compile and pass through `tsx`.

## Residual Considerations

- R2 and D1 cannot participate in a shared transaction. The implementation writes both objects first, then D1 metadata, and performs best-effort object cleanup plus `storage_failed` status on failure.
- A hash mismatch is treated differently from R2 unavailability: integrity failures are not silently reconstructed from the compact record, making corruption visible to the caller.

## Review Fix Round

- Added atomic D1 compare-and-set delivery claims encoded in `reportDeliveryStatus`, including a 10-minute stale-claim lease and claimant-scoped `sent`/`failed` finalization.
- Added a stable Resend `Idempotency-Key` per assessment. Concurrent requests do not send twice, a D1 finalization failure keeps the claim closed, and a confirmed Resend failure releases the claim for retry.
- Added atomic D1 compare-and-set storage claims encoded in `reportStorageStatus`. Only the claimant writes report objects or finalizes hashes/status.
- Snapshot cleanup now verifies claim ownership first, so a superseded attempt cannot delete another attempt's successful objects.
- Replaced stale PDF non-retention statements with accurate disclosure that complete submitted answers, the generated PDF, and the accepted narrative are retained for 90 days in secure report storage.
- Strengthened retrieval coverage with a real matching SHA-256 digest path in addition to mismatch handling.

### Review Verification

- Focused command: `node --import=tsx --test tests/assessment/email.test.mjs tests/assessment/narrative.test.mjs tests/assessment/task9-closed-set-retry.test.mjs tests/assessment/report-storage.test.mjs tests/assessment/pdf.test.mjs`
- Result: 65 tests passed, 0 failed.
- Added regression coverage for concurrent delivery, finalization failure, genuine failed-send retry, concurrent storage claims, claimant-lost cleanup, real matching hash retrieval, and PDF retention disclosures.
