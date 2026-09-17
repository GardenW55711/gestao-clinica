CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`patient_id` text NOT NULL,
	`professional_id` text NOT NULL,
	`room_id` text,
	`procedure_type_id` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`source` text DEFAULT 'staff' NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`staff_member_id` text,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`at` text NOT NULL,
	`details` text
);
--> statement-breakpoint
CREATE TABLE `booking_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`patient_name` text NOT NULL,
	`patient_phone` text NOT NULL,
	`procedure_type_id` text,
	`desired_start_at` text NOT NULL,
	`status` text DEFAULT 'pending_review' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clinics` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`cnpj` text,
	`owner_email` text NOT NULL,
	`self_booking_enabled` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inventory_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`item_id` text NOT NULL,
	`batch_code` text,
	`quantity` real NOT NULL,
	`expiry_date` text,
	`received_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`name` text NOT NULL,
	`category` text,
	`unit` text NOT NULL,
	`min_quantity` real DEFAULT 0 NOT NULL,
	`unit_cost` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inventory_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`item_id` text NOT NULL,
	`batch_id` text,
	`type` text NOT NULL,
	`quantity` real NOT NULL,
	`reason` text,
	`related_sale_id` text,
	`created_by` text
);
--> statement-breakpoint
CREATE TABLE `patients` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`birth_date` text,
	`cpf` text,
	`notes` text,
	`lgpd_consent_at` text
);
--> statement-breakpoint
CREATE TABLE `procedure_types` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`name` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`default_price` real DEFAULT 0 NOT NULL,
	`requires_room` integer DEFAULT false NOT NULL,
	`bookable_online` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `professionals` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`staff_member_id` text,
	`name` text NOT NULL,
	`specialty` text,
	`color` text,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`name` text NOT NULL,
	`description` text,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`sale_id` text NOT NULL,
	`description` text NOT NULL,
	`kind` text NOT NULL,
	`procedure_type_id` text,
	`inventory_item_id` text,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit_price` real DEFAULT 0 NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`patient_id` text NOT NULL,
	`appointment_id` text,
	`professional_id` text,
	`total_amount` real DEFAULT 0 NOT NULL,
	`payment_method` text NOT NULL,
	`status` text DEFAULT 'paga' NOT NULL,
	`created_by` text
);
--> statement-breakpoint
CREATE TABLE `staff_members` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`pin_hash` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
