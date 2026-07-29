import type { NarrativeOutcome } from "../assessment/narrative";
import type { AssessmentResult } from "../assessment/result";

export type InternalAssessmentEmailInput = {
  assessmentId: string;
  lead: { name: string; email: string; company: string; role: string };
  result: AssessmentResult;
  narrative: NarrativeOutcome;
};

type EmailConfig = {
  apiKey?: string;
  from?: string;
  to?: string;
  fetchImpl?: typeof fetch;
};

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

const escapeHtml = (value: string | number | null): string =>
  String(value ?? "Result incomplete")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const componentLabels = {
  ownerIndependence: "Owner independence",
  operatingSystem: "Operating system",
  informationVisibility: "Information visibility",
} as const;

export function buildInternalAssessmentEmail(
  input: InternalAssessmentEmailInput,
): { subject: string; html: string; idempotencyKey: string } {
  const sourceLabel =
    input.narrative.source === "ai"
      ? "AI-generated and validated"
      : "Rules fallback";
  const idempotencyKey = `assessment-narrative-${input.assessmentId}`;
  const components = Object.entries(componentLabels)
    .map(([component, label]) => {
      const score = input.result.score.components[component as keyof typeof componentLabels].score;
      return `<li>${escapeHtml(label)}: ${escapeHtml(score)}</li>`;
    })
    .join("");

  return {
    subject: `Business Independence Assessment: ${input.lead.company}`,
    idempotencyKey,
    html: `<!doctype html>
<html><body>
  <h1>Business Independence Assessment</h1>
  <p>Assessment reference: ${escapeHtml(input.assessmentId)}</p>
  <h2>Lead</h2>
  <ul>
    <li>Name: ${escapeHtml(input.lead.name)}</li>
    <li>Email: ${escapeHtml(input.lead.email)}</li>
    <li>Company: ${escapeHtml(input.lead.company)}</li>
    <li>Role: ${escapeHtml(input.lead.role)}</li>
  </ul>
  <h2>Assessment summary</h2>
  <ul>
    <li>Overall score: ${escapeHtml(input.result.score.overall)}</li>
    ${components}
    <li>Score confidence: ${escapeHtml(input.result.score.confidence.level)}</li>
    <li>Route: ${escapeHtml(input.result.interpretation.route)}</li>
    <li>Narrative source: ${escapeHtml(sourceLabel)}</li>
  </ul>
  <h2>Narrative</h2>
  <p>${escapeHtml(input.narrative.text)}</p>
  <p>The score and route use the deterministic assessment method. This result is self-reported and not an audit.</p>
</body></html>`,
  };
}

export async function sendInternalAssessmentEmail(
  input: InternalAssessmentEmailInput,
  config: EmailConfig = {},
): Promise<{ accepted: boolean }> {
  const apiKey = config.apiKey ?? process.env.RESEND_API_KEY;
  const from = config.from ?? process.env.CONTACT_FROM_EMAIL;
  const to = config.to ?? process.env.CONTACT_TO_EMAIL;
  const fetchImpl = config.fetchImpl ?? fetch;
  if (!apiKey || !from || !to) return { accepted: false };

  const email = buildInternalAssessmentEmail(input);
  try {
    const response = await fetchImpl(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": email.idempotencyKey,
      },
      body: JSON.stringify({ from, to: [to], subject: email.subject, html: email.html }),
    });
    return { accepted: response.ok };
  } catch {
    return { accepted: false };
  }
}