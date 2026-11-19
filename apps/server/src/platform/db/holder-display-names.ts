import { inArray } from "drizzle-orm";
import type { DbClient } from "./client";
import { anonymousPlayers, users } from "./schema";

export async function loadHolderDisplayNames(
	db: DbClient,
	holders: readonly { userId: string | null; playerId: string | null }[],
): Promise<Map<string, string>> {
	const userIds: string[] = [];
	const playerIds: string[] = [];
	for (const { userId, playerId } of holders) {
		if (userId) userIds.push(userId);
		if (playerId) playerIds.push(playerId);
	}
	const names = new Map<string, string>();
	if (userIds.length > 0) {
		const rows = await db
			.select({ id: users.id, username: users.username })
			.from(users)
			.where(inArray(users.id, userIds));
		for (const row of rows) names.set(`user:${row.id}`, row.username);
	}
	if (playerIds.length > 0) {
		const rows = await db
			.select({ id: anonymousPlayers.id })
			.from(anonymousPlayers)
			.where(inArray(anonymousPlayers.id, playerIds));
		for (const row of rows) {
			names.set(`player:${row.id}`, `观战 ${row.id.slice(0, 8)}`);
		}
	}
	return names;
}
