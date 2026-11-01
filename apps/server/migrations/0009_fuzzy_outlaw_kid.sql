CREATE TABLE `handout_reads` (
	`id` text PRIMARY KEY NOT NULL,
	`grant_id` text NOT NULL,
	`player_id` text NOT NULL,
	`read_at` integer NOT NULL,
	FOREIGN KEY (`grant_id`) REFERENCES `handout_grants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `anonymous_players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `handout_reads_grant_player_uq` ON `handout_reads` (`grant_id`,`player_id`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `name` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `share_pc_sheets` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `ob_see_pc_state` integer DEFAULT 1 NOT NULL;