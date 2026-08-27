import { and, eq } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import { characters, sessionCharacters, checkRequests } from "@/platform/db/schema";
import type { GameplayRepository } from "../application/ports";

export class DrizzleGameplayRepository implements GameplayRepository {
  constructor(private readonly db: DbClient) {}

  async findCharacter(characterId: string) {
    const rows = await this.db.select().from(characters).where(eq(characters.id, characterId));
    return rows[0] ?? null;
  }

  async findSessionCharacter(sessionId: string, characterId: string) {
    const rows = await this.db
      .select()
      .from(sessionCharacters)
      .where(
        and(
          eq(sessionCharacters.sessionId, sessionId),
          eq(sessionCharacters.characterId, characterId)
        )
      );
    return rows[0] ?? null;
  }

  async updateSessionCharacterState(
    sessionId: string,
    characterId: string,
    stateJson: string
  ): Promise<void> {
    await this.db
      .update(sessionCharacters)
      .set({ stateJson })
      .where(
        and(
          eq(sessionCharacters.sessionId, sessionId),
          eq(sessionCharacters.characterId, characterId)
        )
      );
  }

  async insertCheckRequest(row: typeof checkRequests.$inferInsert): Promise<void> {
    await this.db.insert(checkRequests).values(row);
  }

  async findCheckRequest(id: string) {
    const rows = await this.db.select().from(checkRequests).where(eq(checkRequests.id, id));
    return rows[0] ?? null;
  }

  /** compare-and-set：仅当请求仍为 pending 时置为 resolved，保证只能响应一次 */
  async resolveCheckRequestIfPending(id: string, resolvedCheckResultJson: string): Promise<boolean> {
    const updated = await this.db
      .update(checkRequests)
      .set({ status: "resolved", resolvedCheckResultJson })
      .where(and(eq(checkRequests.id, id), eq(checkRequests.status, "pending")))
      .returning({ id: checkRequests.id });
    return updated.length > 0;
  }
}
