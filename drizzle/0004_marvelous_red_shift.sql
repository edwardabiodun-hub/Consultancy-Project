CREATE TABLE `assessment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text,
	`event_name` text NOT NULL,
	`screen` text,
	`result_category` text,
	`score_confidence` text,
	`impact_confidence` text,
	`route` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
