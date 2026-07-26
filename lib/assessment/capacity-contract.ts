import type {
  CapacityActivity,
  CapacityCategory,
  CapacityInputs,
} from "./types";

export const CAPACITY_LIMITS = {
  people: { min: 1, max: 10000 },
  hoursPerOccurrence: { min: 0, max: 168 },
  occurrencesPerYear: { min: 0, max: 365 },
  hourlyCost: { min: 0, max: 10000 },
} as const;

export const CAPACITY_CATEGORY_ORDER: CapacityCategory[] = [
  "owner",
  "reporting",
  "rework",
];

export const PRECISION_ACTIVITY_IDS: Record<CapacityCategory, string> = {
  owner: "precision-owner-v1",
  reporting: "precision-reporting-v1",
  rework: "precision-rework-v1",
};

export type BandedCapacityOption = {
  value: string;
  label: string;
  activity: CapacityActivity;
};

export const BANDED_CAPACITY_OPTIONS: Record<
  CapacityCategory,
  BandedCapacityOption[]
> = {
  owner: [
    {
      value: "owner-1-2-weekly",
      label: "1–2 hours weekly at $75–$125 per hour",
      activity: {
        activityId: "banded-owner-v1",
        category: "owner",
        hoursPerOccurrence: 1.5,
        occurrencesPerYear: 52,
        hourlyCost: 100,
      },
    },
    {
      value: "owner-3-5-weekly",
      label: "3–5 hours weekly at $75–$125 per hour",
      activity: {
        activityId: "banded-owner-v1",
        category: "owner",
        hoursPerOccurrence: 4,
        occurrencesPerYear: 52,
        hourlyCost: 100,
      },
    },
  ],
  reporting: [
    {
      value: "reporting-2-4-monthly",
      label: "2–4 people, 2–4 hours monthly, at $40–$60 per hour",
      activity: {
        activityId: "banded-reporting-v1",
        category: "reporting",
        people: 3,
        hoursPerOccurrence: 3,
        occurrencesPerYear: 12,
        hourlyCost: 50,
      },
    },
    {
      value: "reporting-5-8-monthly",
      label: "5–8 people, 4–8 hours monthly, at $40–$60 per hour",
      activity: {
        activityId: "banded-reporting-v1",
        category: "reporting",
        people: 6,
        hoursPerOccurrence: 6,
        occurrencesPerYear: 12,
        hourlyCost: 50,
      },
    },
  ],
  rework: [
    {
      value: "rework-2-4-monthly",
      label: "2–4 people, 2–4 hours monthly, at $40–$60 per hour",
      activity: {
        activityId: "banded-rework-v1",
        category: "rework",
        people: 3,
        hoursPerOccurrence: 3,
        occurrencesPerYear: 12,
        hourlyCost: 50,
      },
    },
    {
      value: "rework-5-8-monthly",
      label: "5–8 people, 4–8 hours monthly, at $40–$60 per hour",
      activity: {
        activityId: "banded-rework-v1",
        category: "rework",
        people: 6,
        hoursPerOccurrence: 6,
        occurrencesPerYear: 12,
        hourlyCost: 50,
      },
    },
  ],
};

export const expectedActivityId = (
  source: Exclude<CapacityInputs["source"], "none">,
  category: CapacityCategory,
) =>
  source === "exact"
    ? PRECISION_ACTIVITY_IDS[category]
    : `banded-${category}-v1`;

const sameActivity = (
  candidate: CapacityActivity,
  canonical: CapacityActivity,
) =>
  candidate.activityId === canonical.activityId &&
  candidate.category === canonical.category &&
  candidate.hoursPerOccurrence === canonical.hoursPerOccurrence &&
  candidate.occurrencesPerYear === canonical.occurrencesPerYear &&
  candidate.hourlyCost === canonical.hourlyCost &&
  (candidate.category === "owner"
    ? candidate.people === undefined && canonical.category === "owner"
    : canonical.category !== "owner" &&
      candidate.people === canonical.people);

export const isKnownBandedActivity = (candidate: CapacityActivity) =>
  BANDED_CAPACITY_OPTIONS[candidate.category].some((option) =>
    sameActivity(candidate, option.activity),
  );

const isPlainObject = (
  value: unknown,
): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const within = (
  value: unknown,
  limits: { min: number; max: number },
  integer = false,
): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= limits.min &&
  value <= limits.max &&
  (!integer || Number.isInteger(value));

const normalizeActivity = (value: unknown): CapacityActivity | null => {
  if (
    !isPlainObject(value) ||
    !Object.keys(value).every((key) =>
      [
        "activityId",
        "category",
        "people",
        "hoursPerOccurrence",
        "occurrencesPerYear",
        "hourlyCost",
      ].includes(key),
    ) ||
    typeof value.activityId !== "string" ||
    !CAPACITY_CATEGORY_ORDER.includes(value.category as CapacityCategory) ||
    !within(
      value.hoursPerOccurrence,
      CAPACITY_LIMITS.hoursPerOccurrence,
    ) ||
    !within(
      value.occurrencesPerYear,
      CAPACITY_LIMITS.occurrencesPerYear,
    ) ||
    !within(value.hourlyCost, CAPACITY_LIMITS.hourlyCost)
  ) {
    return null;
  }

  const base = {
    activityId: value.activityId,
    hoursPerOccurrence: value.hoursPerOccurrence,
    occurrencesPerYear: value.occurrencesPerYear,
    hourlyCost: value.hourlyCost,
  };
  if (value.category === "owner") {
    if (value.people !== undefined && value.people !== 1) return null;
    return {
      ...base,
      category: "owner",
      ...(value.people === 1 ? { people: 1 as const } : {}),
    };
  }
  if (
    (value.category === "reporting" || value.category === "rework") &&
    within(value.people, CAPACITY_LIMITS.people, true)
  ) {
    return {
      ...base,
      category: value.category,
      people: value.people,
    };
  }
  return null;
};

export const normalizeCanonicalCapacity = (
  value: unknown,
): CapacityInputs | null => {
  if (
    !isPlainObject(value) ||
    !Object.keys(value).every((key) =>
      ["source", "activities"].includes(key),
    ) ||
    !["none", "banded", "exact"].includes(String(value.source)) ||
    !Array.isArray(value.activities)
  ) {
    return null;
  }

  const source = value.source as CapacityInputs["source"];
  if (source === "none") {
    return value.activities.length === 0
      ? { source: "none", activities: [] }
      : null;
  }
  if (value.activities.length === 0) return null;

  const activities = value.activities.map(normalizeActivity);
  if (activities.some((activity) => activity === null)) return null;
  const canonical = activities as CapacityActivity[];
  if (
    new Set(canonical.map((activity) => activity.activityId)).size !==
      canonical.length ||
    new Set(canonical.map((activity) => activity.category)).size !==
      canonical.length ||
    canonical.some(
      (activity) =>
        activity.activityId !==
          expectedActivityId(source, activity.category) ||
        (source === "banded" && !isKnownBandedActivity(activity)),
    )
  ) {
    return null;
  }

  return { source, activities: canonical };
};
