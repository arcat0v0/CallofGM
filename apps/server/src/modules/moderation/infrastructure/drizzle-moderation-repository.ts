import { eq } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import { anonymousPlayers, blacklistEntries } from "@/platform/db/schema";

export class DrizzleModerationRepository {
  constructor(private readonly db: DbClient) {}

  async findPlayerFingerprintHash(playerId: string): Promise<string | null> {
    const rows = await this.db
      .select({ fingerprintHash: anonymousPlayers.fingerprintHash })
      .from(anonymousPlayers)
      .where(eq(anonymousPlayers.id, playerId));
    return rows[0]?.fingerprintHash ?? null;
  }

  /** 写入/覆盖黑名单条目（fingerprintHash 唯一） */
  async upsertBlacklistEntry(entry: {
    id: string;
    fingerprintHash: string;
    reason: string;
    expiresAt: number | null;
    createdAt: number;
  }): Promise<void> {
    await this.db
      .insert(blacklistEntries)
      .values(entry)
      .onConflictDoUpdate({
        target: blacklistEntries.fingerprintHash,
        set: {
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
