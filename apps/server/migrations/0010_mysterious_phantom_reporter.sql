CREATE TABLE `session_kicks` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`player_id` text NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL,
	`lifted_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `anonymous_players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_kicks_active_uq` ON `session_kicks` (`session_id`,`player_id`) WHERE "session_kicks"."lifted_at" is null;