ALTER TABLE `session_audio_state` ADD `mode` text DEFAULT 'single' NOT NULL;--> statement-breakpoint
UPDATE `session_audio_state` SET `mode` = CASE WHEN `loop` = 1 THEN 'single' ELSE 'off' END;--> statement-breakpoint
ALTER TABLE `session_audio_state` DROP COLUMN `loop`;
