CREATE TABLE `anamnesis_records` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`patient_id` text NOT NULL,
	`template_name` text NOT NULL,
	`questions_json` text NOT NULL,
	`answers_json` text NOT NULL,
	`filled_by_name` text NOT NULL,
	`filled_at` text NOT NULL,
	`signed_on_paper_at` text
);
--> statement-breakpoint
CREATE TABLE `anamnesis_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`name` text NOT NULL,
	`questions_json` text NOT NULL
);
