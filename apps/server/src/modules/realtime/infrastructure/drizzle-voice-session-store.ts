import { and, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { SeatHolder } from "@/modules/identity";
import type { DbClient } from "@/platform/db/client";
import {
	sessionCharacters,
	sessionClaims,
	sessionKicks,
	sessions,
	users,
} from "@/platform/db/schema";
import type {
	VoiceClaim,
	VoiceSession,
	VoiceSessionStore,
} from "../application/ports";

const owner = alias(users, "voice_owner");
const userKick = alias(sessionKicks, "voice_user_kick");
const playerKick = alias(sessionKicks, "voice_player_kick");

export class DrizzleVoiceSessionStore implements VoiceSessionStore {
	constructor(private readonly db: DbClient) {}

	async loadSession(
		sessionId: string,
		claims: SeatHolder | "all" | "none" = "all",
	): Promise<VoiceSession | null> {
		const holderCondition =
			claims === "all"
				? undefined
				: claims === "none"
					? sql`0`
					: claims.holderKind === "user"
						? eq(sessionClaims.userId, claims.userId)
						: eq(sessionClaims.playerId, claims.playerId);
		const rows = await this.db
			.select({
				session: {
					ownerId: sessions.ownerId,
					status: sessions.status,
					phase: sessions.phase,
					voiceLimit: sessions.voiceLimit,
				},
				ownerName: owner.username,
				claim: {
					id: sessionClaims.id,
					userId: sessionClaims.userId,
					playerId: sessionClaims.playerId,
					role: sessionClaims.role,
					characterId: sessionClaims.characterId,
				},
				characterName: sessionCharacters.name,
				username: users.username,
				userKickId: userKick.id,
				playerKickId: playerKick.id,
			})
			.from(sessions)
			.leftJoin(owner, eq(owner.id, sessions.ownerId))
			.leftJoin(
				sessionClaims,
				and(
					eq(sessionClaims.sessionId, sessions.id),
					isNull(sessionClaims.releasedAt),
					holderCondition,
				),
			)
			.leftJoin(
				sessionCharacters,
				and(
					eq(sessionCharacters.sessionId, sessions.id),
					eq(sessionCharacters.characterId, sessionClaims.characterId),
				),
			)
			.leftJoin(users, eq(users.id, sessionClaims.userId))
			.leftJoin(
				userKick,
				and(
					eq(userKick.sessionId, sessions.id),
					eq(userKick.userId, sessionClaims.userId),
					isNull(userKick.liftedAt),
				),
			)
			.leftJoin(
				playerKick,
				and(
					eq(playerKick.sessionId, sessions.id),
					eq(playerKick.playerId, sessionClaims.playerId),
					isNull(playerKick.liftedAt),
				),
			)
			.where(eq(sessions.id, sessionId));
		const first = rows[0];
		if (!first) return null;
		const activeClaims: VoiceClaim[] = [];
		for (const {
			claim,
			characterName,
			username,
			userKickId,
			playerKickId,
		} of rows) {
			if (!claim) continue;
			activeClaims.push({
				...claim,
				characterName,
				username,
				kicked: userKickId !== null || playerKickId !== null,
			});
		}
		return {
			...first.session,
			ownerName: first.ownerName,
			claims: activeClaims,
		};
	}

	async setVoiceLimit(sessionId: string, voiceLimit: number): Promise<void> {
		await this.db
			.update(sessions)
			.set({ voiceLimit })
			.where(eq(sessions.id, sessionId));
	}
}
