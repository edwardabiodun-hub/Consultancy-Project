"use client";

import { useState } from "react";
import type {
  CapacityActivity,
  CapacityCategory,
  CapacityInputs,
} from "../../lib/assessment/types";

type PrecisionInputsProps = {
  onBack: () => void;
  onUseEarlierRanges: () => void;
  onSkip: () => void;
  onComplete: (capacity: CapacityInputs) => void;
};

type ActivityDraft = {
  hoursPerOccurrence: string;
  people: string;
  occurrencesPerYear: string;
  hourlyCost: string;
};

const EMPTY_DRAFT: ActivityDraft = {
  hoursPerOccurrence: "",
  people: "",
  occurrencesPerYear: "",
  hourlyCost: "",
};

const IDS: Record<CapacityCategory, string> = {
  owner: "precision-owner-v1",
  reporting: "precision-reporting-v1",
  rework: "precision-rework-v1",
};

const isBlank = (draft: ActivityDraft, category: CapacityCategory) =>
  [
    draft.hoursPerOccurrence,
    draft.occurrencesPerYear,
    draft.hourlyCost,
    ...(category === "owner" ? [] : [draft.people]),
  ].every((value) => value === "");

const isComplete = (draft: ActivityDraft, category: CapacityCategory) => {
  const values = [
    draft.hoursPerOccurrence,
    draft.occurrencesPerYear,
    draft.hourlyCost,
  ];
  if (category !== "owner") values.push(draft.people);
  if (values.some((value) => value === "")) return false;

  const numbers = values.map(Number);
  if (numbers.some((value) => !Number.isFinite(value) || value < 0)) return false;
  return (
    category === "owner" ||
    (Number.isInteger(Number(draft.people)) && Number(draft.people) > 0)
  );
};

const toActivity = (
  draft: ActivityDraft,
  category: CapacityCategory,
): CapacityActivity => {
  const base = {
    activityId: IDS[category],
    category,
    hoursPerOccurrence: Number(draft.hoursPerOccurrence),
    occurrencesPerYear: Number(draft.occurrencesPerYear),
    hourlyCost: Number(draft.hourlyCost),
  };
  return category === "owner"
    ? base
    : { ...base, category, people: Number(draft.people) };
};

function NumericField({
  id,
  label,
  value,
  integer = false,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  integer?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="assessment-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min={integer ? 1 : 0}
        step={integer ? 1 : "any"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function ActivityFields({
  category,
  title,
  draft,
  onChange,
  children,
}: {
  category: CapacityCategory;
  title: string;
  draft: ActivityDraft;
  onChange: (draft: ActivityDraft) => void;
  children?: React.ReactNode;
}) {
  const prefix = `precision-${category}`;
  return (
    <fieldset className="assessment-precision-group">
      <legend>{title}</legend>
      <div className="assessment-precision-grid">
        {category !== "owner" && (
          <NumericField
            id={`${prefix}-people`}
            label="People involved"
            value={draft.people}
            integer
            onChange={(people) => onChange({ ...draft, people })}
          />
        )}
        <NumericField
          id={`${prefix}-hours`}
          label="Hours per occurrence"
          value={draft.hoursPerOccurrence}
          onChange={(hoursPerOccurrence) => onChange({ ...draft, hoursPerOccurrence })}
        />
        <NumericField
          id={`${prefix}-frequency`}
          label="Occurrences per year"
          value={draft.occurrencesPerYear}
          onChange={(occurrencesPerYear) => onChange({ ...draft, occurrencesPerYear })}
        />
        <NumericField
          id={`${prefix}-cost`}
          label="Hourly cost"
          value={draft.hourlyCost}
          onChange={(hourlyCost) => onChange({ ...draft, hourlyCost })}
        />
      </div>
      {children}
    </fieldset>
  );
}

export function PrecisionInputs({
  onBack,
  onUseEarlierRanges,
  onSkip,
  onComplete,
}: PrecisionInputsProps) {
  const [drafts, setDrafts] = useState<Record<CapacityCategory, ActivityDraft>>({
    owner: { ...EMPTY_DRAFT },
    reporting: { ...EMPTY_DRAFT },
    rework: { ...EMPTY_DRAFT },
  });
  const categories = Object.keys(drafts) as CapacityCategory[];
  const partialCategory = categories.some(
    (category) => !isBlank(drafts[category], category) && !isComplete(drafts[category], category),
  );
  const completeCategories = categories.filter((category) =>
    isComplete(drafts[category], category),
  );
  const canCalculate = !partialCategory && completeCategories.length > 0;

  const update = (category: CapacityCategory, draft: ActivityDraft) => {
    setDrafts((current) => ({ ...current, [category]: draft }));
  };

  return (
    <>
      <div className="assessment-kicker">Optional precision</div>
      <h1>Improve the capacity estimate.</h1>
      <p className="assessment-intro">
        Exact time, frequency, people, and labor-cost inputs can raise impact confidence. Leave an
        entire category blank to exclude it.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!canCalculate) return;
          onComplete({
            source: "exact",
            activities: completeCategories.map((category) =>
              toActivity(drafts[category], category),
            ),
          });
        }}
      >
        <ActivityFields
          category="owner"
          title="Owner intervention"
          draft={drafts.owner}
          onChange={(draft) => update("owner", draft)}
        />
        <ActivityFields
          category="reporting"
          title="Team reporting and reconciliation"
          draft={drafts.reporting}
          onChange={(draft) => update("reporting", draft)}
        />
        <ActivityFields
          category="rework"
          title="Rework"
          draft={drafts.rework}
          onChange={(draft) => update("rework", draft)}
        >
          <p className="assessment-exclusion-note">
            Time spent correcting a report is counted as rework only when it is excluded from
            report-preparation time. Assign each activity to one category only.
          </p>
        </ActivityFields>

        {partialCategory && (
          <p className="assessment-validation" role="status">
            Complete every field in a category or clear the category before calculating.
          </p>
        )}

        <div className="assessment-actions assessment-actions-stack">
          <button className="button" type="submit" disabled={!canCalculate}>
            Calculate with exact inputs
          </button>
          <button className="assessment-back" type="button" onClick={onUseEarlierRanges}>
            Use my earlier ranges
          </button>
          <button className="assessment-back" type="button" onClick={onSkip}>
            Skip financial estimate
          </button>
          <button className="assessment-back" type="button" onClick={onBack}>
            Back
          </button>
        </div>
      </form>
    </>
  );
}
