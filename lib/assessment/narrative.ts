import type { AssessmentResult } from "./result";
import type { ComponentId } from "./types";
import {
  isNarrativeDraftShape,
  validateNarrative,
  type NarrativeDraft,
} from "./narrative-validation";

export type { NarrativeDraft } from "./narrative-validation";

/** The only answer fields that may reach the model: no name, email, phone, or raw question responses. */
export type SafeNarrativeContext = {
  employeeBand: string;
  revenueBand: string;
  role: string;
  restrictedMarket: boolean;
};

/**
 * Everything the model is allowed to see. Deliberately excludes any
 * free-text or contact data; every value here is already a deterministic,
 * bounded output of `buildAssessmentResult`.
 */
export type NarrativeModelInput = {
  overallScore: number | null;
  scoreCategory: AssessmentResult["score"]["category"];
  components: Record<
    ComponentId,
    { score: number | null; category: AssessmentResult["score"]["category"] }
  >;
  scoreConfidence: AssessmentResult["score"]["confidence"]["level"];
  impactConfidence: AssessmentResult["capacity"]["confidence"];
  capacity: {
    estimateType: AssessmentResult["capacity"]["estimateType"];
    inputSource: AssessmentResult["capacity"]["inputSource"];
    recoverableHours: AssessmentResult["capacity"]["recoverableHours"];
    annualValue: AssessmentResult["capacity"]["annualValue"];
  };
  risks: Array<{ code: string; kind: string; label: string; evidence: string }>;
  priorities: Array<{ component: ComponentId; title: string; action: string; indicator: string }>;
  route: AssessmentResult["interpretation"]["route"];
  employeeBand: string;
  revenueBand: string;
  role: string;
  restrictedMarket: boolean;
};

export type NarrativeOutcome = { source: "ai" | "rules"; text: string };

const NARRATIVE_MODEL_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 8000;

const SYSTEM_PROMPT = [
  "You are drafting a short narrative for a deterministic Business Independence Assessment result.",
  "You are given only bounded, already-computed scores, capacity figures, risk labels, and controlled priority text.",
  "Never introduce a number, percentage, or hour figure that is not exactly present in the provided data.",
  "Never reference a risk code, benchmark, or comparison that is not provided.",
  "Never recommend anything outside the three provided controlled priorities.",
  "Never promise savings, revenue, valuation, or guaranteed results.",
  "Clearly label every capacity figure as an estimate when its estimateType is not \"calculated\".",
  "The limitations sentence must state the result is self-reported and not an audit.",
  "Never propose a call to action other than the one implied by the provided route.",
  'Return one provided priority component as priorityId. Copy that priority as: "Title: Action Indicator: Indicator." with no added recommendation.',
  'Respond with strict JSON matching: { "summary": string, "componentObservations": [{ "component": string, "observation": string }], "priorityId": string, "priorityExplanation": string, "limitations": string }.',
].join(" ");

/**
 * Builds the safe, bounded model input from the deterministic result and the
 * subset of answer fields the brief allows sending to the model. No name,
 * email, phone, or raw scored answers are included.
 */
export function buildNarrativeModelInput(
  result: AssessmentResult,
  context: SafeNarrativeContext,
): NarrativeModelInput {
  return {
    overallScore: result.score.overall,
    scoreCategory: result.score.category,
    components: {
      ownerIndependence: {
        score: result.score.components.ownerIndependence?.score ?? null,
        category: result.score.components.ownerIndependence?.category ?? "incomplete",
      },
      operatingSystem: {
        score: result.score.components.operatingSystem?.score ?? null,
        category: result.score.components.operatingSystem?.category ?? "incomplete",
      },
      informationVisibility: {
        score: result.score.components.informationVisibility?.score ?? null,
        category: result.score.components.informationVisibility?.category ?? "incomplete",
      },
    },
    scoreConfidence: result.score.confidence.level,
    impactConfidence: result.capacity.confidence,
    capacity: {
      estimateType: result.capacity.estimateType,
      inputSource: result.capacity.inputSource,
      recoverableHours: result.capacity.recoverableHours,
      annualValue: result.capacity.annualValue,
    },
    risks: result.risks.map((risk) => ({
      code: risk.code,
      kind: risk.kind,
      label: risk.label,
      evidence: risk.evidence,
    })),
    priorities: result.interpretation.priorities.map((priority) => ({
      component: priority.component,
      title: priority.title,
      action: priority.action,
      indicator: priority.indicator,
    })),
    route: result.interpretation.route,
    employeeBand: context.employeeBand,
    revenueBand: context.revenueBand,
    role: context.role,
    restrictedMarket: context.restrictedMarket,
  };
}

/** Flattens the four-field `NarrativeDraft` contract into the single display string the API returns. */
export function flattenNarrativeDraft(draft: NarrativeDraft): string {
  const observations = draft.componentObservations
    .map((entry) => entry.observation.trim())
    .filter((observation) => observation.length > 0)
    .join(" ");
  return [draft.summary, observations, draft.priorityExplanation, draft.limitations]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(" ");
}

export type CallModelConfig = {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

/**
 * Default model call: a direct `fetch` against the Chat Completions API with
 * a short, abortable timeout (matching this project's edge-function
 * constraints and its existing direct-`fetch` pattern for third-party HTTP
 * APIs, e.g. Resend in the deliver route). Throws on any failure so the
 * caller's single catch-all can fall back to the rules narrative.
 */
export async function callNarrativeModel(
  input: NarrativeModelInput,
  config: CallModelConfig,
): Promise<unknown> {
  const { apiKey, model, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = config;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(NARRATIVE_MODEL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(input) },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Narrative model request failed with status ${response.status}`);
    }
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("Narrative model response is missing message content");
    }
    return JSON.parse(content);
  } finally {
    clearTimeout(timer);
  }
}

type GenerateDependencies = {
  callModel: (input: NarrativeModelInput, config: CallModelConfig) => Promise<unknown>;
  timeoutMs: number;
  fetchImpl: typeof fetch;
};

/**
 * Produces a validated narrative for an already-computed `AssessmentResult`.
 * Falls back to `{ source: "rules", text: result.narrative.summary }` -
 * the complete, already-tested rules narrative - whenever:
 *  - the model is unconfigured (missing API key or model name);
 *  - the model call throws, times out, or is aborted;
 *  - the model response is not parseable JSON;
 *  - the parsed JSON does not match the `NarrativeDraft` contract; or
 *  - the draft fails deterministic policy validation.
 * Never throws.
 */
export async function generateValidatedNarrative(
  result: AssessmentResult,
  context: SafeNarrativeContext,
  dependencies: Partial<GenerateDependencies> = {},
): Promise<NarrativeOutcome> {
  const rulesFallback: NarrativeOutcome = { source: "rules", text: result.narrative.summary };

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.ASSESSMENT_NARRATIVE_MODEL;
  if (!apiKey || !model) return rulesFallback;

  const requestDraft = dependencies.callModel ?? callNarrativeModel;
  const modelInput = buildNarrativeModelInput(result, context);

  let rawDraft: unknown;
  try {
    rawDraft = await requestDraft(modelInput, {
      apiKey,
      model,
      timeoutMs: dependencies.timeoutMs,
      fetchImpl: dependencies.fetchImpl,
    });
  } catch {
    return rulesFallback;
  }

  if (!isNarrativeDraftShape(rawDraft)) return rulesFallback;
  if (!validateNarrative(rawDraft, result)) return rulesFallback;

  return { source: "ai", text: flattenNarrativeDraft(rawDraft) };
}
