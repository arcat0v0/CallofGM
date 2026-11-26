ALTER TABLE `users` ADD `created_under_gm_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `users` ADD `creation_source` text;--> statement-breakpoint
CREATE INDEX `users_created_under_gm_idx` ON `users` (`created_under_gm_id`);