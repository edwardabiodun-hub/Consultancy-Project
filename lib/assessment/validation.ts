import { QUESTION_BANK } from "./questions";
import {
  CAPACITY_CATEGORY_ORDER,
  CAPACITY_LIMITS,
  expectedActivityId,
  isKnownBandedActivity,
} from "./capacity-contract";
import type {
  AnswerValue,
  AssessmentAnswers,
  CapacityActivity,
  CapacityCategory,
} from "./types";

export { CAPACITY_LIMITS as LIMITS } from "./capacity-contract";

export type AssessmentLead = {
  name: string;
  workEmail: string;
  company: string;
  phone?: string;
  reportConsent: true;
  marketingConsent: boolean;
};

type ValidationFailure = {
  ok: false;
  errors: Record<string, string>;
};

type ValidationSuccess = {
  ok: true;
  answers: AssessmentAnswers;
  lead?: AssessmentLead;
};

export type AssessmentPayloadParseResult =
  | ValidationFailure
  | ValidationSuccess;

const EMPLOYEE_BANDS = [
  "1-4",
  "5-9",
  "10-19",
  "20-49",
  "50-99",
  "100+",
] as const;
const MANAGER_BANDS = ["0", "1-2", "3-5", "6-10", "11+"] as const;
const REVENUE_BANDS = [
  "under-1m",
  "1m-5m",
  "5m-20m",
  "20m-50m",
  "50m+",
  "prefer-not",
] as const;
const ROLES = [
  "Founder or co-founder",
  "Owner-operator",
  "Chief executive",
  "Senior leader",
  "Advisor",
] as const;
const CORE_SYSTEM_COUNTS = ["one", "twoOrMore"] as const;
const ORGANIZATION_SHAPES = ["singleTeam", "multipleTeams"] as const;
const CAPACITY_SOURCES = ["none", "banded", "exact"] as const;
const CAPACITY_CATEGORIES = CAPACITY_CATEGORY_ORDER;
const SCORE_VALUES: AnswerValue[] = [
  0,
  25,
  50,
  75,
  100,
  "unknown",
  "notApplicable",
];
const QUESTION_IDS = new Set(QUESTION_BANK.map((question) => question.id));
const ANSWER_FIELDS = new Set([
  "employeeBand",
  "managerBand",
  "revenueBand",
  "role",
  "coreSystemCount",
  "organizationShape",
  "relationshipLedByOwner",
  "restrictedMarket",
  "scored",
  "capacity",
]);
const LEAD_FIELDS = new Set([
  "name",
  "workEmail",
  "company",
  "phone",
  "reportConsent",
  "marketingConsent",
]);
const ACTIVITY_FIELDS = new Set([
  "activityId",
  "category",
  "people",
  "hoursPerOccurrence",
  "occurrencesPerYear",
  "hourlyCost",
]);
const INPUT_FIELDS = new Set(["answers", "lead"]);
const IGNORED_RESULT_FIELDS = new Set([
  "overall",
  "components",
  "riskCodes",
  "route",
  "result",
  "financialOutputs",
  "annualValue",
  "recoverableHours",
  "grossHours",
  "estimateType",
]);

const isPlainObject = (
  value: unknown,
): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const isOneOf = <Value extends string>(
  value: unknown,
  allowed: readonly Value[],
): value is Value =>
  typeof value === "string" && allowed.includes(value as Value);

const addUnknownFieldErrors = (
  value: Record<string, unknown>,
  allowed: Set<string>,
  prefix: string,
  errors: Record<string, string>,
) => {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors[`${prefix}${key}`] = "This field is not accepted.";
    }
  }
};

const validateEnum = <Value extends string>(
  value: unknown,
  allowed: readonly Value[],
  path: string,
  errors: Record<string, string>,
): value is Value => {
  if (isOneOf(value, allowed)) return true;
  errors[path] = "Select a supported value.";
  return false;
};

const validateBoolean = (
  value: unknown,
  path: string,
  errors: Record<string, string>,
): value is boolean => {
  if (typeof value === "boolean") return true;
  errors[path] = "Enter true or false.";
  return false;
};

const validateBoundedNumber = (
  value: unknown,
  limit: { min: number; max: number },
  path: string,
  errors: Record<string, string>,
  integer = false,
): value is number => {
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= limit.min &&
    value <= limit.max &&
    (!integer || Number.isInteger(value))
  ) {
    return true;
  }
  errors[path] = `Enter a ${integer ? "whole " : ""}number from ${limit.min} to ${limit.max}.`;
  return false;
};

const parseCapacity = (
  value: unknown,
  errors: Record<string, string>,
): AssessmentAnswers["capacity"] | null => {
  const path = "answers.capacity";
  if (!isPlainObject(value)) {
    errors[path] = "Enter a valid capacity object.";
    return null;
  }
  addUnknownFieldErrors(
    value,
    new Set(["source", "activities"]),
    `${path}.`,
    errors,
  );

  const sourceValid = validateEnum(
    value.source,
    CAPACITY_SOURCES,
    `${path}.source`,
    errors,
  );
  const source = sourceValid
    ? (value.source as AssessmentAnswers["capacity"]["source"])
    : null;
  if (!Array.isArray(value.activities)) {
    errors[`${path}.activities`] = "Enter a valid activity list.";
    return null;
  }

  const activities: CapacityActivity[] = [];
  const categories = new Set<CapacityCategory>();
  const activityIds = new Set<string>();

  value.activities.forEach((activity, index) => {
    const activityPath = `${path}.activities.${index}`;
    if (!isPlainObject(activity)) {
      errors[activityPath] = "Enter a valid activity.";
      return;
    }
    addUnknownFieldErrors(
      activity,
      ACTIVITY_FIELDS,
      `${activityPath}.`,
      errors,
    );

    const activityId =
      typeof activity.activityId === "string" &&
      activity.activityId.trim().length > 0 &&
      activity.activityId.length <= 100
        ? activity.activityId
        : null;
    let activityIdValid = activityId !== null;
    if (activityId === null) {
      errors[`${activityPath}.activityId`] =
        "Enter an activity ID from 1 to 100 characters.";
    } else if (activityIds.has(activityId)) {
      errors[`${activityPath}.activityId`] = "Activity IDs must be unique.";
    } else {
      activityIds.add(activityId);
    }

    const categoryValid = validateEnum(
      activity.category,
      CAPACITY_CATEGORIES,
      `${activityPath}.category`,
      errors,
    );
    const category = categoryValid
      ? (activity.category as CapacityCategory)
      : null;
    if (
      activityId &&
      category &&
      source &&
      source !== "none" &&
      activityId !== expectedActivityId(source, category)
    ) {
      errors[`${activityPath}.activityId`] =
        "Activity ID must match its source and category.";
      activityIdValid = false;
    }
    if (category) {
      if (categories.has(category)) {
        errors[`${activityPath}.category`] =
          "Each capacity category may be entered only once.";
      } else {
        categories.add(category);
      }
    }

    const hoursValid = validateBoundedNumber(
      activity.hoursPerOccurrence,
      CAPACITY_LIMITS.hoursPerOccurrence,
      `${activityPath}.hoursPerOccurrence`,
      errors,
    );
    const occurrencesValid = validateBoundedNumber(
      activity.occurrencesPerYear,
      CAPACITY_LIMITS.occurrencesPerYear,
      `${activityPath}.occurrencesPerYear`,
      errors,
    );
    const costValid = validateBoundedNumber(
      activity.hourlyCost,
      CAPACITY_LIMITS.hourlyCost,
      `${activityPath}.hourlyCost`,
      errors,
    );

    let peopleValid = true;
    if (category === "owner") {
      peopleValid = activity.people === undefined || activity.people === 1;
      if (!peopleValid) {
        errors[`${activityPath}.people`] =
          "Owner activities may include only one owner.";
      }
    } else if (
      category === "reporting" ||
      category === "rework"
    ) {
      peopleValid = validateBoundedNumber(
        activity.people,
        CAPACITY_LIMITS.people,
        `${activityPath}.people`,
        errors,
        true,
      );
    }

    if (
      activityIdValid &&
      categoryValid &&
      hoursValid &&
      occurrencesValid &&
      costValid &&
      peopleValid &&
      activityId &&
      category
    ) {
      const base = {
        activityId,
        hoursPerOccurrence: activity.hoursPerOccurrence as number,
        occurrencesPerYear: activity.occurrencesPerYear as number,
        hourlyCost: activity.hourlyCost as number,
      };
      const candidate: CapacityActivity =
        category === "owner"
          ? {
              ...base,
              category: "owner",
              ...(activity.people === 1 ? { people: 1 as const } : {}),
            }
          : {
              ...base,
              category,
              people: activity.people as number,
            };
      if (source === "banded" && !isKnownBandedActivity(candidate)) {
        errors[activityPath] =
          "Banded activity values must match a disclosed capacity range.";
      } else {
        activities.push(candidate);
      }
    }
  });

  if (sourceValid) {
    if (value.source === "none" && value.activities.length > 0) {
      errors[`${path}.activities`] =
        "Capacity source none cannot include activities.";
    }
    if (value.source !== "none" && value.activities.length === 0) {
      errors[`${path}.activities`] =
        "Banded or exact capacity requires at least one activity.";
    }
  }

  return source
    ? {
        source,
        activities,
      }
    : null;
};

const parseLead = (
  value: unknown,
  errors: Record<string, string>,
): AssessmentLead | undefined => {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) {
    errors.lead = "Enter valid report contact details.";
    return undefined;
  }
  addUnknownFieldErrors(value, LEAD_FIELDS, "lead.", errors);

  const requiredText = (field: "name" | "company") => {
    const candidate = value[field];
    if (
      typeof candidate !== "string" ||
      candidate.trim().length === 0 ||
      candidate.length > 200
    ) {
      errors[`lead.${field}`] = "This field is required.";
      return "";
    }
    return candidate.trim();
  };
  const name = requiredText("name");
  const company = requiredText("company");
  const workEmail =
    typeof value.workEmail === "string" ? value.workEmail.trim() : "";
  if (
    workEmail.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail)
  ) {
    errors["lead.workEmail"] = "Enter a valid work email.";
  }

  let phone: string | undefined;
  if (value.phone !== undefined) {
    if (typeof value.phone !== "string" || value.phone.length > 50) {
      errors["lead.phone"] = "Enter a valid phone number.";
    } else {
      phone = value.phone.trim() || undefined;
    }
  }
  if (value.reportConsent !== true) {
    errors["lead.reportConsent"] =
      "Report consent is required when contact details are provided.";
  }
  const marketingConsentValid = validateBoolean(
    value.marketingConsent,
    "lead.marketingConsent",
    errors,
  );

  return {
    name,
    workEmail,
    company,
    ...(phone ? { phone } : {}),
    reportConsent: true,
    marketingConsent: marketingConsentValid
      ? (value.marketingConsent as boolean)
      : false,
  };
};

export function parseAssessmentPayload(
  input: unknown,
): AssessmentPayloadParseResult {
  const errors = Object.create(null) as Record<string, string>;
  if (!isPlainObject(input)) {
    errors.form = "Enter a valid JSON assessment payload.";
    return { ok: false, errors };
  }

  for (const key of Object.keys(input)) {
    if (!INPUT_FIELDS.has(key) && !IGNORED_RESULT_FIELDS.has(key)) {
      errors[key] = "This field is not accepted.";
    }
  }

  if (!isPlainObject(input.answers)) {
    errors.answers = "Enter valid assessment answers.";
    return { ok: false, errors };
  }
  const rawAnswers = input.answers;
  addUnknownFieldErrors(rawAnswers, ANSWER_FIELDS, "answers.", errors);

  const employeeBandValid = validateEnum(
    rawAnswers.employeeBand,
    EMPLOYEE_BANDS,
    "answers.employeeBand",
    errors,
  );
  const managerBandValid = validateEnum(
    rawAnswers.managerBand,
    MANAGER_BANDS,
    "answers.managerBand",
    errors,
  );
  const revenueBandValid = validateEnum(
    rawAnswers.revenueBand,
    REVENUE_BANDS,
    "answers.revenueBand",
    errors,
  );
  const roleValid = validateEnum(
    rawAnswers.role,
    ROLES,
    "answers.role",
    errors,
  );
  const coreSystemCountValid = validateEnum(
    rawAnswers.coreSystemCount,
    CORE_SYSTEM_COUNTS,
    "answers.coreSystemCount",
    errors,
  );
  const organizationShapeValid = validateEnum(
    rawAnswers.organizationShape,
    ORGANIZATION_SHAPES,
    "answers.organizationShape",
    errors,
  );
  const relationshipLedByOwnerValid = validateBoolean(
    rawAnswers.relationshipLedByOwner,
    "answers.relationshipLedByOwner",
    errors,
  );
  const restrictedMarketValid = validateBoolean(
    rawAnswers.restrictedMarket,
    "answers.restrictedMarket",
    errors,
  );

  const scored: AssessmentAnswers["scored"] = {};
  if (!isPlainObject(rawAnswers.scored)) {
    errors["answers.scored"] = "Enter a valid scored-answer object.";
  } else {
    for (const [questionId, answer] of Object.entries(rawAnswers.scored)) {
      const path = `answers.scored.${questionId}`;
      if (!QUESTION_IDS.has(questionId)) {
        errors[path] = "This scored question is not recognized.";
      } else if (!SCORE_VALUES.includes(answer as AnswerValue)) {
        errors[path] = "Select a supported answer value.";
      } else {
        scored[questionId] = answer as AnswerValue;
      }
    }
  }

  const capacity = parseCapacity(rawAnswers.capacity, errors);
  const lead = parseLead(input.lead, errors);

  if (
    !employeeBandValid ||
    !managerBandValid ||
    !revenueBandValid ||
    !roleValid ||
    !coreSystemCountValid ||
    !organizationShapeValid ||
    !relationshipLedByOwnerValid ||
    !restrictedMarketValid ||
    !capacity ||
    Object.keys(errors).length > 0
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    answers: {
      employeeBand: rawAnswers.employeeBand as AssessmentAnswers["employeeBand"],
      managerBand: rawAnswers.managerBand as AssessmentAnswers["managerBand"],
      revenueBand: rawAnswers.revenueBand as AssessmentAnswers["revenueBand"],
      role: rawAnswers.role as AssessmentAnswers["role"],
      coreSystemCount:
        rawAnswers.coreSystemCount as AssessmentAnswers["coreSystemCount"],
      organizationShape:
        rawAnswers.organizationShape as AssessmentAnswers["organizationShape"],
      relationshipLedByOwner:
        rawAnswers.relationshipLedByOwner as boolean,
      restrictedMarket: rawAnswers.restrictedMarket as boolean,
      scored,
      capacity,
    },
    ...(lead ? { lead } : {}),
  };
}
