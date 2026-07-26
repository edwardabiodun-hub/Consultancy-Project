"use client";

import { useState } from "react";
import { PRECISION_ACTIVITY_IDS } from "../../lib/assessment/capacity-contract";
import type {
  CapacityActivity,
  CapacityCategory,
  CapacityInputs,
} from "../../lib/assessment/types";

type PrecisionInputsProps = {
  onBack: () => void;
  onUseEarlierRanges: () => void;
  onSkip: () => void;
  hasEarlierRanges: boolean;
  onComplete: (capacity: CapacityInputs) => void;
  value?: PrecisionDrafts;
  onChange?: (drafts: PrecisionDrafts) => void;
};

export type ActivityDraft = {
  hoursPerOccurrence: string;
  people: string;
  occurrencesPerYear: string;
  hourlyCost: string;
};

export type PrecisionDrafts = Record<CapacityCategory, ActivityDraft>;

type ActivityField = keyof ActivityDraft;

const FIELD_LABELS: Record<ActivityField, string> = {
  people: "People involved",
  hoursPerOccurrence: "Hours per occurrence",
  occurrencesPerYear: "Occurrences per year",
  hourlyCost: "Hourly cost",
};

const fieldsFor = (category: CapacityCategory): ActivityField[] =>
  category === "owner"
    ? ["hoursPerOccurrence", "occurrencesPerYear", "hourlyCost"]
    : ["people", "hoursPerOccurrence", "occurrencesPerYear", "hourlyCost"];

const joinLabels = (labels: string[]) =>
  labels.length < 2
    ? labels[0] ?? ""
    : labels.length === 2
      ? `${labels[0]} and ${labels[1]}`
      : `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;

const EMPTY_DRAFT: ActivityDraft = {
  hoursPerOccurrence: "",
  people: "",
  occurrencesPerYear: "",
  hourlyCost: "",
};

export const createEmptyPrecisionDrafts = (): PrecisionDrafts => ({
  owner: { ...EMPTY_DRAFT },
  reporting: { ...EMPTY_DRAFT },
  rework: { ...EMPTY_DRAFT },
});

const isBlank = (draft: ActivityDraft, category: CapacityCategory) =>
  fieldsFor(category).every((field) => draft[field] === "");

const isComplete = (draft: ActivityDraft, category: CapacityCategory) => {
  const values = fieldsFor(category).map((field) => draft[field]);
  if (values.some((value) => value === "")) return false;

  const numbers = values.map(Number);
  if (numbers.some((value) => !Number.isFinite(value) || value < 0)) return false;
  return (
    category === "owner" ||
    (Number.isInteger(Number(draft.people)) && Number(draft.people) > 0)
  );
};

const validationFor = (draft: ActivityDraft, category: CapacityCategory) => {
  if (isBlank(draft, category)) {
    return { missing: [] as ActivityField[], invalid: [] as ActivityField[] };
  }
  const fields = fieldsFor(category);
  const missing = fields.filter((field) => draft[field] === "");
  const invalid = fields.filter((field) => {
    if (draft[field] === "") return false;
    const number = Number(draft[field]);
    if (!Number.isFinite(number) || number < 0) return true;
    return field === "people" && (!Number.isInteger(number) || number <= 0);
  });
  return { missing, invalid };
};

const toActivity = (
  draft: ActivityDraft,
  category: CapacityCategory,
): CapacityActivity => {
  const base = {
    activityId: PRECISION_ACTIVITY_IDS[category],
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
  invalid = false,
  describedBy,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  integer?: boolean;
  invalid?: boolean;
  describedBy?: string;
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
        aria-invalid={invalid}
        aria-describedby={invalid ? describedBy : undefined}
      />
    </div>
  );
}

function ActivityFields({
  category,
  title,
  draft,
  onChange,
  validation,
  showValidation,
  blankFormError = false,
  children,
}: {
  category: CapacityCategory;
  title: string;
  draft: ActivityDraft;
  onChange: (draft: ActivityDraft) => void;
  validation: ReturnType<typeof validationFor>;
  showValidation: boolean;
  blankFormError?: boolean;
  children?: React.ReactNode;
}) {
  const prefix = `precision-${category}`;
  const invalidFields = [...validation.missing, ...validation.invalid];
  const errorId = `${prefix}-error`;
  const invalid = (field: ActivityField) =>
    (showValidation && invalidFields.includes(field)) ||
    (blankFormError && category === "owner" && field === "hoursPerOccurrence");
  const describedBy = (field: ActivityField) =>
    blankFormError && category === "owner" && field === "hoursPerOccurrence"
      ? "precision-form-error"
      : errorId;
  const missingLabels = validation.missing.map(
    (field) => FIELD_LABELS[field].toLowerCase(),
  );
  const categoryLabel = title;
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
            invalid={invalid("people")}
            describedBy={describedBy("people")}
            onChange={(people) => onChange({ ...draft, people })}
          />
        )}
        <NumericField
          id={`${prefix}-hours`}
          label="Hours per occurrence"
          value={draft.hoursPerOccurrence}
          invalid={invalid("hoursPerOccurrence")}
          describedBy={describedBy("hoursPerOccurrence")}
          onChange={(hoursPerOccurrence) => onChange({ ...draft, hoursPerOccurrence })}
        />
        <NumericField
          id={`${prefix}-frequency`}
          label="Occurrences per year"
          value={draft.occurrencesPerYear}
          invalid={invalid("occurrencesPerYear")}
          describedBy={describedBy("occurrencesPerYear")}
          onChange={(occurrencesPerYear) => onChange({ ...draft, occurrencesPerYear })}
        />
        <NumericField
          id={`${prefix}-cost`}
          label="Hourly cost"
          value={draft.hourlyCost}
          invalid={invalid("hourlyCost")}
          describedBy={describedBy("hourlyCost")}
          onChange={(hourlyCost) => onChange({ ...draft, hourlyCost })}
        />
      </div>
      {showValidation && invalidFields.length > 0 && (
        <p className="assessment-validation" id={errorId} role="alert">
          {missingLabels.length
            ? `${categoryLabel}: ${joinLabels(missingLabels)} ${
                missingLabels.length === 1 ? "is" : "are"
              } required.`
            : `${categoryLabel}: enter valid non-negative values; people must be a whole number greater than zero.`}
        </p>
      )}
      {children}
    </fieldset>
  );
}

export function PrecisionInputs({
  onBack,
  onUseEarlierRanges,
  onSkip,
  hasEarlierRanges,
  onComplete,
  value,
  onChange,
}: PrecisionInputsProps) {
  const [internalDrafts, setInternalDrafts] = useState<PrecisionDrafts>(
    createEmptyPrecisionDrafts,
  );
  const drafts = value ?? internalDrafts;
  const [attempted, setAttempted] = useState(false);
  const categories = Object.keys(drafts) as CapacityCategory[];
  const validations = Object.fromEntries(
    categories.map((category) => [
      category,
      validationFor(drafts[category], category),
    ]),
  ) as Record<CapacityCategory, ReturnType<typeof validationFor>>;
  const completeCategories = categories.filter((category) =>
    isComplete(drafts[category], category),
  );
  const invalidCategories = categories.filter(
    (category) =>
      validations[category].missing.length > 0 ||
      validations[category].invalid.length > 0,
  );
  const blankFormError =
    attempted && completeCategories.length === 0 && invalidCategories.length === 0;

  const update = (category: CapacityCategory, draft: ActivityDraft) => {
    const next = { ...drafts, [category]: draft };
    setInternalDrafts(next);
    onChange?.(next);
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
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setAttempted(true);
          const firstInvalidCategory = invalidCategories[0];
          if (firstInvalidCategory) {
            const firstField = [
              ...validations[firstInvalidCategory].missing,
              ...validations[firstInvalidCategory].invalid,
            ][0];
            const fieldSuffix: Record<ActivityField, string> = {
              people: "people",
              hoursPerOccurrence: "hours",
              occurrencesPerYear: "frequency",
              hourlyCost: "cost",
            };
            document
              .getElementById(
                `precision-${firstInvalidCategory}-${fieldSuffix[firstField]}`,
              )
              ?.focus();
            return;
          }
          if (!completeCategories.length) {
            document.getElementById("precision-owner-hours")?.focus();
            return;
          }
          onComplete({
            source: "exact",
            activities: completeCategories.map((category) =>
              toActivity(drafts[category], category),
            ),
          });
        }}
      >
        {blankFormError && (
          <p className="assessment-validation" id="precision-form-error" role="alert">
            At least one complete category is required to calculate with exact inputs.
          </p>
        )}
        <ActivityFields
          category="owner"
          title="Owner intervention"
          draft={drafts.owner}
          onChange={(draft) => update("owner", draft)}
          validation={validations.owner}
          showValidation={attempted}
          blankFormError={blankFormError}
        />
        <ActivityFields
          category="reporting"
          title="Team reporting and reconciliation"
          draft={drafts.reporting}
          onChange={(draft) => update("reporting", draft)}
          validation={validations.reporting}
          showValidation={attempted}
        />
        <ActivityFields
          category="rework"
          title="Rework"
          draft={drafts.rework}
          onChange={(draft) => update("rework", draft)}
          validation={validations.rework}
          showValidation={attempted}
        >
          <p className="assessment-exclusion-note">
            Time spent correcting a report is counted as rework only when it is excluded from
            report-preparation time. Assign each activity to one category only.
          </p>
        </ActivityFields>

        <div className="assessment-actions assessment-actions-stack">
          <button className="button" type="submit">
            Calculate with exact inputs
          </button>
          {hasEarlierRanges && (
            <button className="assessment-back" type="button" onClick={onUseEarlierRanges}>
              Use my earlier ranges
            </button>
          )}
          <button className="assessment-back" type="button" onClick={onSkip}>
            {hasEarlierRanges
              ? "Skip financial estimate"
              : "Continue without a financial range"}
          </button>
          <button className="assessment-back" type="button" onClick={onBack}>
            Back
          </button>
        </div>
      </form>
    </>
  );
}
