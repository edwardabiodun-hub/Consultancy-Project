import type { AssessmentAnswers, ComponentId } from "./types";
import type { ScoreResult } from "./scoring";

export type LeadRoute = "diagnostic" | "nurture" | "insights" | "restricted";
export type Priority = { component: ComponentId; title: string; action: string; indicator: string };
export type AssessmentInterpretation = { riskCodes: string[]; priorities: Priority[]; route: LeadRoute };

const LIBRARY: Record<ComponentId, Priority> = {
  ownerIndependence: {
    component: "ownerIndependence",
    title: "Clarify decision authority",
    action: "Define the recurring decisions managers can make and the conditions requiring escalation.",
    indicator: "Share of routine decisions resolved without owner intervention",
  },
  operatingSystem: {
    component: "operatingSystem",
    title: "Stabilize one critical workflow",
    action: "Assign an accountable owner and document the decision points, handoffs, and exception path.",
    indicator: "Exceptions resolved through the documented workflow",
  },
  informationVisibility: {
    component: "informationVisibility",
    title: "Create a decision-ready KPI cadence",
    action: "Standardize the small set of measures, definitions, owners, and review actions used for operating decisions.",
    indicator: "Management reviews completed with agreed data and owned actions",
  },
};

const SUFFICIENT_EMPLOYEE_BANDS = new Set(["10-49", "20-49"]);

export function interpretAssessment(score: ScoreResult, answers: AssessmentAnswers): AssessmentInterpretation {
  const ranked = (Object.entries(score.components) as [ComponentId, ScoreResult["components"][ComponentId]][])
    .sort((a, b) => (a[1].score ?? 101) - (b[1].score ?? 101));
  const riskCodes = [...score.riskCodes];

  if ((score.components.ownerIndependence.score ?? 100) < 45) riskCodes.push("owner_bottleneck");
  if ((score.components.operatingSystem.score ?? 100) < 45) riskCodes.push("operating_system_gap");
  if ((score.components.informationVisibility.score ?? 100) < 45) riskCodes.push("information_bottleneck");

  const route: LeadRoute = answers.restrictedMarket
    ? "restricted"
    : score.category === "highDependency" && SUFFICIENT_EMPLOYEE_BANDS.has(answers.employeeBand)
      ? "diagnostic"
      : score.category === "strong"
        ? "insights"
        : "nurture";

  return {
    riskCodes: [...new Set(riskCodes)].slice(0, 3),
    priorities: ranked.slice(0, 3).map(([key]) => LIBRARY[key]),
    route,
  };
}
