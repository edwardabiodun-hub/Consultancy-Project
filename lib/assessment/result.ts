import { calculateCapacity } from "./capacity";
import { interpretAssessment } from "./interpretation";
import type { LeadRoute } from "./interpretation";
import { ASSESSMENT_VERSION, QUESTION_BANK } from "./questions";
import { scoreAssessment } from "./scoring";
import type { ScoreResult } from "./scoring";
import type { AssessmentAnswers, ComponentId } from "./types";

export type AssessmentRisk = {
  code: string;
  kind: "risk" | "watchpoint" | "strength";
  label: string;
  evidence: string;
};

export type AssessmentCta = {
  href: string;
  label: string;
  reason: string;
};

const COMPONENT_FINDINGS: Record<
  ComponentId,
  {
    risk: { code: string; label: string };
    watchpoint: { code: string; label: string };
    strength: { code: string; label: string };
  }
> = {
  ownerIndependence: {
    risk: { code: "owner_bottleneck", label: "Owner decision concentration" },
    watchpoint: {
      code: "owner_independence_watchpoint",
      label: "Owner independence watchpoint",
    },
    strength: {
      code: "owner_independence_strength",
      label: "Owner independence strength",
    },
  },
  operatingSystem: {
    risk: { code: "operating_system_gap", label: "Operating-system inconsistency" },
    watchpoint: {
      code: "operating_system_watchpoint",
      label: "Operating-system watchpoint",
    },
    strength: {
      code: "operating_system_strength",
      label: "Operating-system strength",
    },
  },
  informationVisibility: {
    risk: { code: "information_bottleneck", label: "Information visibility gap" },
    watchpoint: {
      code: "information_visibility_watchpoint",
      label: "Information visibility watchpoint",
    },
    strength: {
      code: "information_visibility_strength",
      label: "Information visibility strength",
    },
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

const evidencePredicateForComponent = (
  component: ComponentId,
  answers: AssessmentAnswers,
): { value: number | "unknown"; evidence: string } | null => {
  const applicable = QUESTION_BANK.filter(
    (candidate) =>
      candidate.component === component &&
      (candidate.required || candidate.appliesWhen?.(answers)),
  );
  const unknown = applicable.find(
    (candidate) => answers.scored[candidate.id] === "unknown",
  );
  const question =
    unknown ??
    applicable
      .filter((candidate) => typeof answers.scored[candidate.id] === "number")
      .sort(
        (left, right) =>
          Number(answers.scored[left.id]) - Number(answers.scored[right.id]),
      )[0];

  if (!question) {
    return null;
  }

  const value = answers.scored[question.id];
  const option = question.options.find((candidate) => candidate.value === value);
  return {
    value: value as number | "unknown",
    evidence: `Self-reported response: ${question.prompt} ${
      option?.label ?? String(value)
    }.`,
  };
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
  const findings: AssessmentRisk[] = [];
  if (riskCodes.includes("measurement_gap")) {
    findings.push({
      code: "measurement_gap",
      kind: "risk",
      label: "Measurement gap",
      evidence:
        score.confidence.reasons[0] ??
        "One or more self-reported responses could not be verified.",
    });
  }

  if (score.category === "incomplete") {
    return findings.slice(0, 3);
  }

  for (const [component, componentScore] of rankedComponents) {
    if (componentScore.score === null) continue;
    const predicate = evidencePredicateForComponent(component, answers);
    if (!predicate) continue;
    const kind =
      predicate.value === "unknown"
        ? "watchpoint"
        : predicate.value < 45
        ? "risk"
        : predicate.value < 80
          ? "watchpoint"
          : "strength";
    const definition = COMPONENT_FINDINGS[component][kind];
    findings.push({
      code: definition.code,
      kind,
      label: definition.label,
      evidence: predicate.evidence,
    });
  }

  return findings
    .filter(
      (finding, index, all) =>
        all.findIndex((candidate) => candidate.code === finding.code) === index,
    )
    .slice(0, 3);
};

const buildRulesNarrative = ({
  category,
  scoreConfidence,
  impactConfidence,
  leadingFinding,
  firstPriority,
}: {
  category: ScoreResult["category"];
  scoreConfidence: ScoreResult["confidence"]["level"];
  impactConfidence: ReturnType<typeof calculateCapacity>["confidence"];
  leadingFinding?: AssessmentRisk;
  firstPriority?: ReturnType<typeof interpretAssessment>["priorities"][number];
}) => {
  const finding =
    leadingFinding?.label ??
    "no supported operating finding because the evidence base is incomplete";
  const priority = firstPriority?.title ?? "Complete the missing assessment evidence";
  const confidence = `${scoreConfidence} score confidence`;
  const impact = `${impactConfidence} impact confidence`;

  if (category === "incomplete") {
    return `The result is incomplete because the self-reported answers provide insufficient coverage for an overall score. The current evidence supports ${finding}. This result has ${confidence} and ${impact}. First controlled priority: ${priority}.`;
  }

  if (scoreConfidence === "low") {
    return `This preliminary ${category === "highDependency" ? "high-dependency" : `${category}-independence`} result has ${confidence} because missing evidence limits interpretation. The leading supported finding is ${finding}. Capacity has ${impact}. First controlled priority: ${priority}.`;
  }

  const categoryIntroduction: Record<Exclude<ScoreResult["category"], "incomplete">, string> = {
    strong: "Strong independence is indicated",
    emerging: "Emerging independence is indicated",
    developing: "Developing independence is indicated",
    highDependency: "High dependency is indicated",
  };
  const findingType =
    leadingFinding?.kind === "strength"
      ? "strength"
      : leadingFinding?.kind === "watchpoint"
        ? "watchpoint"
        : "risk";

  return `${categoryIntroduction[category]} by the self-reported information, with ${confidence}. The leading supported ${findingType} is ${finding}. Capacity has ${impact}. First controlled priority: ${priority}.`;
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
  const calculatedCapacity = calculateCapacity(answers.capacity);
  const capacity =
    answers.capacity.source === "banded"
      ? {
          ...calculatedCapacity,
          assumptions: [
            ...calculatedCapacity.assumptions,
            "Activity values use the midpoints of selected self-reported bands; they are not external benchmarks.",
          ],
        }
      : calculatedCapacity;
  const interpretation = interpretAssessment(score, answers);
  const risks = buildRisks(score, answers, interpretation.riskCodes);

  return {
    methodologyVersion: ASSESSMENT_VERSION,
    score,
    capacity,
    interpretation,
    risks,
    missingEvidence: buildMissingEvidence(score, capacity),
    cta: CTA_BY_ROUTE[interpretation.route],
    narrative: {
      source: "rules" as const,
      summary: buildRulesNarrative({
        category: score.category,
        scoreConfidence: score.confidence.level,
        impactConfidence: capacity.confidence,
        leadingFinding: risks[0],
        firstPriority: interpretation.priorities[0],
      }),
    },
  };
}

export type AssessmentResult = ReturnType<typeof buildAssessmentResult>;
