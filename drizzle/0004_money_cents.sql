PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_inventory_items` (
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
	`unit_cost_cents` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_inventory_items`("id", "clinic_id", "created_at", "updated_at", "sync_status", "deleted_at", "name", "category", "unit", "min_quantity", "unit_cost_cents") SELECT "id", "clinic_id", "created_at", "updated_at", "sync_status", "deleted_at", "name", "category", "unit", "min_quantity", CAST(ROUND(COALESCE("unit_cost", 0) * 100) AS integer) FROM `inventory_items`;--> statement-breakpoint
DROP TABLE `inventory_items`;--> statement-breakpoint
ALTER TABLE `__new_inventory_items` RENAME TO `inventory_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_procedure_types` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`name` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`default_price_cents` integer DEFAULT 0 NOT NULL,
	`requires_room` integer DEFAULT false NOT NULL,
	`bookable_online` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_procedure_types`("id", "clinic_id", "created_at", "updated_at", "sync_status", "deleted_at", "name", "duration_minutes", "default_price_cents", "requires_room", "bookable_online", "active") SELECT "id", "clinic_id", "created_at", "updated_at", "sync_status", "deleted_at", "name", "duration_minutes", CAST(ROUND(COALESCE("default_price", 0) * 100) AS integer), "requires_room", "bookable_online", "active" FROM `procedure_types`;--> statement-breakpoint
DROP TABLE `procedure_types`;--> statement-breakpoint
ALTER TABLE `__new_procedure_types` RENAME TO `procedure_types`;--> statement-breakpoint
CREATE TABLE `__new_sale_items` (
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
	`unit_price_cents` integer DEFAULT 0 NOT NULL,
	`subtotal_cents` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_sale_items`("id", "clinic_id", "created_at", "updated_at", "sync_status", "deleted_at", "sale_id", "description", "kind", "procedure_type_id", "inventory_item_id", "quantity", "unit_price_cents", "subtotal_cents") SELECT "id", "clinic_id", "created_at", "updated_at", "sync_status", "deleted_at", "sale_id", "description", "kind", "procedure_type_id", "inventory_item_id", "quantity", CAST(ROUND(COALESCE("unit_price", 0) * 100) AS integer), CAST(ROUND(COALESCE("subtotal", 0) * 100) AS integer) FROM `sale_items`;--> statement-breakpoint
DROP TABLE `sale_items`;--> statement-breakpoint
ALTER TABLE `__new_sale_items` RENAME TO `sale_items`;--> statement-breakpoint
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
	`total_amount_cents` integer DEFAULT 0 NOT NULL,
	`payment_method` text NOT NULL,
	`status` text DEFAULT 'paga' NOT NULL,
	`created_by` text
);
--> statement-breakpoint
INSERT INTO `__new_sales`("id", "clinic_id", "created_at", "updated_at", "sync_status", "deleted_at", "patient_id", "appointment_id", "professional_id", "total_amount_cents", "payment_method", "status", "created_by") SELECT "id", "clinic_id", "created_at", "updated_at", "sync_status", "deleted_at", "patient_id", "appointment_id", "professional_id", CAST(ROUND(COALESCE("total_amount", 0) * 100) AS integer), "payment_method", "status", "created_by" FROM `sales`;--> statement-breakpoint
DROP TABLE `sales`;--> statement-breakpoint
ALTER TABLE `__new_sales` RENAME TO `sales`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
-- Valores convertidos: reenviar tudo para a nuvem (colunas novas em centavos).
UPDATE `inventory_items` SET sync_status = 'pending';--> statement-breakpoint
UPDATE `procedure_types` SET sync_status = 'pending';--> statement-breakpoint
UPDATE `sale_items` SET sync_status = 'pending';--> statement-breakpoint
UPDATE `sales` SET sync_status = 'pending';
