"use client";

import { useState } from "react";

export type LeadDetails = {
  name: string;
  workEmail: string;
  company: string;
  phone?: string;
  reportConsent: true;
  marketingConsent: boolean;
};

export type LeadDraft = Omit<LeadDetails, "reportConsent"> & {
  phone: string;
  reportConsent: boolean;
};

type ContactGateProps = {
  onBack: () => void;
  onSubmit: (lead: LeadDetails) => void;
  initialValue?: LeadDraft;
  onDraftChange?: (lead: LeadDraft) => void;
};

const validEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const EMPTY_LEAD: LeadDraft = {
  name: "",
  workEmail: "",
  company: "",
  phone: "",
  reportConsent: false,
  marketingConsent: false,
};

export function ContactGate({
  onBack,
  onSubmit,
  initialValue,
  onDraftChange,
}: ContactGateProps) {
  const [lead, setLead] = useState<LeadDraft>(initialValue ?? EMPTY_LEAD);
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const { name, workEmail, company, phone, reportConsent, marketingConsent } = lead;
  const update = <Field extends keyof LeadDraft>(
    field: Field,
    value: LeadDraft[Field],
  ) => {
    const next = { ...lead, [field]: value };
    setLead(next);
    onDraftChange?.(next);
  };
  const errors = {
    name: name.trim() ? "" : "Enter your name.",
    workEmail: validEmail(workEmail) ? "" : "Enter a valid work email.",
    company: company.trim() ? "" : "Enter your company.",
    reportConsent: reportConsent
      ? ""
      : "Consent is required to generate and email the report.",
  };
  const showError = (field: keyof typeof errors) =>
    Boolean(errors[field]) && (attempted || touched[field]);
  const touch = (field: keyof typeof errors) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  return (
    <>
      <div className="assessment-kicker">Full assessment</div>
      <h1>Where should we send your report?</h1>
      <p className="assessment-intro">
        Add the contact details needed to generate your full assessment and executive-summary
        report.
      </p>

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setAttempted(true);
          const firstInvalid = (
            ["name", "workEmail", "company", "reportConsent"] as const
          ).find((field) => errors[field]);
          if (firstInvalid) {
            const id =
              firstInvalid === "reportConsent"
                ? "lead-report-consent"
                : `lead-${firstInvalid.replace("workEmail", "work-email")}`;
            document.getElementById(id)?.focus();
            return;
          }
          onSubmit({
            name: name.trim(),
            workEmail: workEmail.trim(),
            company: company.trim(),
            phone: phone.trim() || undefined,
            reportConsent: true,
            marketingConsent,
          });
        }}
      >
        <div className="assessment-context-grid">
          <div className="assessment-field">
            <label htmlFor="lead-name">Name</label>
            <input
              id="lead-name"
              name="name"
              value={name}
              required
              autoComplete="name"
              onChange={(event) => update("name", event.target.value)}
              onBlur={() => touch("name")}
              aria-invalid={showError("name")}
              aria-describedby={showError("name") ? "lead-name-error" : undefined}
            />
            {showError("name") && (
              <span className="assessment-field-error" id="lead-name-error">
                {errors.name}
              </span>
            )}
          </div>
          <div className="assessment-field">
            <label htmlFor="lead-work-email">Work email</label>
            <input
              id="lead-work-email"
              name="workEmail"
              type="email"
              value={workEmail}
              required
              autoComplete="email"
              onChange={(event) => update("workEmail", event.target.value)}
              onBlur={() => touch("workEmail")}
              aria-invalid={showError("workEmail")}
              aria-describedby={
                showError("workEmail") ? "lead-work-email-error" : undefined
              }
            />
            {showError("workEmail") && (
              <span className="assessment-field-error" id="lead-work-email-error">
                {errors.workEmail}
              </span>
            )}
          </div>
          <div className="assessment-field">
            <label htmlFor="lead-company">Company</label>
            <input
              id="lead-company"
              name="company"
              value={company}
              required
              autoComplete="organization"
              onChange={(event) => update("company", event.target.value)}
              onBlur={() => touch("company")}
              aria-invalid={showError("company")}
              aria-describedby={
                showError("company") ? "lead-company-error" : undefined
              }
            />
            {showError("company") && (
              <span className="assessment-field-error" id="lead-company-error">
                {errors.company}
              </span>
            )}
          </div>
          <div className="assessment-field">
            <label htmlFor="lead-phone">Phone (optional)</label>
            <input
              id="lead-phone"
              name="phone"
              type="tel"
              value={phone}
              autoComplete="tel"
              onChange={(event) => update("phone", event.target.value)}
            />
          </div>
        </div>

        <div className="assessment-disclosures">
          <label>
            <input
              id="lead-report-consent"
              type="checkbox"
              required
              checked={reportConsent}
              onChange={(event) => update("reportConsent", event.target.checked)}
              onBlur={() => touch("reportConsent")}
              aria-invalid={showError("reportConsent")}
              aria-describedby={
                showError("reportConsent")
                  ? "lead-report-consent-error"
                  : undefined
              }
            />
            <span>
              I consent to generate and email my assessment report and send an internal assessment notification to RunRate Advisory using these details. Complete assessment answers, report snapshot, generated PDF, and accepted AI/rules narrative are stored in encrypted Cloudflare R2 storage for 90 days and removed by the next daily cleanup, normally within 24 hours after the 90-day mark. Access is limited to the respondent report link and authorized RunRate follow-up. I may request deletion through the contact page. The notification mailbox follows the same 90-day operational policy.
            </span>
          </label>
          {showError("reportConsent") && (
            <span
              className="assessment-field-error"
              id="lead-report-consent-error"
            >
              {errors.reportConsent}
            </span>
          )}
          <label>
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(event) => update("marketingConsent", event.target.checked)}
            />
            <span>Send me occasional operating insights and updates (optional).</span>
          </label>
          <p>
            Phone is optional. Marketing updates are optional and independent from report
            delivery. The compact D1 record includes contact, consent, result, and delivery metadata; Cloudflare R2 stores the complete report package; and the internal mailbox retains the approved narrative notification.
          </p>
        </div>

        <div className="assessment-actions assessment-actions-split">
          <button className="assessment-back" type="button" onClick={onBack}>
            Back
          </button>
          <button className="button" type="submit">
            Continue to full assessment
          </button>
        </div>
      </form>
    </>
  );
}
