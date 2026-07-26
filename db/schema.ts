import { sql } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const assessmentRecords = sqliteTable("assessment_records", {
  id: text("id").primaryKey(),
  assessmentVersion: text("assessment_version").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  name: text("name"),
  workEmail: text("work_email"),
  company: text("company"),
  phone: text("phone"),
  reportConsent: integer("report_consent", { mode: "boolean" })
    .notNull()
    .default(false),
  marketingConsent: integer("marketing_consent", { mode: "boolean" })
    .notNull()
    .default(false),
  overallScore: integer("overall_score"),
  ownerIndependenceScore: integer("owner_independence_score"),
  operatingSystemScore: integer("operating_system_score"),
  informationVisibilityScore: integer("information_visibility_score"),
  scoreCoverage: real("score_coverage").notNull(),
  scoreConfidence: text("score_confidence").notNull(),
  impactConfidence: text("impact_confidence").notNull(),
  estimateType: text("estimate_type").notNull(),
  capacityInputSource: text("capacity_input_source").notNull().default("none"),
  ownerGrossHours: real("owner_gross_hours").notNull().default(0),
  reportingGrossHours: real("reporting_gross_hours").notNull().default(0),
  reworkGrossHours: real("rework_gross_hours").notNull().default(0),
  realizationFactorLow: real("realization_factor_low"),
  realizationFactorHigh: real("realization_factor_high"),
  recoverableHoursLow: real("recoverable_hours_low"),
  recoverableHoursHigh: real("recoverable_hours_high"),
  annualValueLow: real("annual_value_low"),
  annualValueHigh: real("annual_value_high"),
  findingsJson: text("findings_json").notNull().default("[]"),
  capacityAssumptionCodesJson: text("capacity_assumption_codes_json")
    .notNull()
    .default("[]"),
  capacityExclusionCodesJson: text("capacity_exclusion_codes_json")
    .notNull()
    .default("[]"),
  riskCodesJson: text("risk_codes_json").notNull(),
  priorityIdsJson: text("priority_ids_json").notNull(),
  leadRoute: text("lead_route").notNull(),
  narrativeSource: text("narrative_source").notNull(),
  reportDeliveryStatus: text("report_delivery_status").notNull(),
});
