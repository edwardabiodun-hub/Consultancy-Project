import type {
  CapacityActivity,
  CapacityCategory,
  CapacityInputs,
} from "../../lib/assessment/types";

type BandOption = {
  value: string;
  label: string;
  activity: CapacityActivity;
};

const BAND_OPTIONS: Record<CapacityCategory, BandOption[]> = {
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

const CATEGORY_ORDER: CapacityCategory[] = ["owner", "reporting", "rework"];

export function BandedCapacityInputs({
  value,
  onChange,
}: {
  value: CapacityInputs;
  onChange: (capacity: CapacityInputs) => void;
}) {
  const selectedValue = (category: CapacityCategory) => {
    const activity = value.activities.find(
      (activity) => activity.category === category,
    );
    if (!activity) return "";
    return (
      BAND_OPTIONS[category].find(
        (option) =>
          option.activity.activityId === activity.activityId &&
          option.activity.hoursPerOccurrence === activity.hoursPerOccurrence &&
          option.activity.occurrencesPerYear === activity.occurrencesPerYear &&
          option.activity.hourlyCost === activity.hourlyCost &&
          (option.activity.category === "owner"
            ? activity.category === "owner"
            : activity.category !== "owner" &&
              option.activity.people === activity.people),
      )?.value ?? ""
    );
  };

  const update = (category: CapacityCategory, optionValue: string) => {
    const selected = BAND_OPTIONS[category].find(
      (option) => option.value === optionValue,
    );
    const byCategory = new Map(
      value.activities.map((activity) => [activity.category, activity]),
    );
    if (selected) byCategory.set(category, selected.activity);
    else byCategory.delete(category);
    const activities = CATEGORY_ORDER.flatMap((item) => {
      const activity = byCategory.get(item);
      return activity ? [activity] : [];
    });
    onChange({
      source: activities.length ? "banded" : "none",
      activities,
    });
  };

  return (
    <section className="assessment-banded" aria-labelledby="banded-capacity-heading">
      <h2 id="banded-capacity-heading">Optional capacity ranges</h2>
      <p>
        Select only ranges that reflect your current experience. Calculations use the midpoint of
        each selected self-reported band as a disclosed derived assumption—not an external
        benchmark.
      </p>
      <div className="assessment-context-grid">
        {(
          [
            ["owner", "Owner intervention range"],
            ["reporting", "Team reporting and reconciliation range"],
            ["rework", "Rework range"],
          ] as [CapacityCategory, string][]
        ).map(([category, label]) => (
          <div className="assessment-field" key={category}>
            <label htmlFor={`banded-${category}`}>{label}</label>
            <select
              id={`banded-${category}`}
              value={selectedValue(category)}
              onChange={(event) => update(category, event.target.value)}
            >
              <option value="">No range selected</option>
              {BAND_OPTIONS[category].map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <p className="assessment-exclusion-note">
        Reporting correction time belongs in reporting or rework, never both. At least two
        complete categories are required for a directional financial range.
      </p>
    </section>
  );
}
