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
	`player_id` text,
	`user_id` text,
	`display_name` text,
	`reason` text NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blacklist_entries_fingerprint_hash_unique` ON `blacklist_entries` (`fingerprint_hash`);--> statement-breakpoint
CREATE TABLE `player_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`player_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_tokens_token_hash_unique` ON `player_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`replaced_by_session_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_sessions_session_token_hash_unique` ON `user_sessions` (`session_token_hash`);--> statement-breakpoint
CREATE INDEX `user_sessions_user_idx` ON `user_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`username_normalized` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`disabled_at` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_normalized_unique` ON `users` (`username_normalized`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);--> statement-breakpoint
CREATE TABLE `handouts` (
	`id` text PRIMARY KEY NOT NULL,
	`module_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`image_asset_id` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`image_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `handouts_deleted_idx` ON `handouts` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`purpose` text NOT NULL,
	`storage_key` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `media_assets_owner_idx` ON `media_assets` (`owner_id`);--> statement-breakpoint
CREATE INDEX `media_assets_deleted_idx` ON `media_assets` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `modules` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`rule_id` text NOT NULL,
	`theme_id` text,
	`source_template_id` text,
	`source_template_version` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `modules_owner_idx` ON `modules` (`owner_id`);--> statement-breakpoint
CREATE INDEX `modules_deleted_idx` ON `modules` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `scenes` (
	`id` text PRIMARY KEY NOT NULL,
	`module_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer NOT NULL,
	`bg_asset_id` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bg_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scenes_deleted_idx` ON `scenes` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`module_id` text NOT NULL,
	`name` text NOT NULL,
	`audio_asset_id` text NOT NULL,
	`type` text NOT NULL,
	`duration` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`audio_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tracks_deleted_idx` ON `tracks` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `character_audits` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`session_id` text,
	`gm_user_id` text,
	`field` text NOT NULL,
	`old_value` text NOT NULL,
	`new_value` text NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`gm_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `character_audits_character_idx` ON `character_audits` (`character_id`);--> statement-breakpoint
CREATE TABLE `character_growth_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`session_id` text,
	`skill_key` text NOT NULL,
	`old_value` integer NOT NULL,
	`new_value` integer NOT NULL,
	`actor_user_id` text,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `character_growth_character_idx` ON `character_growth_entries` (`character_id`);--> statement-breakpoint
CREATE TABLE `character_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`scope` text NOT NULL,
	`target_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `character_invites_token_hash_unique` ON `character_invites` (`token_hash`);--> statement-breakpoint
CREATE INDEX `character_invites_owner_idx` ON `character_invites` (`owner_id`);--> statement-breakpoint
CREATE INDEX `character_invites_target_idx` ON `character_invites` (`scope`,`target_id`);--> statement-breakpoint
CREATE TABLE `character_portraits` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`expression_key` text NOT NULL,
	`label` text,
	`portrait_asset_id` text NOT NULL,
	`is_default` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`portrait_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `character_portraits_character_expression_uq` ON `character_portraits` (`character_id`,`expression_key`);--> statement-breakpoint
CREATE INDEX `character_portraits_deleted_idx` ON `character_portraits` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `character_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`invite_id` text,
	`scope` text NOT NULL,
	`target_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`character_id` text NOT NULL,
	`submitted_by_user_id` text NOT NULL,
	`submitted_sheet_version` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`decision_reason` text,
	`decided_by_user_id` text,
	`decided_at` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`invite_id`) REFERENCES `character_invites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submitted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`decided_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `character_reviews_owner_status_idx` ON `character_reviews` (`owner_id`,`status`);--> statement-breakpoint
CREATE INDEX `character_reviews_target_idx` ON `character_reviews` (`scope`,`target_id`);--> statement-breakpoint
CREATE TABLE `character_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`version` integer NOT NULL,
	`sheet_version` integer NOT NULL,
	`name` text NOT NULL,
	`background` text NOT NULL,
	`sheet_json` text NOT NULL,
	`actor_user_id` text,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `character_versions_character_version_uq` ON `character_versions` (`character_id`,`version`);--> statement-breakpoint
CREATE TABLE `characters` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`owner_kind` text NOT NULL,
	`name` text NOT NULL,
	`background` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`rule_id` text NOT NULL,
	`sheet_json` text NOT NULL,
	`sheet_version` integer DEFAULT 1 NOT NULL,
	`profile_version` integer DEFAULT 1 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`origin_type` text,
	`origin_ref_id` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `characters_owner_idx` ON `characters` (`owner_id`);--> statement-breakpoint
CREATE INDEX `characters_deleted_idx` ON `characters` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `import_stagings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`character_name` text NOT NULL,
	`sheet_json` text NOT NULL,
	`rule_id` text NOT NULL,
	`errors_json` text DEFAULT '[]' NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `module_characters` (
	`id` text PRIMARY KEY NOT NULL,
	`module_id` text NOT NULL,
	`character_id` text NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `module_characters_module_character_uq` ON `module_characters` (`module_id`,`character_id`);--> statement-breakpoint
CREATE INDEX `module_characters_deleted_idx` ON `module_characters` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `session_audio_state` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`track_id` text,
	`playing` integer NOT NULL,
	`volume` integer DEFAULT 100 NOT NULL,
	`loop` integer NOT NULL,
	`seek_offset_ms` integer DEFAULT 0 NOT NULL,
	`started_at_ms` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_audio_state_session_uq` ON `session_audio_state` (`session_id`);--> statement-breakpoint
CREATE TABLE `session_characters` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`character_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`background` text DEFAULT '' NOT NULL,
	`rule_id` text NOT NULL,
	`sheet_json` text NOT NULL,
	`base_sheet_version` integer NOT NULL,
	`base_profile_version` integer NOT NULL,
	`current_expression_key` text,
	`state_json` text NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_characters_session_character_uq` ON `session_characters` (`session_id`,`character_id`);--> statement-breakpoint
CREATE INDEX `session_characters_deleted_idx` ON `session_characters` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `session_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`holder_kind` text NOT NULL,
	`player_id` text,
	`user_id` text,
	`role` text NOT NULL,
	`character_id` text,
	`released_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `anonymous_players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_claims_active_character_uq` ON `session_claims` (`session_id`,`character_id`) WHERE "session_claims"."released_at" is null and "session_claims"."character_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `session_claims_active_player_uq` ON `session_claims` (`session_id`,`player_id`) WHERE "session_claims"."released_at" is null and "session_claims"."player_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `session_claims_active_user_uq` ON `session_claims` (`session_id`,`user_id`) WHERE "session_claims"."released_at" is null and "session_claims"."user_id" is not null;--> statement-breakpoint
CREATE TABLE `session_kicks` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`holder_kind` text NOT NULL,
	`player_id` text,
	`user_id` text,
	`reason` text,
	`created_at` integer NOT NULL,
	`lifted_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `anonymous_players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_kicks_active_player_uq` ON `session_kicks` (`session_id`,`player_id`) WHERE "session_kicks"."lifted_at" is null and "session_kicks"."player_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `session_kicks_active_user_uq` ON `session_kicks` (`session_id`,`user_id`) WHERE "session_kicks"."lifted_at" is null and "session_kicks"."user_id" is not null;--> statement-breakpoint
CREATE TABLE `session_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`event_id` integer NOT NULL,
	`type` text NOT NULL,
	`payload_json` text NOT NULL,
	`visibility_json` text DEFAULT '{"type":"public"}' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_outbox_session_event_uq` ON `session_outbox` (`session_id`,`event_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text,
	`module_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`status` text NOT NULL,
	`phase` text NOT NULL,
	`current_scene_id` text,
	`last_event_id` integer DEFAULT 0 NOT NULL,
	`share_pc_sheets` integer DEFAULT 1 NOT NULL,
	`ob_see_pc_state` integer DEFAULT 1 NOT NULL,
	`portrait_layout` text DEFAULT 'auto' NOT NULL,
	`portrait_scale` text DEFAULT 'md' NOT NULL,
	`growth_confirmed_at` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`current_scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_owner_idx` ON `sessions` (`owner_id`);--> statement-breakpoint
CREATE INDEX `sessions_deleted_idx` ON `sessions` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `template_characters` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`character_id` text NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `template_characters_template_character_uq` ON `template_characters` (`template_id`,`character_id`);--> statement-breakpoint
CREATE INDEX `template_characters_template_idx` ON `template_characters` (`template_id`);--> statement-breakpoint
CREATE TABLE `template_handouts` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`image_asset_id` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`image_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `template_handouts_template_idx` ON `template_handouts` (`template_id`);--> statement-breakpoint
CREATE TABLE `template_scenes` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer NOT NULL,
	`bg_asset_id` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bg_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `template_scenes_template_idx` ON `template_scenes` (`template_id`);--> statement-breakpoint
CREATE TABLE `template_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`name` text NOT NULL,
	`audio_asset_id` text NOT NULL,
	`type` text NOT NULL,
	`duration` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`audio_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `template_tracks_template_idx` ON `template_tracks` (`template_id`);--> statement-breakpoint
CREATE TABLE `template_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`version` integer NOT NULL,
	`note` text,
	`snapshot_json` text NOT NULL,
	`created_by_user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `template_versions_template_version_uq` ON `template_versions` (`template_id`,`version`);--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`rule_id` text NOT NULL,
	`theme_id` text,
	`settings_json` text NOT NULL,
	`current_version` integer DEFAULT 1 NOT NULL,
	`source_module_id` text,
	`source_template_id` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `templates_owner_idx` ON `templates` (`owner_id`);--> statement-breakpoint
CREATE INDEX `templates_deleted_idx` ON `templates` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `check_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`character_id` text NOT NULL,
	`skill_key` text NOT NULL,
	`difficulty` text NOT NULL,
	`bonus_dice` integer DEFAULT 0 NOT NULL,
	`penalty_dice` integer DEFAULT 0 NOT NULL,
	`hidden` integer DEFAULT 0 NOT NULL,
	`san_loss_expression` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`resolved_check_result_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `handout_grant_recipients` (
	`id` text PRIMARY KEY NOT NULL,
	`grant_id` text NOT NULL,
	`character_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`grant_id`) REFERENCES `handout_grants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `handout_grant_recipients_grant_character_uq` ON `handout_grant_recipients` (`grant_id`,`character_id`);--> statement-breakpoint
CREATE TABLE `handout_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`handout_id` text NOT NULL,
	`is_public` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`handout_id`) REFERENCES `handouts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `handout_reads` (
	`id` text PRIMARY KEY NOT NULL,
	`grant_id` text NOT NULL,
	`player_id` text,
	`user_id` text,
	`read_at` integer NOT NULL,
	FOREIGN KEY (`grant_id`) REFERENCES `handout_grants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `anonymous_players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `handout_reads_grant_player_uq` ON `handout_reads` (`grant_id`,`player_id`) WHERE "handout_reads"."player_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `handout_reads_grant_user_uq` ON `handout_reads` (`grant_id`,`user_id`) WHERE "handout_reads"."user_id" is not null;--> statement-breakpoint
CREATE TABLE `session_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`sender_id` text,
	`sender_user_id` text,
	`sender_type` text NOT NULL,
	`character_id` text,
	`channel` text NOT NULL,
	`content` text NOT NULL,
	`status` text NOT NULL,
	`queue_order` integer DEFAULT 0 NOT NULL,
	`expression_key` text,
	`event_id` integer,
	`presented_at` integer,
	`rejection_reason` text,
	`archived_at` integer,
	`archived_by_rewind_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_id`) REFERENCES `anonymous_players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `session_messages_session_idx` ON `session_messages` (`session_id`);--> statement-breakpoint
CREATE TABLE `session_history_events` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`event_id` integer NOT NULL,
	`type` text NOT NULL,
	`payload_json` text NOT NULL,
	`visibility_json` text NOT NULL,
	`player_visible` integer DEFAULT 1 NOT NULL,
	`anchorable` integer DEFAULT 1 NOT NULL,
	`occurred_at` integer NOT NULL,
	`archived_at` integer,
	`archived_by_rewind_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_history_events_session_event_uq` ON `session_history_events` (`session_id`,`event_id`);--> statement-breakpoint
CREATE INDEX `session_history_events_session_event_idx` ON `session_history_events` (`session_id`,`event_id`);--> statement-breakpoint
CREATE TABLE `session_rewinds` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`action` text NOT NULL,
	`anchor_event_id` integer NOT NULL,
	`anchor_occurred_at` integer NOT NULL,
	`head_event_id_before` integer NOT NULL,
	`rewind_event_id` integer,
	`target_rewind_id` text,
	`reason` text,
	`archived_message_count` integer DEFAULT 0 NOT NULL,
	`archived_event_count` integer DEFAULT 0 NOT NULL,
	`discarded_pending_count` integer DEFAULT 0 NOT NULL,
	`undone_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `session_rewinds_session_created_idx` ON `session_rewinds` (`session_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `session_runtime_checkpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`event_id` integer NOT NULL,
	`state_json` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_runtime_checkpoints_session_event_uq` ON `session_runtime_checkpoints` (`session_id`,`event_id`);--> statement-breakpoint
CREATE TABLE `ui_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`gm_theme_id` text,
	`updated_at` integer NOT NULL
);
