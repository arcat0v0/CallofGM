import { and, eq, inArray, isNull } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import { characters, sessionClaims, sessionKicks } from "@/platform/db/schema";
import type { KickedPlayerDto } from "@cogm/shared";

export async function loadKickedPlayers(db: DbClient, sessionId: string): Promise<KickedPlayerDto[]> {
  const kicks = await db
    .select()
    .from(sessionKicks)
    .where(and(eq(sessionKicks.sessionId, sessionId), isNull(sessionKicks.liftedAt)))
    .orderBy(sessionKicks.createdAt);
  if (kicks.length === 0) {
    return [];
  }

  const claims = await db
    .select({ playerId: sessionClaims.playerId, characterId: sessionClaims.characterId })
    .from(sessionClaims)
    .where(and(eq(sessionClaims.sessionId, sessionId), isNull(sessionClaims.releasedAt)));
  const characterByPlayer = new Map<string, string>();
  for (const claim of claims) {
    if (claim.characterId) {
      characterByPlayer.set(claim.playerId, claim.characterId);
    }
  }

  const characterIds = [...new Set(characterByPlayer.values())];
  const nameRows =
    characterIds.length > 0
      ? await db
          .select({ id: characters.id, name: characters.name })
          .from(characters)
          .where(inArray(characters.id, characterIds))
      : [];
  const nameById = new Map(nameRows.map((row) => [row.id, row.name]));

  return kicks.map((kick) => ({
    playerId: kick.playerId,
    displayName: nameById.get(characterByPlayer.get(kick.playerId) ?? "") ?? null,
    reason: kick.reason,
    createdAt: kick.createdAt,
  }));
}
