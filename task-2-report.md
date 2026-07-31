# Task 2 Report — R2 and D1 Storage Metadata

## Outcome

Implemented the `REPORTS` R2 binding for `runrate-advisory-reports`, mapped Sites hosting metadata to that binding, and added six nullable report-storage metadata columns to `assessment_records`. New compact records initialize those fields to `null`; the generated migration adds nullable columns so existing rows remain readable.

No Worker code or D1 migration was deployed.

## Changes

- `wrangler.jsonc`: added the `REPORTS` R2 bucket binding.
- `.openai/hosting.json`: set `r2` to `REPORTS`.
- `db/schema.ts`: added `report_snapshot_key`, `report_pdf_key`, `report_snapshot_hash`, `report_pdf_hash`, `report_storage_status`, and `report_stored_at` as nullable text columns.
- `lib/assessment/record.ts`: initialized new report metadata to `null` for compact records.
- `drizzle/0008_full_report_snapshots.sql`: generated six nullable `ALTER TABLE ... ADD` statements.
- `drizzle/meta/0008_snapshot.json` and `drizzle/meta/_journal.json`: generated Drizzle metadata.
- Deployment and record tests now cover the R2/Sites bindings, null initialization, and nullable migration contract.

## Verification

- TDD RED: deployment tests failed on absent `r2_buckets` and `hosting.r2`; record tests failed on absent metadata and migration.
- Focused GREEN: deployment tests 5/5 passed; record tests 8/8 passed.
- `npm run test:domain`: 210/210 passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run db:generate`: reported `No schema changes, nothing to migrate`, confirming no drift after generation.
- `git diff --check`: passed.

## Concerns / Follow-up

- The production bucket could not be created. Both `wrangler r2 bucket list` and `wrangler r2 bucket create runrate-advisory-reports` failed with Cloudflare API code `10042`: R2 must first be enabled in the Cloudflare dashboard for account `bd5c95a7cae3553aec5f0d7467efba7c`. After enabling R2, create the bucket before deploying code that uses `REPORTS`.
- The pre-change full `npm test` baseline reached deployment 4/4 and domain 208/208, then the component runner exhausted its configured 1 GB heap after 36/37 tests. Focused tests, the expanded full domain suite, lint, and the production build all pass; the component OOM is not caused by Task 2's server/configuration changes.