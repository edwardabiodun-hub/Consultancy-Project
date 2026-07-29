# AI Narrative and Internal Assessment Email Design

## Objective

Activate the existing validated AI narrative capability in the visitor-facing Business Independence Assessment and send one actionable internal assessment notification to `info@runrategroup.com`.

The deterministic scoring engine remains authoritative. AI explains the result but never creates or changes scores, risks, capacity estimates, priorities, confidence levels, or routing.

## Approved approach

Use the existing `POST /api/assessment/:id/narrative` endpoint as the single orchestration boundary:

1. Recompute the deterministic result from validated assessment inputs.
2. Build the existing bounded, non-identifying model input.
3. Request an OpenAI narrative.
4. Validate the response against deterministic figures, risks, and controlled priorities.
5. Fall back to the rules narrative on missing configuration, timeout, provider failure, invalid structure, or policy-validation failure.
6. Send one internal email containing the lead context and accepted narrative.
7. Return the accepted narrative to the visitor.

The deterministic result screen renders before this background request completes.

## Visitor experience

The full result initially displays the deterministic narrative.

After the background narrative request completes:

- A validated AI result replaces the narrative text and is labeled `AI-generated and validated`.
- A rules fallback remains visible and is labeled `Rules-based`.
- Failure to generate or email never removes the deterministic score or report.
- Narrative generation does not block score calculation, PDF availability, or the recommended next step.

The interface should use an accessible status message while the enhancement is being prepared. It must not imply that scoring is AI-generated.

## Model and privacy boundary

The OpenAI request may receive only the existing `NarrativeModelInput`:

- overall and component scores;
- score category;
- score and impact confidence;
- bounded capacity outputs;
- controlled risks and priorities;
- route;
- employee and revenue bands;
- role category;
- restricted-market flag.

OpenAI must not receive:

- respondent name;
- respondent email;
- phone number;
- company name;
- free-text inquiry content;
- raw scored answers;
- marketing-consent data.

The internal email may include respondent name, work email, company, and role because it is sent to RunRate for lead follow-up after the AI call. Raw answers and phone numbers remain excluded.

## Internal email

Send the notification through Resend to `CONTACT_TO_EMAIL`, currently configured as `info@runrategroup.com`.

Include:

- assessment reference;
- respondent name;
- respondent work email;
- company;
- role;
- overall score and category;
- component scores;
- score and impact confidence;
- recommended route;
- narrative source (`AI-generated and validated` or `Rules fallback`);
- accepted narrative text;
- a statement that scores and routing are deterministic.

Use an idempotency key derived from the assessment ID so retries cannot create duplicate internal notifications. Do not reuse the respondent report-delivery status because internal notification and respondent delivery are separate business events.

## Failure handling

- OpenAI unavailable, unconfigured, timed out, or invalid: use the rules narrative and send it with the `Rules fallback` source label.
- Resend unavailable or rejected: still return the accepted narrative to the visitor.
- D1 source-tag update unavailable: still return the narrative and attempt the internal notification.
- Missing persisted assessment ID: do not call the narrative endpoint or send an internal notification.
- A repeated request for the same assessment uses the same Resend idempotency key.

The API response may expose whether internal notification was accepted, but the visitor UI must not display internal delivery details.

## Configuration

Required Cloudflare Worker secrets:

- `OPENAI_API_KEY`
- `ASSESSMENT_NARRATIVE_MODEL`
- `RESEND_API_KEY`
- `CONTACT_TO_EMAIL`
- `CONTACT_FROM_EMAIL`

Recommended model: `gpt-5-mini`.

No secret value is committed to Git. Local values remain in the ignored `.env` file.

## Testing

Add automated coverage for:

1. visitor result begins with the rules narrative and upgrades to validated AI text;
2. the AI label changes only when the endpoint returns `source: "ai"`;
3. endpoint failure preserves the rules narrative;
4. internal email includes the approved lead fields and deterministic result summary;
5. internal email excludes phone, raw answers, and unapproved free text;
6. model input excludes all identifying lead fields;
7. rules fallback is emailed with an explicit source label;
8. Resend failure does not fail the narrative response;
9. repeated requests use the same assessment-derived idempotency key;
10. missing persistence prevents narrative and notification requests.

Run the full domain, component, rendered-HTML, Playwright accessibility, lint, build, and production smoke-test suites before deployment.

## Production verification

After deployment:

1. complete a test assessment;
2. confirm the deterministic result appears before narrative enhancement;
3. confirm the displayed narrative is labeled with its actual source;
4. confirm D1 stores only the accepted source tag, not narrative prose;
5. confirm Resend accepts one internal notification to `info@runrategroup.com`;
6. confirm the internal email contains the approved lead fields and no raw answers or phone number;
7. temporarily test the rules fallback path without exposing an error to the visitor.

