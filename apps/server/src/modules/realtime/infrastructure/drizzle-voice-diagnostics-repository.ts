import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import { voiceDiagnosticReports } from "@/platform/db/schema";

export type VoiceDiagnosticReportInsert =
	typeof voiceDiagnosticReports.$inferInsert;
export type VoiceDiagnosticReportRow = typeof voiceDiagnosticReports.$inferSelect;

export class DrizzleVoiceDiagnosticsRepository {
	constructor(private readonly db: DbClient) {}

	async insert(report: VoiceDiagnosticReportInsert): Promise<void> {
		await this.db.insert(voiceDiagnosticReports).values(report);
	}

	async listBySession(
		sessionId: string,
		limit: number,
	): Promise<VoiceDiagnosticReportRow[]> {
		return this.db
			.select()
			.from(voiceDiagnosticReports)
			.where(
				and(
					eq(voiceDiagnosticReports.sessionId, sessionId),
					isNull(voiceDiagnosticReports.deletedAt),
				),
			)
			.orderBy(
				desc(voiceDiagnosticReports.receivedAt),
				desc(sql`voice_diagnostic_reports.rowid`),
			)
			.limit(limit);
	}
}
