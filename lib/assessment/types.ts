export type ComponentId =
  | "ownerIndependence"
  | "operatingSystem"
  | "informationVisibility";

export type ScoredValue = 0 | 25 | 50 | 75 | 100;
export type AnswerValue = ScoredValue | "unknown" | "notApplicable";

export type ContextAnswers = {
  employeeBand: string;
  managerBand: string;
  revenueBand: string;
  role: string;
  coreSystemCount: "" | "one" | "twoOrMore";
  organizationShape: "" | "singleTeam" | "multipleTeams";
  relationshipLedByOwner: boolean;
  restrictedMarket: boolean;
};

export type CapacityCategory = "owner" | "reporting" | "rework";

type CapacityActivityBase = {
  activityId: string;
  hoursPerOccurrence: number;
  occurrencesPerYear: number;
  hourlyCost: number;
};

export type OwnerCapacityActivity = CapacityActivityBase & {
  category: "owner";
  people?: 1;
};

export type TeamCapacityActivity = CapacityActivityBase & {
  category: "reporting" | "rework";
  people: number;
};

export type CapacityActivity = OwnerCapacityActivity | TeamCapacityActivity;

export type CapacityInputs = {
  source: "none" | "banded" | "exact";
  activities: CapacityActivity[];
};

export type AssessmentAnswers = ContextAnswers & {
  scored: Partial<Record<string, AnswerValue>>;
  capacity: CapacityInputs;
};

export type QuestionDefinition = {
  id: string;
  component: ComponentId;
  prompt: string;
  weight: number;
  required: boolean;
  appliesWhen?: (context: ContextAnswers) => boolean;
  options: Array<{ value: Exclude<AnswerValue, "notApplicable">; label: string }>;
};
