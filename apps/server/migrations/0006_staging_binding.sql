ALTER TABLE `import_stagings` ADD `rule_id` TEXT NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `import_stagings` ADD `errors_json` TEXT NOT NULL DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `import_stagings` ADD `expires_at` INTEGER NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `import_stagings` ADD `consumed_at` INTEGER;
