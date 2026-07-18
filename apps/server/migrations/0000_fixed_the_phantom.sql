CREATE TABLE `anonymous_players` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint_hash` text NOT NULL,
	`first_active_at` integer NOT NULL,
	`last_active_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `anonymous_players_fingerprint_hash_unique` ON `anonymous_players` (`fingerprint_hash`);--> statement-breakpoint
CREATE TABLE `blacklist_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint_hash` text NOT NULL,
	`reason` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blacklist_entries_fingerprint_hash_unique` ON `blacklist_entries` (`fingerprint_hash`);--> statement-breakpoint
CREATE TABLE `gm_login_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gm_login_sessions_session_token_hash_unique` ON `gm_login_sessions` (`session_token_hash`);--> statement-breakpoint
CREATE TABLE `player_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`player_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_tokens_token_hash_unique` ON `player_tokens` (`token_hash`);