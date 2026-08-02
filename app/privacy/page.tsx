import { PageHero } from "../../components/SiteParts";

export default function Privacy() {
  return (
    <>
      <PageHero eyebrow="Privacy" title="A restrained approach to personal information.">
        Only the information needed to respond to inquiries and provide the assessment is collected.
      </PageHero>
      <article className="content shell resource-body">
        <h2>Inquiry information</h2>
        <p>Name, work email, company, role, employee count, bottleneck, and desired outcome are used to assess and respond to your inquiry. Resend may process the message for email delivery.</p>
        <h2>Business Independence Assessment</h2>
        <p>If you request your report, a compact D1 record retains your assessment reference, methodology version, timestamp, component and overall scores, score and impact confidence, summarized capacity estimate, up to three risk codes, routed next step, consent choices, delivery metadata, and the contact details you provide.</p>
        <p>Complete assessment answers, report snapshot, generated PDF, and accepted AI/rules narrative are stored in encrypted Cloudflare R2 storage for 90 days and removed by the next daily cleanup, normally within 24 hours after the 90-day mark. Access is limited to the respondent report link and authorized RunRate follow-up. You may request deletion of this assessment information using the contact page.</p>
        <p>After the deterministic result is created, an internal assessment notification is emailed through Resend to info@runrategroup.com. It includes the respondent&apos;s name, email, company, role, deterministic result, and the accepted AI or rules-based narrative so the inquiry can be reviewed and followed up. Phone numbers, raw answers, and free-text operating responses are excluded from this notification.</p>
        <p>OpenAI receives no respondent identity, raw answers, raw evidence, numeric results, or prose. It receives only finite candidate block IDs selected from locally approved narrative text. Any missing, duplicate, unknown, or incompatible ID causes a complete rules-based fallback, and the deterministic result remains authoritative.</p>
        <p>Narrative prose is not stored in D1; D1 retains only compact metadata and validated selection fields needed for controlled retries. Compact D1 assessment records, related assessment events, and Cloudflare R2 report objects follow the same 90-day retention policy. The D1 and R2 cleanup is scheduled for 03:17 UTC each day and records deletion counts for auditability. Mailbox deletion follows the same 90-day operational policy managed outside the website application; it is not application-enforced.</p>
        <p>Report consent and marketing consent are collected separately. Report consent is required to generate and email your report and send the internal assessment notification; marketing consent is optional.</p>
        <p>The assessment applies deterministic rules to self-reported information. It is not an audit and does not independently validate root causes, implementation effort, savings, revenue, valuation, legal compliance, tax treatment, or other financial outcomes.</p>
        <h2>Video and analytics</h2>
        <p>YouTube videos use privacy-enhanced embeds and are not loaded until requested. Website analytics, if enabled, are used to understand page and referral traffic and are not used to sell personal information.</p>
        <h2>Deletion</h2>
        <p>You may request correction or deletion of inquiry or assessment information during the retention period by using the contact page.</p>
      </article>
    </>
  );
}