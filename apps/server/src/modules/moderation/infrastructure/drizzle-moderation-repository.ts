import { desc, eq } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import { anonymousPlayers, blacklistEntries, characters, sessionClaims } from "@/platform/db/schema";
import type { ModerationRepository, BlacklistEntryInput, PlayerBanContext } from "../application/ports";

export class DrizzleModerationRepository implements ModerationRepository {
  constructor(private readonly db: DbClient) {}

  async findPlayerBanContext(playerId: string): Promise<PlayerBanContext | null> {
    const rows = await this.db
      .select({ fingerprintHash: anonymousPlayers.fingerprintHash })
      .from(anonymousPlayers)
      .where(eq(anonymousPlayers.id, playerId));
    const fingerprintHash = rows[0]?.fingerprintHash;
    if (!fingerprintHash) {
      return null;
    }

    const claims = await this.db
      .select({
        role: sessionClaims.role,
        characterName: characters.name,
      })
      .from(sessionClaims)
      .leftJoin(characters, eq(sessionClaims.characterId, characters.id))
      .where(eq(sessionClaims.playerId, playerId))
      .orderBy(desc(sessionClaims.createdAt))
      .limit(1);
    const claim = claims[0];
    const displayName = claim ? (claim.characterName ?? (claim.role === "ob" ? "OB" : null)) : null;

    return { fingerprintHash, displayName };
  }

  /** 写入/覆盖黑名单条目（fingerprintHash 唯一） */
  async upsertBlacklistEntry(entry: BlacklistEntryInput): Promise<void> {
    await this.db
      .insert(blacklistEntries)
      .values(entry)
      .onConflictDoUpdate({
        target: blacklistEntries.fingerprintHash,
        set: {
          playerId: entry.playerId,
          displayName: entry.displayName,
          reason: entry.reason,
          expiresAt: entry.expiresAt,
          createdAt: entry.createdAt,
        },
      });
  }

  async deleteBlacklistEntry(fingerprintHash: string): Promise<boolean> {
    const deleted = await this.db
      .delete(blacklistEntries)
      .where(eq(blacklistEntries.fingerprintHash, fingerprintHash))
      .returning({ id: blacklistEntries.id });
    return deleted.length > 0;
  }
}