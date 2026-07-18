CREATE UNIQUE INDEX `character_portraits_character_expression_uq` ON `character_portraits` (`character_id`,`expression_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `module_characters_module_character_uq` ON `module_characters` (`module_id`,`character_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_audio_state_session_uq` ON `session_audio_state` (`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_characters_session_character_uq` ON `session_characters` (`session_id`,`character_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_outbox_session_event_uq` ON `session_outbox` (`session_id`,`event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `handout_grant_recipients_grant_character_uq` ON `handout_grant_recipients` (`grant_id`,`character_id`);