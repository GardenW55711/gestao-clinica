CREATE TABLE `patient_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`patient_id` text NOT NULL,
	`text` text NOT NULL,
	`severity` text DEFAULT 'atencao' NOT NULL,
	`origin` text NOT NULL,
	`source_record_id` text,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE `clinics` ADD `address` text;--> statement-breakpoint
ALTER TABLE `clinics` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `clinics` ADD `logo_path` text;--> statement-breakpoint
ALTER TABLE `procedure_types` ADD `scope` text DEFAULT 'nenhum' NOT NULL;--> statement-breakpoint
ALTER TABLE `procedure_types` ADD `odontogram_condition` text;--> statement-breakpoint
ALTER TABLE `professionals` ADD `cro_number` text;--> statement-breakpoint
ALTER TABLE `professionals` ADD `cro_uf` text;--> statement-breakpoint
ALTER TABLE `staff_members` ADD `clinical_access` integer DEFAULT false NOT NULL;