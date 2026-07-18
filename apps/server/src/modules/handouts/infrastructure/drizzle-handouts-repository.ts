import { and, eq, inArray } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import { handouts, handoutGrants, handoutGrantRecipients, sessionCharacters } from "@/platform/db/schema";

export class DrizzleHandoutsRepository {
  constructor(private readonly db: DbClient) {}

  async findHandoutById(id: string) {
    const rows = await this.db.select().from(handouts).where(eq(handouts.id, id));
    return rows[0] ?? null;
  }

  async findGrantById(id: string) {
    const rows = await this.db.select().from(handoutGrants).where(eq(handoutGrants.id, id));
    return rows[0] ?? null;
  }

  async insertGrant(row: typeof handoutGrants.$inferInsert): Promise<void> {
    await this.db.insert(handoutGrants).values(row);
  }

  async insertRecipients(rows: (typeof handoutGrantRecipients.$inferInsert)[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    await this.db.insert(handoutGrantRecipients).values(rows);
  }

  async listRecipientCharacterIds(grantId: string): Promise<string[]> {
    const rows = await this.db
      .select({ characterId: handoutGrantRecipients.characterId })
      .from(handoutGrantRecipients)
      .where(eq(handoutGrantRecipients.grantId, grantId));
    return rows.map((r) => r.characterId);
  }

  /** 校验给定人物是否都在团内，返回不在团内的人物 id */
  async findCharactersNotInSession(sessionId: string, characterIds: string[]): Promise<string[]> {
    if (characterIds.length === 0) {
      return [];
    }
    const rows = await this.db
      .select({ characterId: sessionCharacters.characterId })
      .from(sessionCharacters)
      .where(
        and(
          eq(sessionCharacters.sessionId, sessionId),
          inArray(sessionCharacters.characterId, characterIds)
        )
      );
    const inSession = new Set(rows.map((r) => r.characterId));
    return characterIds.filter((id) => !inSession.has(id));
  }
}
