"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildAssessmentResult } from "../../lib/assessment/result";
import type { AssessmentResult } from "../../lib/assessment/result";
import { QUESTION_BANK } from "../../lib/assessment/questions";
import type {
  AnswerValue,
  AssessmentAnswers,
  CapacityInputs,
  ComponentId,
  QuestionDefinition,
} from "../../lib/assessment/types";
import { loadSession, saveSession } from "../../lib/assessment/session";
import { trackAssessmentEvent } from "../../lib/analytics/track";
import type { AssessmentEventContext } from "../../lib/analytics/track";
import { ContactGate } from "./ContactGate";
import type { LeadDraft } from "./ContactGate";
import { BandedCapacityInputs } from "./BandedCapacityInputs";
import { FullResult } from "./FullResult";
import type { DeliveryState } from "./FullResult";
import {
  createEmptyPrecisionDrafts,
  PrecisionInputs,
} from "./PrecisionInputs";
import type { PrecisionDrafts } from "./PrecisionInputs";
import { PreliminaryResult } from "./PreliminaryResult";
import { AssessmentSampleResult } from "./AssessmentSampleResult";

type Screen =
  | "landing"
  | "context"
  | "ownerIndependence"
  | "operatingSystem"
  | "informationVisibility"
  | "preliminary"
  | "contact"
  | "precision"
  | "processing"
  | "full";

const EMPTY: AssessmentAnswers = {
  employeeBand: "",
  managerBand: "",
  revenueBand: "",
  role: "",
  coreSystemCount: "",
  organizationShape: "",
  relationshipLedByOwner: false,
  restrictedMarket: false,
  scored: {},
  capacity: { source: "none", activities: [] },
};

const COMPONENTS: Array<{
  id: ComponentId;
  label: string;
  description: string;
}> = [
  {
    id: "ownerIndependence",
    label: "Owner independence",
    description: "How decisions and routine work move when the owner is not available.",
  },
  {
    id: "operatingSystem",
    label: "Operating system",
    description: "How clearly recurring work, ownership, and escalation are established.",
  },
  {
    id: "informationVisibility",
    label: "Information visibility",
    description: "How reliably leaders receive trusted information and turn it into action.",
  },
];

const contextComplete = (answers: AssessmentAnswers) =>
  Boolean(
    answers.employeeBand &&
      answers.managerBand &&
      answers.revenueBand &&
      answers.role &&
      answers.coreSystemCount &&
      answers.organizationShape,
  );

function Progress({
  screen,
  currentQuestion,
  applicable,
}: {
  screen: Screen;
  currentQuestion?: QuestionDefinition;
  applicable: QuestionDefinition[];
}) {
  const questionPosition = currentQuestion
    ? applicable.findIndex((question) => question.id === currentQuestion.id) + 1
    : 0;
  const value =
    screen === "landing"
        ? 0
        : screen === "context"
          ? 5
          : currentQuestion
            ? Math.max(6, Math.round((questionPosition / applicable.length) * 100))
            : 100;
  const postAssessmentSections: Partial<Record<Screen, string>> = {
    preliminary: "Preliminary result",
    contact: "Contact and consent",
    precision: "Optional precision",
    processing: "Result processing",
    full: "Full result",
  };
  const section =
    screen === "landing"
      ? "Assessment overview"
      : screen === "context"
        ? "Business context"
        : postAssessmentSections[screen] ??
          COMPONENTS.find((component) => component.id === screen)?.label;
  const status =
    screen === "preliminary"
      ? "Answers complete"
      : screen === "contact"
        ? "Unlock full result"
        : screen === "precision"
          ? "Optional estimate inputs"
          : screen === "processing"
            ? "Applying deterministic rules"
            : screen === "full"
              ? "Assessment complete"
              : "Owner to system";

  return (
    <div className="assessment-progress-wrap">
      <div className="assessment-progress-copy">
        <span>{section}</span>
        <span>
          {currentQuestion
            ? `Question ${questionPosition} of ${applicable.length}`
            : status}
        </span>
      </div>
      <div
        className="assessment-progress"
        role="progressbar"
        aria-label="Assessment progress from owner-dependent to system-led"
        aria-valuetext={
          currentQuestion
            ? `${section}, question ${questionPosition} of ${applicable.length}`
            : `${section}, ${value} percent complete`
        }
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <span style={{ width: `${value}%` }} />
      </div>
      <div className="assessment-continuum" aria-hidden="true">
        <span>Owner-dependent</span>
        <span>System-led</span>
      </div>
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="assessment-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        name={id}
        value={value}
        required
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select one</option>
        {options.map(([optionValue, optionLabel]) => (
          <option value={optionValue} key={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AssessmentFlow() {
  const [answers, setAnswers] = useState<AssessmentAnswers>(() => {
    if (typeof sessionStorage === "undefined") return EMPTY;
    const stored = loadSession();
    return stored
      ? {
          ...EMPTY,
          ...stored,
          capacity: {
            source: stored.capacity?.source ?? "none",
            activities: stored.capacity?.activities ?? [],
          },
        }
      : EMPTY;
  });
  const [screen, setScreen] = useState<Screen>("landing");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [leadDraft, setLeadDraft] = useState<LeadDraft>({
    name: "",
    workEmail: "",
    company: "",
    phone: "",
    reportConsent: false,
    marketingConsent: false,
  });
  const [precisionDrafts, setPrecisionDrafts] = useState<PrecisionDrafts>(
    createEmptyPrecisionDrafts,
  );
  const [serverResult, setServerResult] = useState<AssessmentResult | null>(
    null,
  );
  const [deliveryUnavailable, setDeliveryUnavailable] = useState(false);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [persistenceAvailable, setPersistenceAvailable] = useState(false);
  const [reportDeliveryState, setReportDeliveryState] =
    useState<DeliveryState>("idle");
  const [narrative, setNarrative] = useState<{
    source: "ai" | "rules";
    text: string;
  } | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeRequest, setNarrativeRequest] = useState<{
    assessmentId: string;
    answers: AssessmentAnswers;
    lead: LeadDraft;
  } | null>(null);
  const [apiValidationError, setApiValidationError] = useState<string | null>(
    null,
  );
  const stepRef = useRef<HTMLElement>(null);
  const previousStep = useRef<{ screen: Screen; questionIndex: number } | null>(null);

  useEffect(() => {
    saveSession(answers);
  }, [answers]);

  useEffect(() => {
    const previous = previousStep.current;
    previousStep.current = { screen, questionIndex };
    if (
      previous &&
      (previous.screen !== screen || previous.questionIndex !== questionIndex)
    ) {
      stepRef.current?.focus();
    }
  }, [questionIndex, screen]);

  const applicable = useMemo(
    () => QUESTION_BANK.filter((question) => question.required || question.appliesWhen?.(answers)),
    [answers],
  );
  const screenQuestions = useMemo(
    () =>
      screen === "ownerIndependence" ||
      screen === "operatingSystem" ||
      screen === "informationVisibility"
        ? applicable.filter((question) => question.component === screen)
        : [],
    [applicable, screen],
  );
  const currentQuestion = screenQuestions[questionIndex];
  const result = useMemo(() => buildAssessmentResult(answers), [answers]);

  // Builds the non-identifying analytics context (screen plus deterministic
  // result category/confidence/route) for the funnel event just reached or
  // completed. `overrideResult` lets the "full" screen report the
  // server-recomputed result rather than the locally memoized one.
  const eventContext = useCallback(
    (
      forScreen: Screen,
      overrideResult: AssessmentResult = result,
    ): AssessmentEventContext => ({
      screen: forScreen,
      resultCategory: overrideResult.score.category,
      scoreConfidence: overrideResult.score.confidence.level,
      impactConfidence: overrideResult.capacity.confidence,
      route: overrideResult.interpretation.route,
    }),
    [result],
  );

  useEffect(() => {
    if (!narrativeRequest) return;
    const controller = new AbortController();
    let active = true;

    const requestNarrative = async () => {
      try {
        const response = await fetch(
          `/api/assessment/${encodeURIComponent(narrativeRequest.assessmentId)}/narrative`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              answers: narrativeRequest.answers,
              lead: narrativeRequest.lead,
            }),
            signal: controller.signal,
          },
        );
        if (!response.ok) return;
        const body = (await response.json().catch(() => null)) as {
          ok?: boolean;
          narrative?: { source?: unknown; text?: unknown };
        } | null;
        if (
          active &&
          body?.ok === true &&
          (body.narrative?.source === "ai" || body.narrative?.source === "rules") &&
          typeof body.narrative.text === "string"
        ) {
          setNarrative({
            source: body.narrative.source,
            text: body.narrative.text,
          });
        }
      } catch {
        // A narrative is optional; deterministic rules remain visible.
      } finally {
        if (active) setNarrativeLoading(false);
      }
    };

    void requestNarrative();
    return () => {
      active = false;
      controller.abort();
    };
  }, [narrativeRequest]);

  const resetNarrativeState = () => {
    setNarrative(null);
    setNarrativeLoading(false);
    setNarrativeRequest(null);
  };

  useEffect(() => {
    if (screen !== "processing") return;
    const controller = new AbortController();
    let active = true;

    const calculate = async () => {
      try {
        const [response] = await Promise.all([
          fetch("/api/assessment/calculate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ answers, lead: leadDraft }),
            signal: controller.signal,
          }),
          new Promise((resolve) => window.setTimeout(resolve, 50)),
        ]);
        if (response.status === 429) {
          if (!active) return;
          const retryAfterValue = Number.parseInt(response.headers.get("retry-after") ?? "60", 10);
          const retryAfterSeconds = Number.isFinite(retryAfterValue)
            ? Math.min(Math.max(retryAfterValue, 1), 3600)
            : 60;
          setServerResult(null);
          setDeliveryUnavailable(false);
          setApiValidationError(
            `Too many assessment requests. Your answers are saved. Please wait about ${retryAfterSeconds} seconds and try again.`,
          );
          setScreen("precision");
          return;
        }
        if (!response.ok && response.status < 500) {
          const rejected = (await response.json().catch(() => null)) as {
            errors?: unknown;
          } | null;
          if (!active) return;
          const errorKeys =
            rejected?.errors &&
            typeof rejected.errors === "object" &&
            !Array.isArray(rejected.errors)
              ? Object.keys(rejected.errors)
              : [];
          setServerResult(null);
          setDeliveryUnavailable(false);

          if (errorKeys.some((key) => key.startsWith("lead."))) {
            setApiValidationError(
              "We could not validate the report contact details. Review them and try again.",
            );
            setScreen("contact");
            return;
          }
          if (
            errorKeys.some(
              (key) =>
                key.startsWith("answers.") &&
                !key.startsWith("answers.capacity") &&
                !key.startsWith("answers.scored"),
            )
          ) {
            setApiValidationError(
              "We could not validate the business context. Review it and try again.",
            );
            setScreen("context");
            return;
          }
          if (errorKeys.some((key) => key.startsWith("answers.scored"))) {
            setApiValidationError(
              "We could not validate the scored answers. Review them before trying again.",
            );
            setScreen("preliminary");
            return;
          }

          setAnswers((current) => ({
            ...current,
            capacity: { source: "none", activities: [] },
          }));
          setPrecisionDrafts(createEmptyPrecisionDrafts());
          setApiValidationError(
            "We could not validate the capacity inputs. Review the limits and try again.",
          );
          setScreen("precision");
          return;
        }
        if (!response.ok) {
          throw new Error("Assessment service is unavailable.");
        }
        const body = (await response.json()) as {
          ok?: boolean;
          assessmentId?: string;
          result?: AssessmentResult;
          persistenceAvailable?: boolean;
        };
        if (body.ok !== true || !body.result) {
          throw new Error("Assessment result was not persisted.");
        }
        if (!active) return;
        const persistedAssessmentId =
          typeof body.assessmentId === "string" && body.assessmentId
            ? body.assessmentId
            : null;
        const persisted = body.persistenceAvailable === true && Boolean(persistedAssessmentId);
        setServerResult(body.result);
        setAssessmentId(persistedAssessmentId);
        setPersistenceAvailable(body.persistenceAvailable === true);
        setDeliveryUnavailable(body.persistenceAvailable !== true);
        if (persisted && persistedAssessmentId) {
          setNarrative(null);
          setNarrativeLoading(true);
          setNarrativeRequest({
            assessmentId: persistedAssessmentId,
            answers,
            lead: leadDraft,
          });
        } else {
          resetNarrativeState();
        }
        setApiValidationError(null);
        setReportDeliveryState("idle");
        setScreen("full");
        trackAssessmentEvent("full_result_viewed", {
          ...eventContext("full", body.result),
          assessmentId: body.assessmentId ?? null,
        });
      } catch {
        if (!active || controller.signal.aborted) return;
        setServerResult(null);
        setAssessmentId(null);
        setPersistenceAvailable(false);
        setDeliveryUnavailable(true);
        setApiValidationError(null);
        setReportDeliveryState("idle");
        setScreen("full");
        trackAssessmentEvent("full_result_viewed", eventContext("full"));
      }
    };

    void calculate();
    return () => {
      active = false;
      controller.abort();
    };
  }, [answers, leadDraft, screen, eventContext]);

  const deliverReport = async () => {
    if (!assessmentId) return;
    setReportDeliveryState("sending");
    try {
      const response = await fetch(
        `/api/assessment/${encodeURIComponent(assessmentId)}/deliver`,
        { method: "POST" },
      );
      if (!response.ok) {
        setReportDeliveryState("error");
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        status?: string;
      } | null;
      setReportDeliveryState(
        body?.status === "already_sent" ? "already_sent" : "sent",
      );
    } catch {
      setReportDeliveryState("error");
    }
  };

  const updateContext = <Key extends keyof AssessmentAnswers>(
    key: Key,
    value: AssessmentAnswers[Key],
  ) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  const answer = (id: string, value: AnswerValue) => {
    setAnswers((current) => ({
      ...current,
      scored: { ...current.scored, [id]: value },
    }));
  };

  const continueWithCapacity = (capacity: CapacityInputs) => {
    setAnswers((current) => ({ ...current, capacity }));
    resetNarrativeState();
    setServerResult(null);
    setDeliveryUnavailable(false);
    setApiValidationError(null);
    setScreen("processing");
  };

  const startComponent = (component: ComponentId, index = 0) => {
    setQuestionIndex(index);
    setScreen(component);
  };

  const continueFromQuestion = () => {
    if (!currentQuestion) return;
    if (questionIndex < screenQuestions.length - 1) {
      setQuestionIndex((current) => current + 1);
      return;
    }

    trackAssessmentEvent("section_completed", eventContext(screen));

    const componentIndex = COMPONENTS.findIndex((component) => component.id === screen);
    const nextComponent = COMPONENTS[componentIndex + 1];
    if (nextComponent) {
      startComponent(nextComponent.id);
    } else {
      setScreen("preliminary");
      setQuestionIndex(0);
      trackAssessmentEvent("preliminary_result_reached", eventContext("preliminary"));
    }
  };

  const goBack = () => {
    if (
      screen === "ownerIndependence" ||
      screen === "operatingSystem" ||
      screen === "informationVisibility"
    ) {
      if (questionIndex > 0) {
        setQuestionIndex((current) => current - 1);
        return;
      }
      const componentIndex = COMPONENTS.findIndex((component) => component.id === screen);
      const previousComponent = COMPONENTS[componentIndex - 1];
      if (previousComponent) {
        const previousQuestions = applicable.filter(
          (question) => question.component === previousComponent.id,
        );
        startComponent(previousComponent.id, Math.max(0, previousQuestions.length - 1));
      } else {
        setScreen("context");
      }
      return;
    }
    if (screen === "context") setScreen("landing");
    if (screen === "contact") setScreen("preliminary");
    if (screen === "precision") setScreen("contact");
    if (screen === "preliminary") {
      const previous = COMPONENTS.at(-1);
      if (previous) {
        const previousQuestions = applicable.filter(
          (question) => question.component === previous.id,
        );
        startComponent(previous.id, Math.max(0, previousQuestions.length - 1));
      }
    }
  };

  return (
    <div className="assessment-shell">
      <Progress screen={screen} currentQuestion={currentQuestion} applicable={applicable} />

      <section
        ref={stepRef}
        className="assessment-card"
        aria-label="Assessment step"
        aria-live="polite"
        tabIndex={-1}
      >
        {apiValidationError && (
          <p className="assessment-validation" role="alert">
            {apiValidationError}
          </p>
        )}
        {screen === "landing" && (
          <>
            <div className="assessment-kicker">Business Independence Assessment</div>
            <h1>How independently can your business operate?</h1>
            <p className="assessment-lede">
              Answer a focused set of questions about decisions, recurring work, and management
              information. The assessment takes approximately five minutes.
            </p>
            <div className="assessment-promise">
              <p>
                You will receive a practical view of where the business still depends on owner
                intervention and which operating constraint deserves attention first.
              </p>
            </div>
            <dl className="assessment-notes">
              <div>
                <dt>Method</dt>
                <dd>
                  Deterministic scoring based on observable operating behaviors, not a personality
                  profile or an AI-generated judgment.
                </dd>
              </div>
              <div>
                <dt>Privacy</dt>
                <dd>
                  Answers remain in this browser session until you choose whether to share them.
                </dd>
              </div>
            </dl>
            <AssessmentSampleResult />
            <div className="assessment-actions">
              <button
                className="button"
                type="button"
                onClick={() => {
                  trackAssessmentEvent("assessment_started", eventContext("context"));
                  setScreen("context");
                }}
              >
                Start the assessment
              </button>
            </div>
          </>
        )}

        {screen === "context" && (
          <>
            <div className="assessment-kicker">Business context</div>
            <h1>Set the operating context.</h1>
            <p className="assessment-intro">
              These facts determine which behavioral questions apply. Choose the closest current
              answer rather than the intended future state.
            </p>

            <div className="assessment-context-grid">
              <SelectField
                id="employeeBand"
                label="Employees"
                value={answers.employeeBand}
                onChange={(value) => updateContext("employeeBand", value)}
                options={[
                  ["1-4", "1–4"],
                  ["5-9", "5–9"],
                  ["10-19", "10–19"],
                  ["20-49", "20–49"],
                  ["50-99", "50–99"],
                  ["100+", "100 or more"],
                ]}
              />
              <SelectField
                id="managerBand"
                label="People managers"
                value={answers.managerBand}
                onChange={(value) => updateContext("managerBand", value)}
                options={[
                  ["0", "None"],
                  ["1-2", "1–2"],
                  ["3-5", "3–5"],
                  ["6-10", "6–10"],
                  ["11+", "11 or more"],
                ]}
              />
              <SelectField
                id="revenueBand"
                label="Annual revenue"
                value={answers.revenueBand}
                onChange={(value) => updateContext("revenueBand", value)}
                options={[
                  ["under-1m", "Under $1M"],
                  ["1m-5m", "$1M–$5M"],
                  ["5m-20m", "$5M–$20M"],
                  ["20m-50m", "$20M–$50M"],
                  ["50m+", "$50M or more"],
                  ["prefer-not", "Prefer not to say"],
                ]}
              />
              <SelectField
                id="role"
                label="Your role"
                value={answers.role}
                onChange={(value) => updateContext("role", value)}
                options={[
                  ["Founder or co-founder", "Founder or co-founder"],
                  ["Owner-operator", "Owner-operator"],
                  ["Chief executive", "Chief executive"],
                  ["Senior leader", "Senior leader"],
                  ["Advisor", "Advisor"],
                ]}
              />
            </div>

            <fieldset className="assessment-compact-fieldset">
              <legend>Core operating systems</legend>
              <p>Systems used for finance, CRM, operations, or recurring management reporting.</p>
              <div className="assessment-inline-options">
                <label>
                  <input
                    type="radio"
                    name="coreSystemCount"
                    required
                    checked={answers.coreSystemCount === "one"}
                    onChange={() => updateContext("coreSystemCount", "one")}
                  />
                  <span>One primary system</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="coreSystemCount"
                    required
                    checked={answers.coreSystemCount === "twoOrMore"}
                    onChange={() => updateContext("coreSystemCount", "twoOrMore")}
                  />
                  <span>Two or more systems</span>
                </label>
              </div>
            </fieldset>

            <fieldset className="assessment-compact-fieldset">
              <legend>Organization shape</legend>
              <div className="assessment-inline-options">
                <label>
                  <input
                    type="radio"
                    name="organizationShape"
                    required
                    checked={answers.organizationShape === "singleTeam"}
                    onChange={() => updateContext("organizationShape", "singleTeam")}
                  />
                  <span>One operating team</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="organizationShape"
                    required
                    checked={answers.organizationShape === "multipleTeams"}
                    onChange={() => updateContext("organizationShape", "multipleTeams")}
                  />
                  <span>Multiple teams or locations</span>
                </label>
              </div>
            </fieldset>

            <div className="assessment-disclosures">
              <label>
                <input
                  type="checkbox"
                  checked={answers.relationshipLedByOwner}
                  onChange={(event) =>
                    updateContext("relationshipLedByOwner", event.target.checked)
                  }
                />
                <span>Key customer, supplier, or partner relationships are led by the owner.</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={answers.restrictedMarket}
                  onChange={(event) => updateContext("restrictedMarket", event.target.checked)}
                />
                <span>
                  This business may operate in a market where employment, confidentiality, or
                  conflict obligations restrict advisory work.
                </span>
              </label>
              <p>
                A restriction changes only the recommended next step. It does not prevent you from
                completing the assessment.
              </p>
            </div>

            <BandedCapacityInputs
              value={answers.capacity}
              onChange={(capacity) => updateContext("capacity", capacity)}
            />

            <div className="assessment-actions assessment-actions-split">
              <button className="assessment-back" type="button" onClick={goBack}>
                Back
              </button>
              <button
                className="button"
                type="button"
                disabled={!contextComplete(answers)}
                onClick={() => startComponent("ownerIndependence")}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {(screen === "ownerIndependence" ||
          screen === "operatingSystem" ||
          screen === "informationVisibility") &&
          currentQuestion && (
            <>
              <div className="assessment-kicker">
                {COMPONENTS.find((component) => component.id === screen)?.label}
              </div>
              {/* Visually hidden: the fieldset legend below already presents
                  this question's prompt to sighted users in its designed
                  place. This heading exists so each question is a distinct,
                  navigable landmark for screen-reader users, matching every
                  other screen in this flow (which all have a visible h1). */}
              <h1
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  padding: 0,
                  margin: -1,
                  overflow: "hidden",
                  clip: "rect(0, 0, 0, 0)",
                  whiteSpace: "nowrap",
                  border: 0,
                }}
              >
                {currentQuestion.prompt}
              </h1>
              <p className="assessment-section-note">
                {COMPONENTS.find((component) => component.id === screen)?.description}
              </p>
              <fieldset className="assessment-question">
                <legend>{currentQuestion.prompt}</legend>
                <div className="assessment-options">
                  {currentQuestion.options.map((option) => (
                    <label className="assessment-option" key={`${currentQuestion.id}-${option.value}`}>
                      <input
                        type="radio"
                        name={currentQuestion.id}
                        required
                        checked={answers.scored[currentQuestion.id] === option.value}
                        onChange={() => answer(currentQuestion.id, option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="assessment-actions assessment-actions-split">
                <button className="assessment-back" type="button" onClick={goBack}>
                  Back
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={answers.scored[currentQuestion.id] === undefined}
                  onClick={continueFromQuestion}
                >
                  {screen === "informationVisibility" &&
                  questionIndex === screenQuestions.length - 1
                    ? "Complete assessment"
                    : "Continue"}
                </button>
              </div>
            </>
          )}

        {screen === "preliminary" && (
          <PreliminaryResult
            answers={answers}
            result={result}
            onUnlock={() => setScreen("contact")}
            onReview={() => startComponent("ownerIndependence")}
          />
        )}

        {screen === "contact" && (
          <ContactGate
            onBack={goBack}
            initialValue={leadDraft}
            onDraftChange={setLeadDraft}
            onSubmit={(lead) => {
              setApiValidationError(null);
              setLeadDraft({
                ...lead,
                phone: lead.phone ?? "",
              });
              trackAssessmentEvent("contact_gate_completed", eventContext("contact"));
              setScreen("precision");
            }}
          />
        )}

        {screen === "precision" && (
          <PrecisionInputs
            onBack={goBack}
            onUseEarlierRanges={() => {
              resetNarrativeState();
              setServerResult(null);
              setDeliveryUnavailable(false);
              setApiValidationError(null);
              trackAssessmentEvent("precision_completed", eventContext("precision"));
              setScreen("processing");
            }}
            onSkip={() => {
              trackAssessmentEvent("precision_skipped", eventContext("precision"));
              continueWithCapacity({ source: "none", activities: [] });
            }}
            hasEarlierRanges={
              answers.capacity.source === "banded" &&
              result.capacity.estimateType === "directional"
            }
            value={precisionDrafts}
            onChange={setPrecisionDrafts}
            onComplete={(capacity) => {
              trackAssessmentEvent("precision_completed", eventContext("precision"));
              continueWithCapacity(capacity);
            }}
          />
        )}

        {screen === "processing" && (
          <>
            <div className="assessment-kicker">Applying deterministic rules</div>
            <h1>Preparing your full assessment.</h1>
            <p className="assessment-lede" role="status">
              Recalculating scores, capacity confidence, risks, priorities, and the appropriate
              next step from your submitted information.
            </p>
          </>
        )}

        {screen === "full" && (
          <>
            {deliveryUnavailable && (
              <p className="assessment-validation" role="status">
                Your result is available on screen, but report storage and
                delivery are temporarily unavailable.
              </p>
            )}
            <FullResult
              result={serverResult ?? result}
              assessmentId={assessmentId ?? undefined}
              persistenceAvailable={persistenceAvailable}
              deliveryState={reportDeliveryState}
              onDeliverReport={deliverReport}
              narrative={narrative ?? undefined}
              narrativeLoading={narrativeLoading}
            />
          </>
        )}
      </section>
    </div>
  );
}
