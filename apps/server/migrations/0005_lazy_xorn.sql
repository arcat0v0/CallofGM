PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_template_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`name` text NOT NULL,
	`source` text DEFAULT 'upload' NOT NULL,
	`external_id` text,
	`artists_json` text DEFAULT '[]' NOT NULL,
	`album` text,
	`source_url` text,
	`audio_asset_id` text,
	`type` text NOT NULL,
	`duration` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`audio_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_template_tracks`("id", "template_id", "name", "source", "external_id", "artists_json", "album", "source_url", "audio_asset_id", "type", "duration", "deleted_at", "created_at") SELECT "id", "template_id", "name", 'upload', NULL, '[]', NULL, NULL, "audio_asset_id", "type", "duration", "deleted_at", "created_at" FROM `template_tracks`;--> statement-breakpoint
DROP TABLE `template_tracks`;--> statement-breakpoint
ALTER TABLE `__new_template_tracks` RENAME TO `template_tracks`;--> statement-breakpoint
CREATE INDEX `template_tracks_template_idx` ON `template_tracks` (`template_id`);--> statement-breakpoint
CREATE TABLE `__new_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`module_id` text NOT NULL,
	`name` text NOT NULL,
	`source` text DEFAULT 'upload' NOT NULL,
	`external_id` text,
	`artists_json` text DEFAULT '[]' NOT NULL,
	`album` text,
	`source_url` text,
	`audio_asset_id` text,
	`type` text NOT NULL,
	`duration` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`audio_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_tracks`("id", "module_id", "name", "source", "external_id", "artists_json", "album", "source_url", "audio_asset_id", "type", "duration", "deleted_at", "created_at") SELECT "id", "module_id", "name", 'upload', NULL, '[]', NULL, NULL, "audio_asset_id", "type", "duration", "deleted_at", "created_at" FROM `tracks`;--> statement-breakpoint
DROP TABLE `tracks`;--> statement-breakpoint
ALTER TABLE `__new_tracks` RENAME TO `tracks`;--> statement-breakpoint
CREATE INDEX `tracks_deleted_idx` ON `tracks` (`deleted_at`);
PRAGMA foreign_keys=ON;