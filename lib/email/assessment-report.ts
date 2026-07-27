import { categoryFor, ROUTES, type AssessmentReportRecord } from "../report/pdf";

export type AssessmentEmailRecord = Pick<
  AssessmentReportRecord,
  "id" | "name" | "overallScore" | "scoreConfidence" | "leadRoute"
>;

export type AssessmentEmail = {
  subject: string;
  html: string;
  text: string;
  attachmentFilename: string;
};

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";

/**
 * Pure email content builder for a delivered assessment report. Given only
 * the compact retained record, it deterministically produces the subject,
 * escaped HTML body, plain-text body, and the attachment filename used for
 * the generated PDF. No network, database, or DOM access happens here.
 */
export function buildAssessmentEmail(
  record: AssessmentEmailRecord,
): AssessmentEmail {
  const category = categoryFor(record.overallScore);
  const scoreText =
    record.overallScore === null
      ? "Result incomplete"
      : `${integer.format(record.overallScore)} / 100`;
  const greetingName = record.name?.trim() || "there";
  const reportUrl = `${siteUrl()}/api/assessment/${encodeURIComponent(record.id)}/report`;
  const route = ROUTES[record.leadRoute] ?? ROUTES.nurture;
  const attachmentFilename = `business-independence-assessment-${record.id}.pdf`;
  const subject = `Your Business Independence Assessment result: ${category}`;
  const limitation =
    "This assessment applies deterministic rules to self-reported information. It is not an audit or independent validation of root causes, implementation effort, savings, revenue, or valuation.";

  const html = [
    `<p>Hi ${escapeHtml(greetingName)},</p>`,
    `<p>Your Business Independence Assessment result is ${escapeHtml(scoreText)} (${escapeHtml(category)}), with ${escapeHtml(record.scoreConfidence)} score confidence.</p>`,
    `<p>Your full seven-page executive report is attached as a PDF. You can also view or re-download it at <a href="${escapeHtml(reportUrl)}">${escapeHtml(reportUrl)}</a>.</p>`,
    `<p><a href="${escapeHtml(`${siteUrl()}${route.path}`)}">${escapeHtml(route.label)}</a> &mdash; ${escapeHtml(route.reason)}</p>`,
    `<p>${escapeHtml(limitation)}</p>`,
  ].join("\n");

  const text = [
    `Hi ${greetingName},`,
    "",
    `Your Business Independence Assessment result is ${scoreText} (${category}), with ${record.scoreConfidence} score confidence.`,
    "",
    `Your full seven-page executive report is attached as a PDF. You can also view or re-download it at ${reportUrl}.`,
    "",
    `${route.label} - ${route.reason} (${siteUrl()}${route.path})`,
    "",
    limitation,
  ].join("\n");

  return { subject, html, text, attachmentFilename };
}
