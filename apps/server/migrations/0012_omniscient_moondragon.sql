CREATE TABLE `ui_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`gm_theme_id` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `modules` ADD `theme_id` text;