# Final whole-branch fix: report retention and delivery recovery

## Changes

- Added a 10-minute lease to deterministic `storing:<ISO timestamp>:<claim>` report-storage claims. A stale token can be reclaimed only through an exact compare-and-set against the observed token; active, malformed, and unknown states remain busy.
- Report persistence verifies ownership, deletes the assessment's deterministic `snapshot.json` and `report.pdf` keys before writing, and still performs best-effort cleanup after a partial write. This removes orphan objects from an interrupted prior attempt without allowing a writer that lost its claim to delete the replacement writer's objects.
- Retention cleanup derives either missing R2 key from the assessment ID, so expired orphan objects are deleted even if D1 metadata finalization never occurred. R2 deletion failures continue to retain the corresponding D1 record and produce a partial audit.
- Delivery now catches synchronous Resend invocation exceptions and reconciles them to `failed`, allowing a safe retry after a clear pre-submission failure.
- A rejected Resend promise is treated as ambiguous and reconciled to `provider_indeterminate|...`. Existing `provider_started|...` and `provider_indeterminate|...` states return a 503 unavailable response rather than a false `{ ok: true, status: "already_sent" }`; neither state is automatically retried.
- Existing stable Resend idempotency keys, deterministic scoring/rules fallback, privacy boundaries, and compact D1 storage remain unchanged.

## Tests and outcomes

- TDD red run:
  - `node --import=tsx --test tests/assessment/narrative.test.mjs tests/assessment/report-storage.test.mjs tests/assessment/retention-and-privacy.test.mjs tests/assessment/email.test.mjs`
  - Expected failure: 37 passed, 5 failed. Failures proved the missing stale-claim export/path, missing pre-write cleanup, null-key retention gap, and uncaught synchronous/rejected Resend calls.
- Focused green run:
  - Same command as above.
  - 56 passed, 0 failed.
- Full assessment domain suite:
  - `npm run test:domain`
  - 236 passed, 0 failed.
- Lint:
  - `npm run lint`
  - Exit 0; no warnings or errors.
- Schema generation:
  - `npm run db:generate`
  - Exit 0; no schema changes and no migration generated.
- Production build:
  - `npm run build`
  - Exit 0; all five vinext build phases completed.
- Whitespace validation:
  - `git diff --check`
  - Exit 0.

## Concerns

- A promise rejection after invoking Resend cannot prove whether the provider accepted the request. The implementation deliberately closes that assessment in an indeterminate state and requires reconciliation/manual intervention instead of risking a duplicate send.
- The stale storage lease is 10 minutes. Reclamation assumes the original Worker is no longer legitimately writing after that bounded window; exact-token compare-and-set plus ownership checks prevent an already-displaced writer from finalizing or deleting the replacement writer's objects.
