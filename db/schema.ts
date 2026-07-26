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
  recoverableHoursLow: real("recoverable_hours_low"),
  recoverableHoursHigh: real("recoverable_hours_high"),
  annualValueLow: real("annual_value_low"),
  annualValueHigh: real("annual_value_high"),
  riskCodesJson: text("risk_codes_json").notNull(),
  priorityIdsJson: text("priority_ids_json").notNull(),
  leadRoute: text("lead_route").notNull(),
  narrativeSource: text("narrative_source").notNull(),
  reportDeliveryStatus: text("report_delivery_status").notNull(),
});
