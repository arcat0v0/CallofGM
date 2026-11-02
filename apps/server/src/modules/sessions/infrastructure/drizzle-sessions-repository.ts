import { eq, and, inArray, isNull, or, gt, asc } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import {
  sessions,
  sessionCharacters,
  sessionClaims,
  sessionKicks,
  characters,
  modules,
  moduleCharacters,
} from "@/platform/db/schema";
import type { SessionsRepository, SessionKickInput, SessionKickRecord } from "../application/ports";

export class DrizzleSessionsRepository implements SessionsRepository {
  constructor(private readonly db: DbClient) {}

  async findSessionById(id: string, db: DbClient = this.db) {
    const result = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);
    return result[0] || null;
  }

  async saveSession(session: typeof sessions.$inferInsert): Promise<void> {
    await this.db.insert(sessions).values(session);
  }

  async updateSession(
    id: string,
    updates: Partial<Omit<typeof sessions.$inferInsert, "id" | "createdAt">>,
    db: DbClient = this.db
  ) {
    await db
      .update(sessions)
      .set(updates)
      .where(eq(sessions.id, id));
  }

  async createSession(
    session: typeof sessions.$inferInsert,
    charactersToSave: (typeof sessionCharacters.$inferInsert)[]
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(sessions).values(session);
      if (charactersToSave.length > 0) {
        await tx.insert(sessionCharacters).values(charactersToSave);
      }
    });
  }

  async findCharactersByIds(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }
    return await this.db
      .select()
      .from(characters)
      .where(inArray(characters.id, ids));
  }

  async findLinkedCharacterIds(moduleId: string, ids: string[]): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.db
      .select({ characterId: moduleCharacters.characterId })
      .from(moduleCharacters)
      .where(and(eq(moduleCharacters.moduleId, moduleId), inArray(moduleCharacters.characterId, ids)));
    return rows.map((row) => row.characterId);
  }

  async moduleExists(moduleId: string): Promise<boolean> {
    const result = await this.db
      .select({ id: modules.id })
      .from(modules)
      .where(eq(modules.id, moduleId))
      .limit(1);
    return result.length > 0;
  }

  async findModuleById(moduleId: string) {
    const result = await this.db.select().from(modules).where(eq(modules.id, moduleId)).limit(1);
    return result[0] ?? null;
  }

  async findSessionCharacterKind(sessionId: string, characterId: string): Promise<string | null> {
    const result = await this.db
      .select({ kind: sessionCharacters.kind })
      .from(sessionCharacters)
      .where(
        and(
          eq(sessionCharacters.sessionId, sessionId),
          eq(sessionCharacters.characterId, characterId)
        )
      )
      .limit(1);
    return result[0]?.kind ?? null;
  }

  async isCharacterInSession(sessionId: string, characterId: string): Promise<boolean> {
    const result = await this.db
      .select({ id: sessionCharacters.id })
      .from(sessionCharacters)
      .where(
        and(
          eq(sessionCharacters.sessionId, sessionId),
          eq(sessionCharacters.characterId, characterId)
        )
      )
      .limit(1);
    return result.length > 0;
  }

  async findActiveClaimByCharacterId(sessionId: string, characterId: string) {
    const result = await this.db
      .select()
      .from(sessionClaims)
      .where(
        and(
          eq(sessionClaims.sessionId, sessionId),
          eq(sessionClaims.characterId, characterId),
          isNull(sessionClaims.releasedAt)
        )
      )
      .limit(1);
    return result[0] || null;
  }

  async findActiveClaimByPlayer(sessionId: string, playerId: string) {
    const result = await this.db
      .select()
      .from(sessionClaims)
      .where(
        and(
          eq(sessionClaims.sessionId, sessionId),
          eq(sessionClaims.playerId, playerId),
          isNull(sessionClaims.releasedAt)
        )
      )
      .limit(1);
    return result[0] || null;
  }

  async releasePlayerClaims(sessionId: string, playerId: string, releasedAt: number): Promise<void> {
    await this.db
      .update(sessionClaims)
      .set({ releasedAt })
      .where(
        and(
          eq(sessionClaims.sessionId, sessionId),
          eq(sessionClaims.playerId, playerId),
          isNull(sessionClaims.releasedAt)
        )
      );
  }

  async saveClaim(claim: typeof sessionClaims.$inferInsert): Promise<void> {
    await this.db.insert(sessionClaims).values(claim);
  }

  async replacePlayerClaim(
    claim: typeof sessionClaims.$inferInsert,
    releasedAt: number
  ): Promise<boolean> {
    return await this.db.transaction(async (tx) => {
      if (claim.characterId) {
        const occupied = await tx.select({ id: sessionClaims.id })
          .from(sessionClaims)
          .where(and(
            eq(sessionClaims.sessionId, claim.sessionId),
            eq(sessionClaims.characterId, claim.characterId),
            isNull(sessionClaims.releasedAt)
          ))
          .limit(1);
        if (occupied.length > 0) return false;
      }
      await tx.update(sessionClaims).set({ releasedAt }).where(and(
        eq(sessionClaims.sessionId, claim.sessionId),
        eq(sessionClaims.playerId, claim.playerId),
        isNull(sessionClaims.releasedAt)
      ));
      await tx.insert(sessionClaims).values(claim);
      return true;
    });
  }

  async forceReplacePlayerClaim(
    claim: typeof sessionClaims.$inferInsert,
    releasedAt: number
  ): Promise<{ displacedPlayerIds: string[] }> {
    return await this.db.transaction(async (tx) => {
      const displacedPlayerIds: string[] = [];
      if (claim.characterId) {
        const occupied = await tx
          .select({ playerId: sessionClaims.playerId })
          .from(sessionClaims)
          .where(and(
            eq(sessionClaims.sessionId, claim.sessionId),
            eq(sessionClaims.characterId, claim.characterId),
            isNull(sessionClaims.releasedAt)
          ));
        displacedPlayerIds.push(
          ...occupied
            .map((row) => row.playerId)
            .filter((playerId) => playerId !== claim.playerId)
        );
        await tx.update(sessionClaims).set({ releasedAt }).where(and(
          eq(sessionClaims.sessionId, claim.sessionId),
          eq(sessionClaims.characterId, claim.characterId),
          isNull(sessionClaims.releasedAt)
        ));
      }
      await tx.update(sessionClaims).set({ releasedAt }).where(and(
        eq(sessionClaims.sessionId, claim.sessionId),
        eq(sessionClaims.playerId, claim.playerId),
        isNull(sessionClaims.releasedAt)
      ));
      await tx.insert(sessionClaims).values(claim);
      return { displacedPlayerIds };
    });
  }

  async listSessions(options: { limit: number; offset?: number; cursor?: string }) {
    const limit = options.limit;
    let items: (typeof sessions.$inferSelect)[];
    if (options.cursor) {
      const cursorRow = await this.db
        .select()
        .from(sessions)
        .where(eq(sessions.id, options.cursor))
        .limit(1);
      const c = cursorRow[0];
      if (!c) {
        return { items: [], nextCursor: null };
      }
      items = await this.db
        .select()
        .from(sessions)
        .where(
          or(
            gt(sessions.createdAt, c.createdAt),
            and(eq(sessions.createdAt, c.createdAt), gt(sessions.id, c.id))
          )
        )
        .orderBy(asc(sessions.createdAt), asc(sessions.id))
        .limit(limit + 1);
    } else if (options.offset !== undefined) {
      items = await this.db
        .select()
        .from(sessions)
        .orderBy(asc(sessions.createdAt), asc(sessions.id))
        .limit(limit + 1)
        .offset(options.offset);
    } else {
      items = await this.db
        .select()
        .from(sessions)
        .orderBy(asc(sessions.createdAt), asc(sessions.id))
        .limit(limit + 1);
    }
    const hasMore = items.length > limit;
    const returnedItems = hasMore ? items.slice(0, limit) : items;
    const lastItem = returnedItems[returnedItems.length - 1];
    return {
      items: returnedItems,
      nextCursor: hasMore && lastItem ? lastItem.id : null,
    };
  }
  async findSessionCharactersWithClaims(sessionId: string) {
    const sessionChars = await this.db
      .select({
        id: sessionCharacters.id,
        characterId: sessionCharacters.characterId,
        kind: sessionCharacters.kind,
        currentExpressionKey: sessionCharacters.currentExpressionKey,
        stateJson: sessionCharacters.stateJson,
      })
      .from(sessionCharacters)
      .where(eq(sessionCharacters.sessionId, sessionId));

    if (sessionChars.length === 0) {
      return [];
    }

    const charIds = sessionChars.map((sc) => sc.characterId);
    const charsList = await this.db
      .select({
        id: characters.id,
        name: characters.name,
      })
      .from(characters)
      .where(inArray(characters.id, charIds));

    const charMap = new Map(charsList.map((c) => [c.id, c.name]));

    const activeClaims = await this.db
      .select({
        id: sessionClaims.id,
        playerId: sessionClaims.playerId,
        role: sessionClaims.role,
        characterId: sessionClaims.characterId,
      })
      .from(sessionClaims)
      .where(
        and(
          eq(sessionClaims.sessionId, sessionId),
          isNull(sessionClaims.releasedAt)
        )
      );

    const claimMap = new Map();
    for (const claim of activeClaims) {
      if (claim.characterId) {
        claimMap.set(claim.characterId, {
          playerId: claim.playerId,
          role: claim.role,
        });
      }
    }

    return sessionChars.map((sc) => {
      const name = charMap.get(sc.characterId) || "Unknown Character";
      const claim = claimMap.get(sc.characterId) || null;
      return {
        id: sc.characterId,
        characterId: sc.characterId,
        name,
        kind: sc.kind,
        currentExpressionKey: sc.currentExpressionKey,
        state: JSON.parse(sc.stateJson),
        claim: claim
          ? {
              playerId: claim.playerId,
              role: claim.role,
            }
          : null,
      };
    });
  }

  async findActiveClaims(sessionId: string) {
    return await this.db
      .select()
      .from(sessionClaims)
      .where(
        and(
          eq(sessionClaims.sessionId, sessionId),
          isNull(sessionClaims.releasedAt)
        )
      );
  }

  async findActiveSessionKick(sessionId: string, playerId: string): Promise<SessionKickRecord | null> {
    const rows = await this.db
      .select()
      .from(sessionKicks)
      .where(
        and(
          eq(sessionKicks.sessionId, sessionId),
          eq(sessionKicks.playerId, playerId),
          isNull(sessionKicks.liftedAt)
        )
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async recordSessionKick(kick: SessionKickInput): Promise<void> {
    await this.db.insert(sessionKicks).values(kick).onConflictDoNothing();
  }

  async liftSessionKick(sessionId: string, playerId: string, liftedAt: number): Promise<boolean> {
    const rows = await this.db
      .update(sessionKicks)
      .set({ liftedAt })
      .where(
        and(
          eq(sessionKicks.sessionId, sessionId),
          eq(sessionKicks.playerId, playerId),
          isNull(sessionKicks.liftedAt)
        )
      )
      .returning({ id: sessionKicks.id });
    return rows.length > 0;
  }
}
