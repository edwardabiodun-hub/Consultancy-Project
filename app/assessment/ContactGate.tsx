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

type ContactGateProps = {
  onBack: () => void;
  onSubmit: (lead: LeadDetails) => void;
};

const validEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export function ContactGate({ onBack, onSubmit }: ContactGateProps) {
  const [name, setName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [reportConsent, setReportConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const complete =
    name.trim().length > 0 &&
    validEmail(workEmail) &&
    company.trim().length > 0 &&
    reportConsent;

  return (
    <>
      <div className="assessment-kicker">Full assessment</div>
      <h1>Where should we send your report?</h1>
      <p className="assessment-intro">
        Add the contact details needed to generate your full assessment and executive-summary
        report.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!complete) return;
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
              onChange={(event) => setName(event.target.value)}
            />
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
              onChange={(event) => setWorkEmail(event.target.value)}
            />
          </div>
          <div className="assessment-field">
            <label htmlFor="lead-company">Company</label>
            <input
              id="lead-company"
              name="company"
              value={company}
              required
              autoComplete="organization"
              onChange={(event) => setCompany(event.target.value)}
            />
          </div>
          <div className="assessment-field">
            <label htmlFor="lead-phone">Phone (optional)</label>
            <input
              id="lead-phone"
              name="phone"
              type="tel"
              value={phone}
              autoComplete="tel"
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
        </div>

        <div className="assessment-disclosures">
          <label>
            <input
              type="checkbox"
              required
              checked={reportConsent}
              onChange={(event) => setReportConsent(event.target.checked)}
            />
            <span>
              I consent to generate and email my assessment report using these details.
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(event) => setMarketingConsent(event.target.checked)}
            />
            <span>Send me occasional operating insights and updates (optional).</span>
          </label>
          <p>
            Phone is optional. Marketing updates are optional and independent from report
            delivery. Only compact result and delivery information will be retained.
          </p>
        </div>

        <div className="assessment-actions assessment-actions-split">
          <button className="assessment-back" type="button" onClick={onBack}>
            Back
          </button>
          <button className="button" type="submit" disabled={!complete}>
            Continue to full assessment
          </button>
        </div>
      </form>
    </>
  );
}
