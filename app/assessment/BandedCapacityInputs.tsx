import {
  BANDED_CAPACITY_OPTIONS,
  CAPACITY_CATEGORY_ORDER,
} from "../../lib/assessment/capacity-contract";
import type {
  CapacityCategory,
  CapacityInputs,
} from "../../lib/assessment/types";

export function BandedCapacityInputs({
  value,
  onChange,
}: {
  value: CapacityInputs;
  onChange: (capacity: CapacityInputs) => void;
}) {
  const selectedValue = (category: CapacityCategory) => {
    const activity = value.activities.find(
      (candidate) => candidate.category === category,
    );
    if (!activity) return "";
    return (
      BANDED_CAPACITY_OPTIONS[category].find(
        (option) =>
          option.activity.activityId === activity.activityId &&
          option.activity.hoursPerOccurrence ===
            activity.hoursPerOccurrence &&
          option.activity.occurrencesPerYear ===
            activity.occurrencesPerYear &&
          option.activity.hourlyCost === activity.hourlyCost &&
          (option.activity.category === "owner"
            ? activity.category === "owner"
            : activity.category !== "owner" &&
              option.activity.people === activity.people),
      )?.value ?? ""
    );
  };

  const update = (category: CapacityCategory, optionValue: string) => {
    const selected = BANDED_CAPACITY_OPTIONS[category].find(
      (option) => option.value === optionValue,
    );
    const byCategory = new Map(
      value.activities.map((activity) => [activity.category, activity]),
    );
    if (selected) byCategory.set(category, selected.activity);
    else byCategory.delete(category);
    const activities = CAPACITY_CATEGORY_ORDER.flatMap((item) => {
      const activity = byCategory.get(item);
      return activity ? [activity] : [];
    });
    onChange({
      source: activities.length ? "banded" : "none",
      activities,
    });
  };

  return (
    <section
      className="assessment-banded"
      aria-labelledby="banded-capacity-heading"
    >
      <h2 id="banded-capacity-heading">Optional capacity ranges</h2>
      <p>
        Select only ranges that reflect your current experience. Calculations
        use the midpoint of each selected self-reported band as a disclosed
        derived assumption—not an external benchmark.
      </p>
      <div className="assessment-context-grid">
        {(
          [
            ["owner", "Owner intervention range"],
            [
              "reporting",
              "Team reporting and reconciliation range",
            ],
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
              {BANDED_CAPACITY_OPTIONS[category].map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <p className="assessment-exclusion-note">
        Reporting correction time belongs in reporting or rework, never both.
        At least two complete categories are required for a directional
        financial range.
      </p>
    </section>
  );
}
