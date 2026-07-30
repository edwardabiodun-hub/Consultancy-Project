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
  role: text("role"),
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
  grossCapacityValue: real("gross_capacity_value"),
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
  narrativeAttemptStatus: text("narrative_attempt_status")
    .notNull()
    .default("pending"),
  narrativeAttemptedAt: text("narrative_attempted_at"),
  narrativeSelectionJson: text("narrative_selection_json"),
  reportDeliveryStatus: text("report_delivery_status").notNull(),
  internalNotificationStatus: text("internal_notification_status")
    .notNull()
    .default("pending"),
  internalNotificationClaimedAt: text("internal_notification_claimed_at"),
  internalNotificationFirstAttemptAt: text("internal_notification_first_attempt_at"),
  internalNotificationSentAt: text("internal_notification_sent_at"),
  internalNotificationPayloadHash: text("internal_notification_payload_hash"),
});

// Privacy-conscious product analytics for the assessment funnel. Only an
// allowlisted event name plus coarse, non-identifying context is stored - no
// IP address, user agent, raw answers, or contact details (see
// lib/analytics/assessment.ts, which is the only writer of these rows).
export const assessmentEvents = sqliteTable("assessment_events", {
  id: text("id").primaryKey(),
  assessmentId: text("assessment_id"),
  eventName: text("event_name").notNull(),
  screen: text("screen"),
  resultCategory: text("result_category"),
  scoreConfidence: text("score_confidence"),
  impactConfidence: text("impact_confidence"),
  route: text("route"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const retentionCleanupRuns = sqliteTable("retention_cleanup_runs", {
  id: text("id").primaryKey(),
  runAt: text("run_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  cutoffAt: text("cutoff_at").notNull(),
  assessmentRecordsDeleted: integer("assessment_records_deleted").notNull(),
  assessmentEventsDeleted: integer("assessment_events_deleted").notNull(),
  status: text("status").notNull(),
});