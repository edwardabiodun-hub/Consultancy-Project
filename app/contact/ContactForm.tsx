"use client";

import { useState } from "react";

export default function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setErrors({});
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await response.json();
    if (!response.ok) {
      setErrors(body.errors || {});
      setStatus("error");
      return;
    }
    setStatus("success");
    history.replaceState(null, "", "/contact/thank-you");
  }

  if (status === "success") {
    return (
      <div className="success" role="status">
        <strong>Inquiry received.</strong>
        <p>I will review the context and respond within two business days.</p>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={submit} noValidate>
      {[
        ["name", "Name"],
        ["email", "Work email"],
        ["company", "Company"],
        ["role", "Role"],
      ].map(([name, label]) => (
        <div className="field" key={name}>
          <label htmlFor={name}>{label}</label>
          <input id={name} name={name} />
          {errors[name] && <span className="error">{errors[name]}</span>}
        </div>
      ))}

      <div className="field">
        <label htmlFor="employeeCount">Employee count</label>
        <select id="employeeCount" name="employeeCount">
          <option value="">Select</option>
          {["1–19", "20–49", "50–100", "101–250", "250+"].map((value) => <option key={value}>{value}</option>)}
        </select>
        {errors.employeeCount && <span className="error">{errors.employeeCount}</span>}
      </div>

      <div className="field">
        <label htmlFor="managerCount">Managers or functional leaders</label>
        <select id="managerCount" name="managerCount">
          <option value="">Select</option>
          {["1–2", "3–5", "6–10", "11+"].map((value) => <option key={value}>{value}</option>)}
        </select>
        {errors.managerCount && <span className="error">{errors.managerCount}</span>}
      </div>

      <div className="field">
        <label htmlFor="ownerHours">Weekly owner intervention</label>
        <select id="ownerHours" name="ownerHours">
          <option value="">Select</option>
          {["Under 5 hours", "5–10 hours", "11–20 hours", "More than 20 hours"].map((value) => <option key={value}>{value}</option>)}
        </select>
        {errors.ownerHours && <span className="error">{errors.ownerHours}</span>}
      </div>

      <div className="field">
        <label htmlFor="reportingMaturity">Executive reporting maturity</label>
        <select id="reportingMaturity" name="reportingMaturity">
          <option value="">Select</option>
          {["Mostly manual", "Partly standardized", "Consistent but fragmented", "Decision-ready"].map((value) => <option key={value}>{value}</option>)}
        </select>
        {errors.reportingMaturity && <span className="error">{errors.reportingMaturity}</span>}
      </div>

      <div className="field full">
        <label htmlFor="timeframe">Target timeframe</label>
        <select id="timeframe" name="timeframe">
          <option value="">Select</option>
          {["Within 30 days", "Within 90 days", "Within 6 months", "Exploring"].map((value) => <option key={value}>{value}</option>)}
        </select>
        {errors.timeframe && <span className="error">{errors.timeframe}</span>}
      </div>

      <div className="field" aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} />
      </div>

      <div className="field full">
        <label htmlFor="bottleneck">Decisions or operational dependencies that return to the owner</label>
        <textarea id="bottleneck" name="bottleneck" />
        {errors.bottleneck && <span className="error">{errors.bottleneck}</span>}
      </div>

      <div className="field full">
        <label htmlFor="desiredOutcome">Desired reduction in owner involvement</label>
        <textarea id="desiredOutcome" name="desiredOutcome" />
        {errors.desiredOutcome && <span className="error">{errors.desiredOutcome}</span>}
      </div>

      <div className="field full">
        <button className="button" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Discuss your business dependency"}
        </button>
        {status === "error" && <p className="error">Please correct the highlighted fields and try again.</p>}
      </div>
    </form>
  );
}
