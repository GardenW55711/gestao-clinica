CREATE TABLE `procedure_type_items` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`deleted_at` text,
	`procedure_type_id` text NOT NULL,
	`inventory_item_id` text NOT NULL,
	`default_quantity` real DEFAULT 1 NOT NULL
);
