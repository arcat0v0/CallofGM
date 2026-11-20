CREATE TABLE `voice_diagnostic_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`room_id` text NOT NULL,
	`member_id` text NOT NULL,
	`consent_version` integer NOT NULL,
	`consent_accepted_at` integer NOT NULL,
	`received_at` integer NOT NULL,
	`payload_json` text NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `voice_diagnostic_reports_session_received_idx` ON `voice_diagnostic_reports` (`session_id`,`received_at`);--> statement-breakpoint
CREATE INDEX `voice_diagnostic_reports_deleted_idx` ON `voice_diagnostic_reports` (`deleted_at`);