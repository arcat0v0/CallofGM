import { eq, and, gt, isNull, or } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import { gmLoginSessions, anonymousPlayers, playerTokens, blacklistEntries } from "@/platform/db/schema";
import type { IdentityRepository, GmLoginSession, AnonymousPlayer, PlayerToken } from "../application/ports";

export class DrizzleIdentityRepository implements IdentityRepository {
  constructor(private readonly db: DbClient) {}

  async findGmSessionByTokenHash(tokenHash: string): Promise<GmLoginSession | null> {
    const result = await this.db
      .select()
      .from(gmLoginSessions)
      .where(eq(gmLoginSessions.sessionTokenHash, tokenHash))
      .limit(1);
    return result[0] || null;
  }

  async saveGmSession(session: GmLoginSession): Promise<void> {
    await this.db.insert(gmLoginSessions).values(session);
  }

  async revokeGmSession(id: string, revokedAt: number): Promise<void> {
    await this.db
      .update(gmLoginSessions)
      .set({ revokedAt })
      .where(eq(gmLoginSessions.id, id));
  }

  async findAnonymousPlayerById(id: string): Promise<AnonymousPlayer | null> {
    const result = await this.db
      .select()
      .from(anonymousPlayers)
      .where(eq(anonymousPlayers.id, id))
      .limit(1);
    return result[0] || null;
  }

  async findAnonymousPlayerByFingerprintHash(fingerprintHash: string): Promise<AnonymousPlayer | null> {
    const result = await this.db
      .select()
      .from(anonymousPlayers)
      .where(eq(anonymousPlayers.fingerprintHash, fingerprintHash))
      .limit(1);
    return result[0] || null;
  }

  async saveAnonymousPlayer(player: AnonymousPlayer): Promise<void> {
    await this.db.insert(anonymousPlayers).values(player);
  }

  async updateAnonymousPlayerActiveTime(id: string, lastActiveAt: number): Promise<void> {
    await this.db
      .update(anonymousPlayers)
      .set({ lastActiveAt })
      .where(eq(anonymousPlayers.id, id));
  }

  async findPlayerTokenByTokenHash(tokenHash: string): Promise<PlayerToken | null> {
    const result = await this.db
      .select()
      .from(playerTokens)
      .where(eq(playerTokens.tokenHash, tokenHash))
      .limit(1);
    return result[0] || null;
  }

  async savePlayerToken(token: PlayerToken): Promise<void> {
    await this.db.insert(playerTokens).values(token);
  }

  async revokePlayerToken(id: string, revokedAt: number): Promise<void> {
    await this.db
      .update(playerTokens)
      .set({ revokedAt })
      .where(eq(playerTokens.id, id));
  }

  async isFingerprintBlacklisted(fingerprintHash: string): Promise<boolean> {
    const now = Date.now();
    const result = await this.db
      .select()
      .from(blacklistEntries)
      .where(
        and(
          eq(blacklistEntries.fingerprintHash, fingerprintHash),
          // expiresAt 为 NULL 表示永久封禁
          or(isNull(blacklistEntries.expiresAt), gt(blacklistEntries.expiresAt, now))
        )
      )
      .limit(1);
    return result.length > 0;
  }

  async listBlacklistEntries() {
    return await this.db.select().from(blacklistEntries);
  }
}
