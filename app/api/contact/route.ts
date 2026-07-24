import { NextResponse } from "next/server";

const required = [
  "name",
  "email",
  "company",
  "role",
  "employeeCount",
  "bottleneck",
  "desiredOutcome",
] as const;

function validate(input: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  for (const key of required) {
    if (typeof input[key] !== "string" || String(input[key]).trim().length < 2) {
      errors[key] = "This field is required.";
    }
  }
  if (typeof input.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.email = "Enter a valid work email.";
  }
  if (typeof input.bottleneck !== "string" || input.bottleneck.trim().length < 20) {
    errors.bottleneck = "Please provide at least 20 characters.";
  }
  if (typeof input.desiredOutcome !== "string" || input.desiredOutcome.trim().length < 20) {
    errors.desiredOutcome = "Please provide at least 20 characters.";
  }
  return errors;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: { form: "Invalid request." } }, { status: 400 });
  }

  if (body.website) return NextResponse.json({ ok: false }, { status: 429 });
  const errors = validate(body);
  if (Object.keys(errors).length) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  const key = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!key || !to || !from) {
    return NextResponse.json(
      { ok: false, errors: { form: "Inquiry delivery is not yet configured. Please contact Edward directly." } },
      { status: 503 },
    );
  }

  const escapeHtml = (value: unknown) =>
    String(value).replace(/[&<>"']/g, (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
    );
  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Owner Independence Diagnostic inquiry — ${escapeHtml(body.company)}`,
      html: required.map((field) => `<p><strong>${field}</strong>: ${escapeHtml(body[field])}</p>`).join(""),
    }),
  });
  if (!sent.ok) {
    return NextResponse.json(
      { ok: false, errors: { form: "Inquiry delivery is temporarily unavailable." } },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true });
}
