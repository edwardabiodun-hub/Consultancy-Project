import type { CapacityInputs } from "./types";

type Category = "owner" | "reporting" | "rework";
type CapacityItem = NonNullable<CapacityInputs[Category]>;

export type CapacityResult = {
  confidence: "high" | "medium" | "low";
  estimateType: "calculated" | "directional" | "unavailable";
  grossHours: Record<Category | "total", number>;
  recoverableHours: { low: number; high: number } | null;
  annualValue: { low: number; high: number } | null;
  assumptions: string[];
};

const isCompleteCapacityItem = (category: Category, item: unknown): item is CapacityItem => {
  if (!item || typeof item !== "object") return false;
  const candidate = item as Record<string, unknown>;
  const requiredFields = category === "owner"
    ? ["hoursPerOccurrence", "occurrencesPerYear", "hourlyCost"]
    : ["people", "hoursPerOccurrence", "occurrencesPerYear", "hourlyCost"];
  return requiredFields.every(
    (key) => typeof candidate[key] === "number",
  );
};

export function calculateCapacity(input: CapacityInputs): CapacityResult {
  const categories = (["owner", "reporting", "rework"] as Category[])
    .map((key) => [key, input[key]] as const)
    .filter((entry): entry is [Category, CapacityItem] => isCompleteCapacityItem(entry[0], entry[1]));
  const grossHours: CapacityResult["grossHours"] = { owner: 0, reporting: 0, rework: 0, total: 0 };
  let grossValue = 0;

  for (const [key, item] of categories) {
    const people = "people" in item ? item.people : 1;
    const hours = people * item.hoursPerOccurrence * item.occurrencesPerYear;
    grossHours[key] = hours;
    grossHours.total += hours;
    grossValue += hours * item.hourlyCost;
  }

  if (categories.length < 2 || input.source === "none") {
    return {
      confidence: "low",
      estimateType: "unavailable",
      grossHours,
      recoverableHours: null,
      annualValue: null,
      assumptions: ["At least two complete capacity categories are required."],
    };
  }

  const factors = input.source === "exact" ? [0.50, 0.70] : [0.35, 0.55];
  return {
    confidence: input.source === "exact" ? "high" : "medium",
    estimateType: input.source === "exact" ? "calculated" : "directional",
    grossHours,
    recoverableHours: {
      low: Math.round(grossHours.total * factors[0]),
      high: Math.round(grossHours.total * factors[1]),
    },
    annualValue: {
      low: Math.round(grossValue * factors[0]),
      high: Math.round(grossValue * factors[1]),
    },
    assumptions: [`Applied a ${factors[0] * 100}%–${factors[1] * 100}% realization range.`],
  };
}
