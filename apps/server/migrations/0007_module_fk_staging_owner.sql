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
ALTER TABLE `import_stagings` ADD `gm_session_id` TEXT;
