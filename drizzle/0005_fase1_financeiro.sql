CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`kind` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`due_date` text NOT NULL,
	`paid_at` text,
	`recurring_monthly` integer DEFAULT false NOT NULL,
	`recurrence_group_id` text
);
--> statement-breakpoint
CREATE TABLE `installments` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`sale_id` text NOT NULL,
	`number` integer NOT NULL,
	`total_installments` integer DEFAULT 1 NOT NULL,
	`amount_cents` integer NOT NULL,
	`due_date` text NOT NULL,
	`paid_at` text,
	`payment_method` text NOT NULL,
	`fee_cents` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `professional_working_hours` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`professional_id` text NOT NULL,
	`weekday` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`break_start` text,
	`break_end` text
);
--> statement-breakpoint
CREATE TABLE `schedule_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`professional_id` text,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`reason` text
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sales` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`patient_id` text NOT NULL,
	`appointment_id` text,
	`professional_id` text,
	`gross_amount_cents` integer DEFAULT 0 NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`total_amount_cents` integer DEFAULT 0 NOT NULL,
	`payment_method` text NOT NULL,
	`status` text DEFAULT 'pendente' NOT NULL,
	`created_by` text
);
--> statement-breakpoint
INSERT INTO `__new_sales`("id", "clinic_id", "created_at", "updated_at", "sync_status", "deleted_at", "patient_id", "appointment_id", "professional_id", "gross_amount_cents", "discount_cents", "total_amount_cents", "payment_method", "status", "created_by") SELECT "id", "clinic_id", "created_at", "updated_at", "sync_status", "deleted_at", "patient_id", "appointment_id", "professional_id", "total_amount_cents", 0, "total_amount_cents", CASE WHEN "payment_method" = 'cartao' THEN 'cartao_credito' ELSE "payment_method" END, "status", "created_by" FROM `sales`;--> statement-breakpoint
DROP TABLE `sales`;--> statement-breakpoint
ALTER TABLE `__new_sales` RENAME TO `sales`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `clinics` ADD `card_fee_debit_percent` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `clinics` ADD `card_fee_credit_percent` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `clinics` ADD `card_fee_credit_installment_percent` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `professionals` ADD `commission_percent` real DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Cobranças antigas viram 1 parcela (paga na data da cobrança, ou pendente).
INSERT INTO `installments`(`id`, `clinic_id`, `created_at`, `updated_at`, `sync_status`, `deleted_at`, `sale_id`, `number`, `total_installments`, `amount_cents`, `due_date`, `paid_at`, `payment_method`, `fee_cents`)
SELECT
  lower(substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-4' || substr(h, 14, 3) || '-a' || substr(h, 18, 3) || '-' || substr(h, 21, 12)),
  clinic_id, created_at, updated_at, 'pending', deleted_at, id, 1, 1, total_amount_cents,
  substr(created_at, 1, 10),
  CASE WHEN status = 'paga' THEN created_at ELSE NULL END,
  payment_method, 0
FROM (SELECT *, hex(randomblob(16)) AS h FROM `sales`);--> statement-breakpoint
UPDATE `sales` SET sync_status = 'pending';--> statement-breakpoint
UPDATE `professionals` SET sync_status = 'pending';
