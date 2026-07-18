import { and, asc, eq, max } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import { sessionMessages, sessionCharacters, characters, characterPortraits } from "@/platform/db/schema";

export type MessageRow = typeof sessionMessages.$inferSelect;
export type NewMessageRow = typeof sessionMessages.$inferInsert;

export class DrizzleChatRepository {
  constructor(private readonly db: DbClient) {}

  async insertMessage(message: NewMessageRow): Promise<void> {
    await this.db.insert(sessionMessages).values(message);
  }

  async findMessageById(id: string): Promise<MessageRow | null> {
    const rows = await this.db.select().from(sessionMessages).where(eq(sessionMessages.id, id));
    return rows[0] ?? null;
  }

  async maxQueueOrder(sessionId: string): Promise<number> {
    const rows = await this.db
      .select({ value: max(sessionMessages.queueOrder) })
      .from(sessionMessages)
      .where(and(eq(sessionMessages.sessionId, sessionId), eq(sessionMessages.status, "pending")));
    return rows[0]?.value ?? 0;
  }

  async listPending(sessionId: string): Promise<MessageRow[]> {
    return await this.db
      .select()
      .from(sessionMessages)
      .where(and(eq(sessionMessages.sessionId, sessionId), eq(sessionMessages.status, "pending")))
      .orderBy(asc(sessionMessages.queueOrder));
  }

  /** 仅当消息仍为 pending 时放行；返回是否成功（防并发重复放行） */
  async markPresentedIfPending(id: string, presentedAt: number): Promise<boolean> {
    const updated = await this.db
      .update(sessionMessages)
      .set({ status: "presented", presentedAt })
      .where(and(eq(sessionMessages.id, id), eq(sessionMessages.status, "pending")))
      .returning({ id: sessionMessages.id });
    return updated.length > 0;
  }

  /** 仅当消息仍为 pending 时丢弃 */
  async markDiscardedIfPending(id: string): Promise<boolean> {
    const updated = await this.db
      .update(sessionMessages)
      .set({ status: "discarded" })
      .where(and(eq(sessionMessages.id, id), eq(sessionMessages.status, "pending")))
      .returning({ id: sessionMessages.id });
    return updated.length > 0;
  }

  async assignEventId(id: string, eventId: number): Promise<void> {
    await this.db.update(sessionMessages).set({ eventId }).where(eq(sessionMessages.id, id));
  }

  async reorderPending(sessionId: string, orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await this.db
        .update(sessionMessages)
        .set({ queueOrder: i + 1 })
        .where(
          and(
            eq(sessionMessages.id, orderedIds[i]!),
            eq(sessionMessages.sessionId, sessionId),
            eq(sessionMessages.status, "pending")
          )
        );
    }
  }

  async findCharacterName(characterId: string): Promise<string | null> {
    const rows = await this.db
      .select({ name: characters.name })
      .from(characters)
      .where(eq(characters.id, characterId));
    return rows[0]?.name ?? null;
  }

  async portraitExists(characterId: string, expressionKey: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: characterPortraits.id })
      .from(characterPortraits)
      .where(
        and(
          eq(characterPortraits.characterId, characterId),
          eq(characterPortraits.expressionKey, expressionKey)
        )
      );
    return rows.length > 0;
  }

  async setSessionCharacterExpression(
    sessionId: string,
    characterId: string,
    expressionKey: string
  ): Promise<void> {
    await this.db
      .update(sessionCharacters)
      .set({ currentExpressionKey: expressionKey })
      .where(
        and(
          eq(sessionCharacters.sessionId, sessionId),
          eq(sessionCharacters.characterId, characterId)
        )
      );
  }
}
