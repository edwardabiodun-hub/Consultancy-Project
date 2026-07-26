# Task 6 Report — Deterministic API Recompute and Tamper Resistance

## Status

Implemented and verified.

## Outcome

- Added `POST /api/assessment/calculate`.
- Added strict server-side parsing for raw context, scored answers, capacity activities, and optional lead details.
- The server discards browser-supplied result fields and always calls `buildAssessmentResult` with validated raw answers.
- Successful responses contain `{ ok: true, assessmentId, result }` with a v4 UUID.
- Invalid JSON, shapes, fields, score values, consent, activity exclusivity, and capacity bounds return `422` with field-specific errors.
- The processing screen now sends only `{ answers, lead }` and renders the returned server result.
- If calculation/persistence fails, the full local rules result remains visible and the UI states:

  > Your result is available on screen, but report storage and delivery are temporarily unavailable.

## TDD Evidence

### Endpoint red

`npm.cmd test`

- Failed at the new endpoint assertion because `/api/assessment/calculate` returned `404` instead of `422`.
- All pre-existing domain and component tests passed before the expected endpoint failure.

### Adversarial endpoint red

`node --test tests\rendered-html.test.mjs`

- New success, field-error, malformed-JSON, numeric-bound, and duplicate-category cases all failed because the route returned `404`.

### Endpoint green

After adding the validator and route:

`npm.cmd run build`

- Exit `0`; build classified `/api/assessment/calculate` as an API route.

`node --test tests\rendered-html.test.mjs`

- 21 tests passed, 0 failed.

### Client red

`npm.cmd run test:component`

- The authoritative-server-result test failed because the existing client rendered the local `0` result instead of the returned `100` result.
- The server-failure test failed because the required persistence/delivery warning was absent.

### Client green

After switching processing to the API:

`npm.cmd run test:component`

- 23 tests passed, 0 failed.

## Final Verification

`npm.cmd run lint`

- Exit `0`; no ESLint errors.

`npm.cmd test`

- Exit `0`.
- Domain: 52 tests passed.
- Component: 23 tests passed.
- Rendered/API: 21 tests passed.
- Total: 96 tests passed, 0 failed.
- Production build completed and included `/api/assessment/calculate`.

`npm.cmd exec -- tsc --noEmit`

- All Task 6 type errors were resolved.
- The command remains non-zero because of four pre-existing errors outside Task 6:
  - `app/assessment/PrecisionInputs.tsx:111` union narrowing.
  - Missing `cloudflare:workers` module typing in `db/index.ts`.
  - Missing `Fetcher` and `D1Database` ambient types in `worker/index.ts`.

## Release-A Path Coverage

The executable suite covers:

- high-dependency, emerging/medium, strong, low-confidence, and incomplete score paths;
- all conditional-question on/off paths;
- valid and malformed refresh recovery;
- focus movement through start, continue, back, completion, and review;
- preliminary result gating;
- exact-input calculation and exact-input skip;
- earlier banded-range calculation;
- restricted educational routing;
- successful server-authoritative rendering;
- server failure fallback;
- raw client payload integrity;
- tampered result fields;
- invalid JSON and field-specific validation;
- negative/over-limit capacity inputs and duplicate capacity categories.

## Files

- `app/api/assessment/calculate/route.ts`
- `lib/assessment/validation.ts`
- `app/assessment/AssessmentFlow.tsx`
- `tests/rendered-html.test.mjs`
- `tests/component/assessment-flow.test.mjs`

## Concerns

- This task recomputes and returns the result but does not implement durable report storage or email delivery. The UI therefore describes those capabilities as unavailable when the API request fails and makes no false delivery claim.
- Full-project standalone TypeScript checking has the pre-existing errors listed above; the required lint, test, and production build gates pass.
