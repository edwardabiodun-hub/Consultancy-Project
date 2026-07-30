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
        <p>If you request your report, a compact D1 record retains your assessment reference, methodology version, timestamp, component and overall scores, score and impact confidence, summarized capacity estimate, up to three risk codes, routed next step, consent choices, and the contact details you provide. Detailed scored answers and free-text operating responses are not retained in D1.</p>
        <p>After the deterministic result is created, an internal assessment notification is emailed through Resend to info@runrategroup.com. It includes the respondent&apos;s name, email, company, role, deterministic result, and the accepted AI or rules-based narrative so the inquiry can be reviewed and followed up. Phone numbers, raw answers, and free-text operating responses are excluded from this notification.</p>
        <p>OpenAI receives no respondent identity or raw answers. It receives only bounded business context and the deterministic result needed to draft an explanation. The draft is validated before use, and the deterministic result remains authoritative.</p>
        <p>Narrative prose is not persisted in D1. It is retained in the internal email mailbox as part of the assessment notification. Compact D1 assessment records and internal assessment notification emails are retained for up to 90 days, then deleted. A scheduled daily cleanup enforces the D1 limit; mailbox deletion follows the same operational retention policy.</p>
        <p>Report consent and marketing consent are collected separately. Report consent is required to generate and email your report and send the internal assessment notification; marketing consent is optional.</p>
        <p>The assessment applies deterministic rules to self-reported information. It is not an audit and does not independently validate root causes, implementation effort, savings, revenue, valuation, legal compliance, tax treatment, or other financial outcomes.</p>
        <h2>Video and analytics</h2>
        <p>YouTube videos use privacy-enhanced embeds and are not loaded until requested. Website analytics, if enabled, are used to understand page and referral traffic and are not used to sell personal information.</p>
        <h2>Deletion</h2>
        <p>You may request correction or deletion of inquiry or assessment information before the 90-day deletion deadline by using the contact page.</p>
      </article>
    </>
  );
}