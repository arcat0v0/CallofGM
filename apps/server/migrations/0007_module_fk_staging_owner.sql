PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `module_characters_new` (
	`id` text PRIMARY KEY NOT NULL,
	`module_id` text NOT NULL,
	`character_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `module_characters_new` (`id`, `module_id`, `character_id`, `created_at`) SELECT `id`, `module_id`, `character_id`, `created_at` FROM `module_characters`;--> statement-breakpoint
DROP TABLE `module_characters`;--> statement-breakpoint
ALTER TABLE `module_characters_new` RENAME TO `module_characters`;--> statement-breakpoint
CREATE UNIQUE INDEX `module_characters_module_character_uq` ON `module_characters` (`module_id`,`character_id`);--> statement-breakpoint
CREATE TABLE `import_stagings_new` (
	`id` text PRIMARY KEY NOT NULL,
	`character_name` text NOT NULL,
	`sheet_json` text NOT NULL,
	`rule_id` text DEFAULT '' NOT NULL,
	`errors_json` text DEFAULT '[]' NOT NULL,
	`expires_at` integer DEFAULT 0 NOT NULL,
	`consumed_at` integer,
	`gm_session_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`gm_session_id`) REFERENCES `gm_login_sessions`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
INSERT INTO `import_stagings_new` (`id`, `character_name`, `sheet_json`, `rule_id`, `errors_json`, `expires_at`, `consumed_at`, `gm_session_id`, `created_at`) SELECT `id`, `character_name`, `sheet_json`, `rule_id`, `errors_json`, `expires_at`, `consumed_at`, NULL, `created_at` FROM `import_stagings`;--> statement-breakpoint
DROP TABLE `import_stagings`;--> statement-breakpoint
ALTER TABLE `import_stagings_new` RENAME TO `import_stagings`;
