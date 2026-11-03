import { eq, and, gt, isNull, or, ne, sql } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import { users, userSessions, anonymousPlayers, playerTokens, blacklistEntries } from "@/platform/db/schema";
import type { IdentityRepository, UserRecord, UserSessionRecord, AnonymousPlayer, PlayerToken } from "../application/ports";

export class DrizzleIdentityRepository implements IdentityRepository {
  constructor(private readonly db: DbClient) {}

  async findUserById(id: string): Promise<UserRecord | null> {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return (rows[0] as UserRecord | undefined) ?? null;
  }

  async findUserByUsernameNormalized(usernameNormalized: string): Promise<UserRecord | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.usernameNormalized, usernameNormalized))
      .limit(1);
    return (rows[0] as UserRecord | undefined) ?? null;
  }

  async createUser(user: UserRecord): Promise<void> {
    await this.db.insert(users).values(user);
  }

  async updateUser(
    id: string,
    patch: Partial<
      Pick<
        UserRecord,
        "username" | "usernameNormalized" | "passwordHash" | "role" | "disabledAt" | "deletedAt" | "updatedAt"
      >
    >
  ): Promise<void> {
    await this.db.update(users).set(patch).where(eq(users.id, id));
  }

  async listUsers(includeDeleted: boolean): Promise<UserRecord[]> {
    const rows = includeDeleted
      ? await this.db.select().from(users)
      : await this.db.select().from(users).where(isNull(users.deletedAt));
    return rows as UserRecord[];
  }

  async countActiveAdmins(excludeUserId?: string): Promise<number> {
    const conditions = [eq(users.role, "admin"), isNull(users.disabledAt), isNull(users.deletedAt)];
    if (excludeUserId) {
      conditions.push(ne(users.id, excludeUserId));
    }
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(...conditions));
    return Number(rows[0]?.count ?? 0);
  }

  async findUserSessionByTokenHash(tokenHash: string): Promise<UserSessionRecord | null> {
    const rows = await this.db
      .select()
      .from(userSessions)
      .where(eq(userSessions.sessionTokenHash, tokenHash))
      .limit(1);
    return (rows[0] as UserSessionRecord | undefined) ?? null;
  }

  async listSessionsByUser(userId: string): Promise<UserSessionRecord[]> {
    const rows = await this.db.select().from(userSessions).where(eq(userSessions.userId, userId));
    return rows as UserSessionRecord[];
  }

  async createUserSession(session: UserSessionRecord): Promise<void> {
    await this.db.insert(userSessions).values(session);
  }

  async revokeSession(id: string, revokedAt: number, replacedBySessionId?: string | null): Promise<void> {
    await this.db
      .update(userSessions)
      .set({ revokedAt, ...(replacedBySessionId !== undefined ? { replacedBySessionId } : {}) })
      .where(eq(userSessions.id, id));
  }

  async revokeAllUserSessions(userId: string, revokedAt: number, keepSessionId?: string): Promise<void> {
    const conditions = [eq(userSessions.userId, userId), isNull(userSessions.revokedAt)];
    if (keepSessionId) {
      conditions.push(ne(userSessions.id, keepSessionId));
    }
    await this.db
      .update(userSessions)
      .set({ revokedAt })
      .where(and(...conditions));
  }

  async findAnonymousPlayerById(id: string): Promise<AnonymousPlayer | null> {
    const rows = await this.db.select().from(anonymousPlayers).where(eq(anonymousPlayers.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findAnonymousPlayerByFingerprintHash(fingerprintHash: string): Promise<AnonymousPlayer | null> {
    const rows = await this.db
      .select()
      .from(anonymousPlayers)
      .where(eq(anonymousPlayers.fingerprintHash, fingerprintHash))
      .limit(1);
    return rows[0] ?? null;
  }

  async saveAnonymousPlayer(player: AnonymousPlayer): Promise<void> {
    await this.db.insert(anonymousPlayers).values(player);
  }

  async updateAnonymousPlayerActiveTime(id: string, lastActiveAt: number): Promise<void> {
    await this.db.update(anonymousPlayers).set({ lastActiveAt }).where(eq(anonymousPlayers.id, id));
  }

  async findPlayerTokenByTokenHash(tokenHash: string): Promise<PlayerToken | null> {
    const rows = await this.db.select().from(playerTokens).where(eq(playerTokens.tokenHash, tokenHash)).limit(1);
    return rows[0] ?? null;
  }

  async savePlayerToken(token: PlayerToken): Promise<void> {
    await this.db.insert(playerTokens).values(token);
  }

  async revokePlayerToken(id: string, revokedAt: number): Promise<void> {
    await this.db.update(playerTokens).set({ revokedAt }).where(eq(playerTokens.id, id));
  }

  async isFingerprintBlacklisted(fingerprintHash: string): Promise<boolean> {
    const now = Date.now();
    const rows = await this.db
      .select({ id: blacklistEntries.id })
      .from(blacklistEntries)
      .where(
        and(
          eq(blacklistEntries.fingerprintHash, fingerprintHash),
          or(isNull(blacklistEntries.expiresAt), gt(blacklistEntries.expiresAt, now))
        )
      )
      .limit(1);
    return rows.length > 0;
  }

  async listBlacklistEntries() {
    return await this.db.select().from(blacklistEntries);
  }
}
