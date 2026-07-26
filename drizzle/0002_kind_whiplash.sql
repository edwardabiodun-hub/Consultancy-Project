ALTER TABLE `assessment_records` ADD `capacity_input_source` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `assessment_records` ADD `owner_gross_hours` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `assessment_records` ADD `reporting_gross_hours` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `assessment_records` ADD `rework_gross_hours` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `assessment_records` ADD `realization_factor_low` real;--> statement-breakpoint
ALTER TABLE `assessment_records` ADD `realization_factor_high` real;--> statement-breakpoint
ALTER TABLE `assessment_records` ADD `findings_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `assessment_records` ADD `capacity_assumption_codes_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `assessment_records` ADD `capacity_exclusion_codes_json` text DEFAULT '[]' NOT NULL;