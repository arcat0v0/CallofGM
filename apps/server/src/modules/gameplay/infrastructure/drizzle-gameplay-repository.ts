import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import {
	characters,
	checkRequests,
	sessionCharacters,
	sessionHistoryEvents,
	sessions,
} from "@/platform/db/schema";
import type { GameplayRepository } from "../application/ports";

export class DrizzleGameplayRepository implements GameplayRepository {
	constructor(private readonly db: DbClient) {}

	async findCharacter(characterId: string) {
		const rows = await this.db
			.select()
			.from(characters)
			.where(eq(characters.id, characterId));
		return rows[0] ?? null;
	}

	async findSessionCharacter(sessionId: string, characterId: string) {
		const rows = await this.db
			.select({
				kind: sessionCharacters.kind,
				name: sessionCharacters.name,
				stateJson: sessionCharacters.stateJson,
				sheetJson: sessionCharacters.sheetJson,
				publicStateFieldsJson: sessionCharacters.publicStateFieldsJson,
			})
			.from(sessionCharacters)
			.where(
				and(
					eq(sessionCharacters.sessionId, sessionId),
					eq(sessionCharacters.characterId, characterId),
					isNull(sessionCharacters.deletedAt),
				),
			);
		return rows[0] ?? null;
	}

	async updateSessionRuleState(
		sessionId: string,
		ruleStateJson: string | null,
	): Promise<void> {
		await this.db
			.update(sessions)
			.set({ ruleStateJson })
			.where(eq(sessions.id, sessionId));
	}

	async updateSessionCharacterState(
		sessionId: string,
		characterId: string,
		stateJson: string,
	): Promise<void> {
		await this.db
			.update(sessionCharacters)
			.set({ stateJson })
			.where(
				and(
					eq(sessionCharacters.sessionId, sessionId),
					eq(sessionCharacters.characterId, characterId),
				),
			);
	}

	async insertCheckRequest(
		row: typeof checkRequests.$inferInsert,
	): Promise<void> {
		await this.db.insert(checkRequests).values(row);
	}

	async findCheckRequest(id: string) {
		const rows = await this.db
			.select()
			.from(checkRequests)
			.where(eq(checkRequests.id, id));
		return rows[0] ?? null;
	}

	/** compare-and-set：仅当请求仍为 pending 时置为 resolved，保证只能响应一次 */
	async resolveCheckRequestIfPending(
		id: string,
		resolvedCheckResultJson: string,
	): Promise<boolean> {
		const updated = await this.db
			.update(checkRequests)
			.set({ status: "resolved", resolvedCheckResultJson })
			.where(and(eq(checkRequests.id, id), eq(checkRequests.status, "pending")))
			.returning({ id: checkRequests.id });
		return updated.length > 0;
	}

	async findRecentCheckEvents(sessionId: string, limit: number) {
		return this.db
			.select({
				eventId: sessionHistoryEvents.eventId,
				type: sessionHistoryEvents.type,
				payloadJson: sessionHistoryEvents.payloadJson,
				occurredAt: sessionHistoryEvents.occurredAt,
			})
			.from(sessionHistoryEvents)
			.where(
				and(
					eq(sessionHistoryEvents.sessionId, sessionId),
					inArray(sessionHistoryEvents.type, [
						"check:resolved",
						"check:amended",
					]),
					isNull(sessionHistoryEvents.archivedAt),
				),
			)
			.orderBy(desc(sessionHistoryEvents.eventId))
			.limit(limit);
	}
}
