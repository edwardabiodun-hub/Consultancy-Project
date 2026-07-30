import type { AssessmentResult } from "./result";
import type { ComponentId } from "./types";

export type NarrativeSelection = {
  summaryId: string;
  observationIds: string[];
  priorityId: string;
  limitationsId: string;
};

export type NarrativeBlockIds = {
  summaries: string[];
  observations: string[];
  priorities: string[];
  limitations: string[];
};

export type NarrativeModelInput = { allowedBlockIds: NarrativeBlockIds };
export type NarrativeOutcome = { source: "ai" | "rules"; text: string };

const NARRATIVE_MODEL_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 8000;
const SYSTEM_PROMPT = [
  "Select identifiers only from the supplied approved sets.",
  "Do not write, alter, summarize, or add prose.",
  "Return strict JSON with summaryId, observationIds, priorityId, and limitationsId.",
].join(" ");

const CATEGORY_TEXT: Record<AssessmentResult["score"]["category"], string> = {
  strong: "The self-reported result indicates strong operating independence, with management systems carrying much of the routine workload.",
  emerging: "The self-reported result indicates emerging operating independence, with a focused set of dependencies still requiring management attention.",
  developing: "The self-reported result indicates developing operating independence, with several recurring dependencies still concentrated in people rather than systems.",
  highDependency: "The self-reported result indicates high dependency, with important decisions or operating work still concentrated in the owner.",
  incomplete: "The self-reported result is incomplete because the available evidence does not support a full operating-independence interpretation.",
};

const COMPONENT_NAMES: Record<ComponentId, string> = {
  ownerIndependence: "Owner independence",
  operatingSystem: "Operating-system maturity",
  informationVisibility: "Information visibility",
};

const CATEGORY_OBSERVATIONS: Record<AssessmentResult["score"]["category"], string> = {
  strong: "is a relative strength in the current self-reported evidence.",
  emerging: "shows an emerging system-led pattern with some remaining dependency.",
  developing: "remains a watchpoint where greater consistency would reduce dependency.",
  highDependency: "is a material dependency in the current self-reported evidence.",
  incomplete: "cannot yet be interpreted reliably from the available evidence.",
};

const confidenceLabel = (value: string): string => value.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

const approvedBlocks = (result: AssessmentResult) => {
  const summaryId = `summary_${result.score.category}_${result.score.confidence.level}`;
  const limitationsId = `limitations_${result.score.confidence.level}_${result.capacity.confidence}`;
  const summaries = new Map([[summaryId,
    `${CATEGORY_TEXT[result.score.category]} Score confidence is ${confidenceLabel(result.score.confidence.level)}.`
  ]]);
  const observations = new Map<string, string>();
  for (const component of Object.keys(COMPONENT_NAMES) as ComponentId[]) {
    const category = result.score.components[component]?.category ?? "incomplete";
    observations.set(
      `observation_${component}_${category}`,
      `${COMPONENT_NAMES[component]} ${CATEGORY_OBSERVATIONS[category]}`,
    );
  }
  const priorities = new Map<string, string>();
  for (const priority of result.interpretation.priorities) {
    priorities.set(
      `priority_${priority.component}`,
      `${priority.title}: ${priority.action} Indicator: ${priority.indicator}.`,
    );
  }
  const limitations = new Map([[limitationsId,
    `This interpretation is based on self-reported information and is not an audit. Impact confidence is ${confidenceLabel(result.capacity.confidence)}; operating causes and financial effects require validation.`
  ]]);
  return { summaries, observations, priorities, limitations };
};

export function buildNarrativeModelInput(result: AssessmentResult): NarrativeModelInput {
  const blocks = approvedBlocks(result);
  return {
    allowedBlockIds: {
      summaries: [...blocks.summaries.keys()],
      observations: [...blocks.observations.keys()],
      priorities: [...blocks.priorities.keys()],
      limitations: [...blocks.limitations.keys()],
    },
  };
}

const isSelectionShape = (value: unknown): value is NarrativeSelection => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const expectedKeys = ["limitationsId", "observationIds", "priorityId", "summaryId"];
  if (Object.keys(candidate).sort().join(",") !== expectedKeys.join(",")) return false;
  return typeof candidate.summaryId === "string"
    && Array.isArray(candidate.observationIds)
    && candidate.observationIds.every((id) => typeof id === "string")
    && typeof candidate.priorityId === "string"
    && typeof candidate.limitationsId === "string";
};

export function resolveNarrativeSelection(
  selection: unknown,
  result: AssessmentResult,
): string | null {
  if (!isSelectionShape(selection)) return null;
  const blocks = approvedBlocks(result);
  const observationIds = selection.observationIds;
  if (!blocks.summaries.has(selection.summaryId)
    || !blocks.priorities.has(selection.priorityId)
    || !blocks.limitations.has(selection.limitationsId)
    || observationIds.length === 0
    || observationIds.length > blocks.observations.size
    || new Set(observationIds).size !== observationIds.length
    || observationIds.some((id) => !blocks.observations.has(id))) {
    return null;
  }
  return [
    blocks.summaries.get(selection.summaryId),
    ...observationIds.map((id) => blocks.observations.get(id)),
    blocks.priorities.get(selection.priorityId),
    blocks.limitations.get(selection.limitationsId),
  ].filter((part): part is string => Boolean(part)).join(" ");
}

export type CallModelConfig = {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export async function callNarrativeModel(
  input: NarrativeModelInput,
  config: CallModelConfig,
): Promise<unknown> {
  const { apiKey, model, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = config;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const ids = input.allowedBlockIds;
  try {
    const response = await fetchImpl(NARRATIVE_MODEL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "assessment_narrative_selection",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                summaryId: { type: "string", enum: ids.summaries },
                observationIds: {
                  type: "array",
                  items: { type: "string", enum: ids.observations },
                  minItems: 1,
                  maxItems: ids.observations.length,
                  uniqueItems: true,
                },
                priorityId: { type: "string", enum: ids.priorities },
                limitationsId: { type: "string", enum: ids.limitations },
              },
              required: ["summaryId", "observationIds", "priorityId", "limitationsId"],
            },
          },
        },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(input) },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Narrative model request failed with status ${response.status}`);
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Narrative model response is missing message content");
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

export async function generateValidatedNarrative(
  result: AssessmentResult,
  dependencies: Partial<GenerateDependencies> = {},
): Promise<NarrativeOutcome> {
  const fallback: NarrativeOutcome = { source: "rules", text: result.narrative.summary };
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.ASSESSMENT_NARRATIVE_MODEL;
  if (!apiKey || !model) return fallback;
  try {
    const selection = await (dependencies.callModel ?? callNarrativeModel)(
      buildNarrativeModelInput(result),
      {
        apiKey,
        model,
        timeoutMs: dependencies.timeoutMs,
        fetchImpl: dependencies.fetchImpl,
      },
    );
    const text = resolveNarrativeSelection(selection, result);
    return text ? { source: "ai", text } : fallback;
  } catch {
    return fallback;
  }
}