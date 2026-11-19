import type { KickedPlayerDto } from "@cogm/shared";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import { loadHolderDisplayNames } from "@/platform/db/holder-display-names";
import { characters, sessionClaims, sessionKicks } from "@/platform/db/schema";

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

	const holderNames = await loadHolderDisplayNames(db, kicks);

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
