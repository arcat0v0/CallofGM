CREATE TABLE `pending_media_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`purpose` text NOT NULL,
	`storage_key` text NOT NULL,
	`storage_bucket` text NOT NULL,
	`filename` text NOT NULL,
	`declared_content_type` text NOT NULL,
	`expected_size` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pending_media_uploads_expires_idx` ON `pending_media_uploads` (`expires_at`);--> statement-breakpoint
CREATE INDEX `pending_media_uploads_owner_idx` ON `pending_media_uploads` (`owner_id`);--> statement-breakpoint
CREATE TABLE `installed_themes` (
	`key` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`version` text NOT NULL,
	`manifest_json` text NOT NULL,
	`digest` text NOT NULL,
	`has_preview` integer DEFAULT 0 NOT NULL,
	`storage_provider` text DEFAULT 'local' NOT NULL,
	`storage_prefix` text DEFAULT '' NOT NULL,
	`files_json` text DEFAULT '[]' NOT NULL,
	`installed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `installed_themes_id_idx` ON `installed_themes` (`id`);--> statement-breakpoint
CREATE INDEX `installed_themes_provider_idx` ON `installed_themes` (`storage_provider`);--> statement-breakpoint
CREATE TABLE `site_settings` (
	`section` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `media_assets` ADD `storage_provider` text DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `storage_bucket` text;--> statement-breakpoint
CREATE INDEX `media_assets_provider_idx` ON `media_assets` (`storage_provider`);