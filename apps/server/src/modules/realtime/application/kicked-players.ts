import type { KickedPlayerDto } from "@cogm/shared";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import {
	anonymousPlayers,
	characters,
	sessionClaims,
	sessionKicks,
	users,
} from "@/platform/db/schema";

export async function loadKickedPlayers(
	db: DbClient,
	sessionId: string,
): Promise<KickedPlayerDto[]> {
	const kicks = await db
		.select()
		.from(sessionKicks)
		.where(
			and(eq(sessionKicks.sessionId, sessionId), isNull(sessionKicks.liftedAt)),
		)
		.orderBy(sessionKicks.createdAt);
	if (kicks.length === 0) {
		return [];
	}

	const claims = await db
		.select({
			playerId: sessionClaims.playerId,
			userId: sessionClaims.userId,
			characterId: sessionClaims.characterId,
		})
		.from(sessionClaims)
		.where(
			and(
				eq(sessionClaims.sessionId, sessionId),
				isNull(sessionClaims.releasedAt),
			),
		);

	const characterByHolder = new Map<string, string>();
	for (const claim of claims) {
		if (!claim.characterId) continue;
		if (claim.userId)
			characterByHolder.set(`user:${claim.userId}`, claim.characterId);
		if (claim.playerId)
			characterByHolder.set(`player:${claim.playerId}`, claim.characterId);
	}

	const characterIds = [...new Set(characterByHolder.values())];
	const nameRows =
		characterIds.length > 0
			? await db
					.select({ id: characters.id, name: characters.name })
					.from(characters)
					.where(inArray(characters.id, characterIds))
			: [];
	const nameById = new Map(nameRows.map((row) => [row.id, row.name]));

	const userIds = kicks
		.map((k) => k.userId)
		.filter((id): id is string => Boolean(id));
	const playerIds = kicks
		.map((k) => k.playerId)
		.filter((id): id is string => Boolean(id));
	const holderNames = new Map<string, string>();
	if (userIds.length > 0) {
		const rows = await db
			.select({ id: users.id, username: users.username })
			.from(users)
			.where(inArray(users.id, userIds));
		for (const row of rows) holderNames.set(`user:${row.id}`, row.username);
	}
	if (playerIds.length > 0) {
		const rows = await db
			.select({ id: anonymousPlayers.id })
			.from(anonymousPlayers)
			.where(inArray(anonymousPlayers.id, playerIds));
		for (const row of rows)
			holderNames.set(`player:${row.id}`, `观战 ${row.id.slice(0, 8)}`);
	}

	return kicks.map((kick) => {
		const holderKind = kick.holderKind as "user" | "anonymous";
		const holderId =
			(holderKind === "user" ? kick.userId : kick.playerId) ?? "";
		const key = `${holderKind}:${holderId}`;
		const characterName = characterByHolder.get(key);
		return {
			holderKind,
			holderId,
			displayName: characterName
				? (nameById.get(characterName) ?? null)
				: (holderNames.get(key) ?? null),
			reason: kick.reason,
			createdAt: kick.createdAt,
		};
	});
}
