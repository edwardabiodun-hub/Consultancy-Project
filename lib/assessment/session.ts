import type {
  AnswerValue,
  AssessmentAnswers,
  CapacityActivity,
  CapacityInputs,
} from "./types";

export const SESSION_KEY = "business-independence-assessment-v1";

const EMPLOYEE_BANDS = ["", "1-4", "5-9", "10-19", "20-49", "50-99", "100+"] as const;
const MANAGER_BANDS = ["", "0", "1-2", "3-5", "6-10", "11+"] as const;
const REVENUE_BANDS = [
  "",
  "under-1m",
  "1m-5m",
  "5m-20m",
  "20m-50m",
  "50m+",
  "prefer-not",
] as const;
const ROLES = [
  "",
  "Founder or co-founder",
  "Owner-operator",
  "Chief executive",
  "Senior leader",
  "Advisor",
] as const;
const CORE_SYSTEM_COUNTS = ["", "one", "twoOrMore"] as const;
const ORGANIZATION_SHAPES = ["", "singleTeam", "multipleTeams"] as const;
const CAPACITY_SOURCES = ["none", "banded", "exact"] as const;
const CAPACITY_CATEGORIES = ["owner", "reporting", "rework"] as const;
const ANSWER_VALUES: AnswerValue[] = [0, 25, 50, 75, 100, "unknown", "notApplicable"];

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const isOneOf = <Value extends string>(
  value: unknown,
  allowed: readonly Value[],
): value is Value => typeof value === "string" && allowed.includes(value as Value);

const isNonNegativeFinite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isCapacityActivity = (value: unknown): value is CapacityActivity => {
  if (!isPlainObject(value)) return false;
  if (
    typeof value.activityId !== "string" ||
    value.activityId.trim().length === 0 ||
    !isOneOf(value.category, CAPACITY_CATEGORIES) ||
    !isNonNegativeFinite(value.hoursPerOccurrence) ||
    !isNonNegativeFinite(value.occurrencesPerYear) ||
    !isNonNegativeFinite(value.hourlyCost)
  ) {
    return false;
  }

  if (value.category === "owner") {
    return value.people === undefined || value.people === 1;
  }

  return typeof value.people === "number" && Number.isInteger(value.people) && value.people > 0;
};

const normalizeCapacity = (value: unknown): CapacityInputs | null => {
  if (
    !isPlainObject(value) ||
    !isOneOf(value.source, CAPACITY_SOURCES) ||
    !Array.isArray(value.activities) ||
    !value.activities.every(isCapacityActivity)
  ) {
    return null;
  }

  return { source: value.source, activities: value.activities };
};

const normalizeAnswers = (value: unknown): AssessmentAnswers | null => {
  if (!isPlainObject(value)) return null;
  if (
    !isOneOf(value.employeeBand, EMPLOYEE_BANDS) ||
    !isOneOf(value.managerBand, MANAGER_BANDS) ||
    !isOneOf(value.revenueBand, REVENUE_BANDS) ||
    !isOneOf(value.role, ROLES) ||
    !isOneOf(value.coreSystemCount, CORE_SYSTEM_COUNTS) ||
    !isOneOf(value.organizationShape, ORGANIZATION_SHAPES) ||
    typeof value.relationshipLedByOwner !== "boolean" ||
    typeof value.restrictedMarket !== "boolean" ||
    !isPlainObject(value.scored) ||
    !Object.values(value.scored).every((answer) => ANSWER_VALUES.includes(answer as AnswerValue))
  ) {
    return null;
  }

  const capacity = normalizeCapacity(value.capacity);
  if (!capacity) return null;

  return {
    employeeBand: value.employeeBand,
    managerBand: value.managerBand,
    revenueBand: value.revenueBand,
    role: value.role,
    coreSystemCount: value.coreSystemCount,
    organizationShape: value.organizationShape,
    relationshipLedByOwner: value.relationshipLedByOwner,
    restrictedMarket: value.restrictedMarket,
    scored: value.scored as AssessmentAnswers["scored"],
    capacity,
  };
};

export const saveSession = (answers: AssessmentAnswers) => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(answers));
  } catch {
    // Session persistence is optional; the in-memory assessment remains usable.
  }
};

export const loadSession = (): AssessmentAnswers | null => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return normalizeAnswers(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const clearSession = () => {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage can be unavailable in private or policy-restricted browser contexts.
  }
};
