CREATE TABLE `import_stagings` (
	`id` text PRIMARY KEY NOT NULL,
	`character_name` text NOT NULL,
	`sheet_json` text NOT NULL,
	`created_at` integer NOT NULL
);
