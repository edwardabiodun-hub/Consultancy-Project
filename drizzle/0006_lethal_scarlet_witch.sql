ALTER TABLE `assessment_records` ADD `narrative_attempt_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `assessment_records` ADD `narrative_attempted_at` text;--> statement-breakpoint
ALTER TABLE `assessment_records` ADD `internal_notification_first_attempt_at` text;--> statement-breakpoint
ALTER TABLE `assessment_records` ADD `internal_notification_payload_hash` text;--> statement-breakpoint
UPDATE assessment_records
SET narrative_attempt_status = 'attempted',
    narrative_attempted_at = COALESCE(created_at, CURRENT_TIMESTAMP);--> statement-breakpoint
UPDATE assessment_records SET findings_json = '[]';