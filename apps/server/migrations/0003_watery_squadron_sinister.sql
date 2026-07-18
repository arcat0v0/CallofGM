PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_blacklist_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint_hash` text NOT NULL,
	`reason` text NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_blacklist_entries`("id", "fingerprint_hash", "reason", "expires_at", "created_at") SELECT "id", "fingerprint_hash", "reason", "expires_at", "created_at" FROM `blacklist_entries`;--> statement-breakpoint
DROP TABLE `blacklist_entries`;--> statement-breakpoint
ALTER TABLE `__new_blacklist_entries` RENAME TO `blacklist_entries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `blacklist_entries_fingerprint_hash_unique` ON `blacklist_entries` (`fingerprint_hash`);--> statement-breakpoint
ALTER TABLE `session_outbox` ADD `visibility_json` text DEFAULT '{"type":"public"}' NOT NULL;