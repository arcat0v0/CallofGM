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
ALTER TABLE `session_messages` ADD `archived_at` integer;--> statement-breakpoint
ALTER TABLE `session_messages` ADD `archived_by_rewind_id` text;