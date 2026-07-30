CREATE TABLE `retention_cleanup_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`run_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`cutoff_at` text NOT NULL,
	`assessment_records_deleted` integer NOT NULL,
	`assessment_events_deleted` integer NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `assessment_records` ADD `role` text;--> statement-breakpoint
ALTER TABLE `assessment_records` ADD `internal_notification_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `assessment_records` ADD `internal_notification_claimed_at` text;--> statement-breakpoint
ALTER TABLE `assessment_records` ADD `internal_notification_sent_at` text;