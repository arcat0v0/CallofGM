import { inArray } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import { characters, type sessionMessages } from "@/platform/db/schema";
import type { ChatMessageDto } from "@cogm/shared";

export type SessionMessageRow = typeof sessionMessages.$inferSelect;

export async function loadCharacterNames(db: DbClient, characterIds: string[]): Promise<Map<string, string>> {
  if (characterIds.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({ id: characters.id, name: characters.name })
    .from(characters)
    .where(inArray(characters.id, characterIds));
  return new Map(rows.map((c) => [c.id, c.name]));
}

export function toMessageDto(row: SessionMessageRow, nameMap: Map<string, string>): ChatMessageDto {
  return {
    id: row.id,
    sessionId: row.sessionId,
    senderId: row.senderId ?? null,
    senderType: row.senderType === "gm" ? "gm" : "player",
    characterId: row.characterId ?? null,
    characterName: row.characterId ? (nameMap.get(row.characterId) ?? null) : null,
    channel: row.channel === "roleplay" ? "roleplay" : "ooc",
    content: row.content,
    expressionKey: row.expressionKey ?? null,
    queueOrder: row.queueOrder,
    eventId: row.eventId ?? null,
    presentedAt: row.presentedAt ?? null,
    createdAt: row.createdAt,
  };
}

export function collectCharacterIds(rows: SessionMessageRow[]): string[] {
  return [...new Set(rows.map((r) => r.characterId).filter((id): id is string => !!id))];
}
