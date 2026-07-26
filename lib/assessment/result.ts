import { calculateCapacity } from "./capacity";
import { interpretAssessment } from "./interpretation";
import type { LeadRoute } from "./interpretation";
import { ASSESSMENT_VERSION, QUESTION_BANK } from "./questions";
import { scoreAssessment } from "./scoring";
import type { ScoreResult } from "./scoring";
import type { AssessmentAnswers, ComponentId } from "./types";

export type AssessmentRisk = {
  code: string;
  label: string;
  evidence: string;
};

export type AssessmentCta = {
  href: string;
  label: string;
  reason: string;
};

const COMPONENT_RISKS: Record<ComponentId, { code: string; label: string }> = {
  ownerIndependence: {
    code: "owner_bottleneck",
    label: "Owner decision concentration",
  },
  operatingSystem: {
    code: "operating_system_gap",
    label: "Operating-system inconsistency",
  },
  informationVisibility: {
    code: "information_bottleneck",
    label: "Information visibility gap",
  },
};

const CTA_BY_ROUTE: Record<LeadRoute, AssessmentCta> = {
  diagnostic: {
    href: "/diagnostic",
    label: "Discuss the Business Independence Diagnostic",
    reason: "Your scale and dependency profile support a focused diagnostic conversation.",
  },
  nurture: {
    href: "/founder-resources",
    label: "Get the 90-Day Business Independence Checklist",
    reason: "Build operating discipline before considering a diagnostic.",
  },
  insights: {
    href: "/founder-resources",
    label: "Explore executive operating insights",
    reason: "Use focused insights to protect and extend the independence already in place.",
  },
  restricted: {
    href: "/founder-resources",
    label: "Explore educational founder resources",
    reason: "Your stated professional boundary limits a commercial next step.",
  },
};

const evidenceForComponent = (
  component: ComponentId,
  answers: AssessmentAnswers,
): string => {
  const question = QUESTION_BANK
    .filter(
      (candidate) =>
        candidate.component === component &&
        (candidate.required || candidate.appliesWhen?.(answers)),
    )
    .filter((candidate) => typeof answers.scored[candidate.id] === "number")
    .sort(
      (left, right) =>
        Number(answers.scored[left.id]) - Number(answers.scored[right.id]),
    )[0];

  if (!question) {
    return "No complete self-reported response was available for this component.";
  }

  const value = answers.scored[question.id];
  const option = question.options.find((candidate) => candidate.value === value);
  return `Self-reported response: ${question.prompt} ${option?.label ?? String(value)}.`;
};

const buildRisks = (
  score: ScoreResult,
  answers: AssessmentAnswers,
  riskCodes: string[],
): AssessmentRisk[] => {
  const rankedComponents = (Object.entries(score.components) as [
    ComponentId,
    ScoreResult["components"][ComponentId],
  ][]).sort((left, right) => (left[1].score ?? 101) - (right[1].score ?? 101));
  const orderedCodes = [
    ...riskCodes,
    ...rankedComponents.map(([component]) => COMPONENT_RISKS[component].code),
  ];

  return [...new Set(orderedCodes)].slice(0, 3).map((code) => {
    if (code === "measurement_gap") {
      return {
        code,
        label: "Measurement gap",
        evidence:
          score.confidence.reasons[0] ??
          "One or more self-reported responses could not be verified.",
      };
    }

    const component = (Object.entries(COMPONENT_RISKS) as [
      ComponentId,
      { code: string; label: string },
    ][]).find(([, definition]) => definition.code === code)?.[0];

    if (!component) {
      return {
        code,
        label: code.replaceAll("_", " "),
        evidence: "This flag follows the deterministic scoring rules.",
      };
    }

    return {
      code,
      label: COMPONENT_RISKS[component].label,
      evidence: evidenceForComponent(component, answers),
    };
  });
};

const buildMissingEvidence = (
  score: ScoreResult,
  capacity: ReturnType<typeof calculateCapacity>,
): string[] => {
  const gaps = [...score.confidence.reasons];
  if (capacity.estimateType === "unavailable") {
    gaps.push(
      "Exact or complete banded time, frequency, people, and cost inputs across at least two categories would improve impact confidence.",
    );
  }
  return gaps.slice(0, 3);
};

export function buildAssessmentResult(answers: AssessmentAnswers) {
  const score = scoreAssessment(answers);
  const capacity = calculateCapacity(answers.capacity);
  const interpretation = interpretAssessment(score, answers);
  const category = score.category === "incomplete" ? "incomplete" : score.category;

  return {
    methodologyVersion: ASSESSMENT_VERSION,
    score,
    capacity,
    interpretation,
    risks: buildRisks(score, answers, interpretation.riskCodes),
    missingEvidence: buildMissingEvidence(score, capacity),
    cta: CTA_BY_ROUTE[interpretation.route],
    narrative: {
      source: "rules" as const,
      summary: `This ${category} result identifies likely operating exposure from self-reported information; it does not validate root causes.`,
    },
  };
}

export type AssessmentResult = ReturnType<typeof buildAssessmentResult>;
