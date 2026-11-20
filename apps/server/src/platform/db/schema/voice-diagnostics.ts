import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sessions } from "./sessions";

export const voiceDiagnosticReports = sqliteTable(
	"voice_diagnostic_reports",
	{
		id: text("id").primaryKey(),
		sessionId: text("session_id")
			.notNull()
			.references(() => sessions.id),
		roomId: text("room_id").notNull(),
		memberId: text("member_id").notNull(),
		consentVersion: integer("consent_version").notNull(),
		consentAcceptedAt: integer("consent_accepted_at").notNull(),
		receivedAt: integer("received_at").notNull(),
		payloadJson: text("payload_json").notNull(),
		deletedAt: integer("deleted_at"),
	},
	(table) => [
		index("voice_diagnostic_reports_session_received_idx").on(
			table.sessionId,
			table.receivedAt,
		),
		index("voice_diagnostic_reports_deleted_idx").on(table.deletedAt),
	],
);
