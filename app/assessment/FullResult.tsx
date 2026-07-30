import { useEffect } from "react";
import type { AssessmentResult } from "../../lib/assessment/result";
import type { ComponentId } from "../../lib/assessment/types";
import { trackAssessmentEvent } from "../../lib/analytics/track";
import type { AssessmentEventContext } from "../../lib/analytics/track";

export type DeliveryState =
  | "idle"
  | "sending"
  | "sent"
  | "already_sent"
  | "error";

export type DisplayNarrative = {
  source: "ai" | "rules";
  text: string;
};

type FullResultProps = {
  result: AssessmentResult;
  assessmentId?: string;
  persistenceAvailable?: boolean;
  deliveryState?: DeliveryState;
  onDeliverReport?: () => void;
  narrative?: DisplayNarrative;
  narrativeLoading?: boolean;
};

const COMPONENT_LABELS: Record<ComponentId, string> = {
  ownerIndependence: "Owner independence",
  operatingSystem: "Operating-system maturity",
  informationVisibility: "Information visibility",
};

const CATEGORY_LABELS = {
  strong: "Strong independence",
  emerging: "Emerging independence",
  developing: "Developing independence",
  highDependency: "High dependency",
  incomplete: "Result incomplete",
} as const;

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const titleCase = (value: string) =>
  value.replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase());

export function FullResult({
  result,
  assessmentId,
  persistenceAvailable = false,
  deliveryState = "idle",
  onDeliverReport,
  narrative,
  narrativeLoading = false,
}: FullResultProps) {
  const components = Object.entries(result.score.components) as [
    ComponentId,
    AssessmentResult["score"]["components"][ComponentId],
  ][];
  const capacity = result.capacity;
  const displayedNarrative = narrative?.text ?? result.narrative.summary;
  const narrativeLabel =
    narrative?.source === "ai" ? "AI-selected and rules-validated" : "Rules-based";

  // Non-identifying context shared by every event fired from this rendered
  // result: which assessment (when persisted) and the deterministic
  // category/confidence/route already visible on screen - never the
  // underlying answers or contact details.
  const eventContext: AssessmentEventContext = {
    assessmentId: assessmentId ?? null,
    screen: "full",
    resultCategory: result.score.category,
    scoreConfidence: result.score.confidence.level,
    impactConfidence: capacity.confidence,
    route: result.interpretation.route,
  };

  // The recommended-next-step CTA below always renders with this result, so
  // report it as shown once per mount rather than wiring a render-count
  // event into every branch of the JSX below.
  useEffect(() => {
    trackAssessmentEvent("cta_shown", eventContext);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    assessmentId,
    result.score.category,
    result.score.confidence.level,
    capacity.confidence,
    result.interpretation.route,
  ]);

  return (
    <>
      <div className="assessment-kicker">Full assessment</div>
      <h1>
        {result.score.overall === null
          ? "Result incomplete"
          : `${result.score.overall} out of 100`}
      </h1>
      <div className="assessment-result-meta" aria-label="Full score summary">
        <span>{CATEGORY_LABELS[result.score.category]}</span>
        <span>Score confidence: {result.score.confidence.level}</span>
        <span>Impact confidence: {capacity.confidence}</span>
      </div>

      <div className="assessment-report-actions">
        {persistenceAvailable && assessmentId ? (
          <>
            <a
              className="button"
              href={`/api/assessment/${encodeURIComponent(assessmentId)}/report`}
              download
              onClick={() =>
                trackAssessmentEvent("pdf_downloaded", eventContext, {
                  useBeacon: true,
                })
              }
            >
              Download executive summary
            </a>
            {onDeliverReport && (
              <>
                <button
                  className="button"
                  type="button"
                  onClick={onDeliverReport}
                  disabled={
                    deliveryState === "sending" ||
                    deliveryState === "sent" ||
                    deliveryState === "already_sent"
                  }
                >
                  {deliveryState === "sending" ? "Sending…" : "Email me this report"}
                </button>
                {deliveryState === "sent" && (
                  <p role="status">Your report has been emailed to you.</p>
                )}
                {deliveryState === "already_sent" && (
                  <p role="status">Your report was already emailed to you.</p>
                )}
                {deliveryState === "error" && (
                  <p role="alert">
                    Email delivery is temporarily unavailable. Use the download above instead.
                  </p>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <button className="button" type="button" onClick={() => window.print()}>
              Print or save as PDF
            </button>
            <p>
              Report storage and email delivery is unavailable. Use the browser
              print dialog to save this on-screen result.
            </p>
          </>
        )}
      </div>

      <section className="assessment-result-section" aria-labelledby="executive-interpretation">
        <div className="assessment-section-label">{narrativeLabel}</div>
        <h2 id="executive-interpretation">Executive interpretation</h2>
        {narrativeLoading && <p role="status">Preparing a validated narrative…</p>}
        <p>{displayedNarrative}</p>
      </section>

      <section className="assessment-result-section" aria-labelledby="component-scores-heading">
        <h2 id="component-scores-heading">Component scores</h2>
        <ul className="assessment-component-list" aria-label="Component scores">
          {components.slice(0, 3).map(([component, item]) => (
            <li key={component}>
              <div>
                <strong>{COMPONENT_LABELS[component]}</strong>
                <span>
                  {item.score === null ? "Incomplete" : `${item.score} / 100`} ·{" "}
                  {CATEGORY_LABELS[item.category]}
                </span>
              </div>
              <div
                className="assessment-score-bar"
                aria-label={`${COMPONENT_LABELS[component]} ${
                  item.score ?? 0
                } out of 100`}
              >
                <span style={{ width: `${item.score ?? 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="assessment-result-section" aria-labelledby="operating-findings">
        <h2 id="operating-findings">Operating findings</h2>
        <ul className="assessment-evidence-list" aria-label="Evidence-backed findings">
          {result.risks.slice(0, 3).map((finding) => (
            <li key={finding.code}>
              <div className="assessment-code">
                {finding.kind} · {finding.code}
              </div>
              <strong>{finding.label}</strong>
              <p>{finding.evidence}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="assessment-result-section" aria-labelledby="capacity-heading">
        <h2 id="capacity-heading">Recoverable capacity</h2>
        <p className="assessment-result-status">
          {titleCase(capacity.estimateType)} estimate · {titleCase(capacity.confidence)} impact
          confidence
        </p>
        {capacity.estimateType === "unavailable" ? (
          <>
            <p>
              No financial estimate is available. Reported non-financial hours remain visible
              without assigning a monetary value.
            </p>
            <dl className="assessment-capacity-grid">
              <div>
                <dt>Reported gross hours</dt>
                <dd>{integer.format(capacity.grossHours.total)}</dd>
              </div>
            </dl>
          </>
        ) : (
          <dl className="assessment-capacity-grid">
            <div>
              <dt>Reported gross hours</dt>
              <dd>{integer.format(capacity.grossHours.total)}</dd>
            </div>
            <div>
              <dt>Estimated recoverable hours</dt>
              <dd>
                {integer.format(capacity.recoverableHours?.low ?? 0)}–
                {integer.format(capacity.recoverableHours?.high ?? 0)}
              </dd>
            </div>
            <div>
              <dt>Annual capacity value</dt>
              <dd>
                {currency.format(capacity.annualValue?.low ?? 0)}–
                {currency.format(capacity.annualValue?.high ?? 0)}
              </dd>
            </div>
          </dl>
        )}
        <ul className="assessment-assumption-list" aria-label="Capacity assumptions">
          {capacity.assumptions.slice(0, 3).map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </section>

      <section className="assessment-result-section" aria-labelledby="priorities-heading">
        <h2 id="priorities-heading">90-day priorities</h2>
        <ol className="assessment-priority-list" aria-label="Controlled priorities">
          {result.interpretation.priorities.slice(0, 3).map((priority) => (
            <li key={priority.component}>
              <strong>{priority.title}</strong>
              <p>{priority.action}</p>
              <span>Leading indicator: {priority.indicator}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="assessment-result-section" aria-labelledby="evidence-gaps-heading">
        <h2 id="evidence-gaps-heading">Evidence that would improve confidence</h2>
        {result.missingEvidence.length ? (
          <ul className="assessment-assumption-list">
            {result.missingEvidence.slice(0, 3).map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        ) : (
          <p>No material input gaps were identified by the current rules.</p>
        )}
      </section>

      <section className="assessment-result-section" aria-labelledby="limitations-heading">
        <h2 id="limitations-heading">Methodology and limitations</h2>
        <p>
          Methodology {result.methodologyVersion} applies deterministic rules to self-reported
          information. This assessment is not an audit and does not validate root causes,
          implementation effort, savings, revenue, or valuation impact.
        </p>
      </section>

      <section className="assessment-result-section assessment-route" aria-labelledby="route-heading">
        <h2 id="route-heading">Recommended next step</h2>
        <p>{result.cta.reason}</p>
        <a className="button" href={result.cta.href}>
          {result.cta.label}
        </a>
      </section>
    </>
  );
}
