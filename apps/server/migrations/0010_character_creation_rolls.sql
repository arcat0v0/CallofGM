CREATE TABLE `character_creation_rolls` (
	`id` text PRIMARY KEY NOT NULL,
	`invite_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`options_json` text NOT NULL,
	`result_json` text NOT NULL,
	`chosen_index` integer,
	`chosen_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`invite_id`) REFERENCES `character_invites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `character_creation_rolls_invite_user_idx` ON `character_creation_rolls` (`invite_id`,`user_id`);--> statement-breakpoint
ALTER TABLE `character_invites` ADD `creation_options_json` text;