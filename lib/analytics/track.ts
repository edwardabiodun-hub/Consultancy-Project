"use client";

import type { AssessmentEventName } from "./assessment";

export type AssessmentEventContext = {
  assessmentId?: string | null;
  screen?: string | null;
  resultCategory?: string | null;
  scoreConfidence?: string | null;
  impactConfidence?: string | null;
  route?: string | null;
};

const ENDPOINT = "/api/assessment/events";

// Fire-and-forget delivery of an allowlisted assessment funnel event. This
// never sends raw answers or contact details - only the event name and the
// coarse context in AssessmentEventContext - and it must never throw or
// block navigation, result generation, or the download link that calls it.
//
// `useBeacon: true` is reserved for actions immediately followed by the
// browser leaving or replacing the current document (e.g. the report
// download link), where `navigator.sendBeacon` reliably delivers the request
// even if the resulting download/navigation would otherwise race or cancel
// an in-flight `fetch`. Every other transition uses
// `fetch(..., { keepalive: true })`, which supports JSON content-type and
// survives the (in this SPA, rare) case of a same-tab navigation.
export function trackAssessmentEvent(
  eventName: AssessmentEventName,
  context: AssessmentEventContext = {},
  options: { useBeacon?: boolean } = {},
): void {
  if (typeof window === "undefined") return;

  const body: Record<string, string> = { eventName };
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === "string" && value.length > 0) {
      body[key] = value;
    }
  }

  try {
    const payload = JSON.stringify(body);
    if (
      options.useBeacon &&
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(ENDPOINT, blob);
      return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // Analytics failure must never surface to the visitor.
    });
  } catch {
    // Analytics failure must never block navigation or result generation.
  }
}
