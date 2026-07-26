import type { CapacityActivity, CapacityCategory, CapacityInputs } from "./types";

type Category = CapacityCategory;
const CATEGORIES: Category[] = ["owner", "reporting", "rework"];
const CLASSIFICATION_ASSUMPTION = "Each activity is assigned to exactly one category; reporting corrections are classified as reporting or rework, never both.";

export type CapacityResult = {
  confidence: "high" | "medium" | "low";
  estimateType: "calculated" | "directional" | "unavailable";
  inputSource: CapacityInputs["source"];
  grossHours: Record<Category | "total", number>;
  realizationFactors: { low: number; high: number } | null;
  recoverableHours: { low: number; high: number } | null;
  annualValue: { low: number; high: number } | null;
  assumptions: string[];
  assumptionCodes: string[];
  exclusionCodes: string[];
};

const isValidNonNegativeNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isCategory = (value: unknown): value is Category =>
  typeof value === "string" && CATEGORIES.includes(value as Category);

const isCompleteActivity = (activity: unknown): activity is CapacityActivity => {
  if (!activity || typeof activity !== "object") return false;
  const candidate = activity as Record<string, unknown>;
  const valuesAreValid = typeof candidate.activityId === "string" && candidate.activityId.trim().length > 0
    && isCategory(candidate.category)
    && ["hoursPerOccurrence", "occurrencesPerYear", "hourlyCost"]
      .every((key) => isValidNonNegativeNumber(candidate[key]));
  if (!valuesAreValid) return false;
  return candidate.category === "owner"
    ? candidate.people === undefined || candidate.people === 1
    : Number.isInteger(candidate.people) && (candidate.people as number) > 0;
};

const emptyGrossHours = (): CapacityResult["grossHours"] => ({ owner: 0, reporting: 0, rework: 0, total: 0 });

const unavailable = (
  inputSource: CapacityInputs["source"],
  grossHours: CapacityResult["grossHours"],
  assumptions: string[],
  exclusionCodes: string[],
): CapacityResult => ({
  confidence: "low",
  estimateType: "unavailable",
  inputSource,
  grossHours,
  realizationFactors: null,
  recoverableHours: null,
  annualValue: null,
  assumptions,
  assumptionCodes: ["exclusive_category_assignment"],
  exclusionCodes,
});

const activityLabel = (activity: unknown, index: number): string => {
  if (!activity || typeof activity !== "object") return `entry ${index + 1}`;
  const category = (activity as Record<string, unknown>).category;
  return isCategory(category) ? category : `entry ${index + 1}`;
};

export function calculateCapacity(input: CapacityInputs): CapacityResult {
  const activities: unknown[] = Array.isArray(input.activities) ? input.activities : [];
  const activityIds = activities
    .map((activity) => activity && typeof activity === "object" ? (activity as Record<string, unknown>).activityId : undefined)
    .filter((activityId): activityId is string => typeof activityId === "string" && activityId.trim().length > 0);
  const duplicateIds = [...new Set(activityIds.filter((activityId, index) => activityIds.indexOf(activityId) !== index))];
  if (duplicateIds.length) {
    return unavailable(input.source, emptyGrossHours(), [
      `Duplicate activity ID${duplicateIds.length === 1 ? "" : "s"} rejected: ${duplicateIds.join(", ")}.`,
      CLASSIFICATION_ASSUMPTION,
    ], ["duplicate_activity_id"]);
  }

  const validActivities = activities.filter(isCompleteActivity);
  const exclusions = activities.flatMap((activity, index) =>
    isCompleteActivity(activity) ? [] : [`Invalid capacity activity for ${activityLabel(activity, index)} was excluded.`],
  );
  const grossHours = emptyGrossHours();
  let grossValue = 0;

  for (const activity of validActivities) {
    const people = activity.category === "owner" ? 1 : activity.people;
    const hours = people * activity.hoursPerOccurrence * activity.occurrencesPerYear;
    grossHours[activity.category] += hours;
    grossHours.total += hours;
    grossValue += hours * activity.hourlyCost;
  }

  const populatedCategories = CATEGORIES.filter((category) => validActivities.some((activity) => activity.category === category));
  if (populatedCategories.length < 2 || input.source === "none") {
    return unavailable(input.source, grossHours, [
      "At least two complete eligible capacity categories are required.",
      ...exclusions,
      CLASSIFICATION_ASSUMPTION,
    ], [
      input.source === "none"
        ? "no_capacity_inputs"
        : "insufficient_eligible_categories",
      ...(exclusions.length ? ["invalid_activity_excluded"] : []),
    ]);
  }

  const factors = input.source === "exact" ? [0.50, 0.70] : [0.35, 0.55];
  return {
    confidence: input.source === "exact" ? "high" : "medium",
    estimateType: input.source === "exact" ? "calculated" : "directional",
    inputSource: input.source,
    grossHours,
    realizationFactors: { low: factors[0], high: factors[1] },
    recoverableHours: {
      low: Math.round(grossHours.total * factors[0]),
      high: Math.round(grossHours.total * factors[1]),
    },
    annualValue: {
      low: Math.round(grossValue * factors[0]),
      high: Math.round(grossValue * factors[1]),
    },
    assumptions: [
      `Applied a ${factors[0] * 100}% to ${factors[1] * 100}% realization range.`,
      CLASSIFICATION_ASSUMPTION,
    ],
    assumptionCodes: [
      "exclusive_category_assignment",
      input.source === "exact" ? "exact_inputs" : "banded_midpoints",
      input.source === "exact" ? "realization_50_70" : "realization_35_55",
    ],
    exclusionCodes: exclusions.length ? ["invalid_activity_excluded"] : [],
  };
}
