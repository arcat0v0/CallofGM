import { and, eq, isNotNull, desc } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import { AppError } from "@/platform/errors/app-error";
import { modules, scenes, tracks, handouts, mediaAssets } from "@/platform/db/schema/catalog";
import { characters, characterPortraits } from "@/platform/db/schema/characters";
import { sessions } from "@/platform/db/schema/sessions";
import { templates } from "@/platform/db/schema/templates";
import { users } from "@/platform/db/schema/identity";
import type { TrashEntityType, TrashItemDto } from "@cogm/shared";

export class TrashItemNotFoundError extends AppError {
  constructor() {
    super("TRASH_ITEM_NOT_FOUND", "Trashed resource not found", 404);
  }
}

type OwnerScopedTable = {
  entityType: TrashEntityType;
  table: any;
  nameColumn: string;
};

const OWNER_SCOPED: OwnerScopedTable[] = [
  { entityType: "module", table: modules, nameColumn: "name" },
  { entityType: "scene", table: scenes, nameColumn: "name" },
  { entityType: "track", table: tracks, nameColumn: "name" },
  { entityType: "handout", table: handouts, nameColumn: "title" },
  { entityType: "character", table: characters, nameColumn: "name" },
  { entityType: "session", table: sessions, nameColumn: "name" },
  { entityType: "template", table: templates, nameColumn: "name" },
  { entityType: "media", table: mediaAssets, nameColumn: "filename" },
];

/** 回收站：按所有权隔离；admin 只看到账号，不做跨所有者级联恢复 */
export class TrashRepository {
  constructor(private readonly db: DbClient) {}

  async listOwned(userId: string): Promise<TrashItemDto[]> {
    const items: TrashItemDto[] = [];

    for (const entry of OWNER_SCOPED) {
      const rows = await this.db
        .select()
        .from(entry.table)
        .where(and(eq(entry.table.ownerId, userId), isNotNull(entry.table.deletedAt)))
        .orderBy(desc(entry.table.deletedAt))
        .limit(200);
      for (const row of rows as Array<Record<string, unknown>>) {
        items.push({
          entityType: entry.entityType,
          id: String(row.id),
          name: String(row[entry.nameColumn] ?? ""),
          deletedAt: Number(row.deletedAt ?? 0),
        });
      }
    }

    const portraitRows = await this.db
      .select({ id: characterPortraits.id, characterId: characterPortraits.characterId, deletedAt: characterPortraits.deletedAt })
      .from(characterPortraits)
      .where(isNotNull(characterPortraits.deletedAt))
      .limit(200);
    const ownedCharacterIds = new Set(
      (
        await this.db
          .select({ id: characters.id })
          .from(characters)
          .where(eq(characters.ownerId, userId))
      ).map((row) => row.id)
    );
    for (const row of portraitRows) {
      if (!ownedCharacterIds.has(row.characterId)) continue;
      items.push({
        entityType: "character",
        id: row.id,
        name: `portrait:${row.characterId}`,
        deletedAt: Number(row.deletedAt ?? 0),
      });
    }

    return items.sort((a, b) => b.deletedAt - a.deletedAt);
  }

  async listAdmin(): Promise<TrashItemDto[]> {
    const rows = await this.db.select().from(users).where(isNotNull(users.deletedAt));
    return rows.map((row) => ({
      entityType: "user" as const,
      id: row.id,
      name: row.username,
      deletedAt: Number(row.deletedAt ?? 0),
    }));
  }

  async restoreOwned(userId: string, entityType: TrashEntityType, id: string): Promise<boolean> {
    const entry = OWNER_SCOPED.find((candidate) => candidate.entityType === entityType);
    if (!entry) {
      return false;
    }
    const updated = await this.db
      .update(entry.table)
      .set({ deletedAt: null })
      .where(and(eq(entry.table.id, id), eq(entry.table.ownerId, userId)))
      .returning({ id: entry.table.id });
    if (updated.length > 0) {
      return true;
    }
    if (entityType === "character") {
      const portraits = await this.db
        .update(characterPortraits)
        .set({ deletedAt: null })
        .where(eq(characterPortraits.id, id))
        .returning({ id: characterPortraits.id });
      return portraits.length > 0;
    }
    return false;
  }

  async restoreOwnedUser(id: string): Promise<boolean> {
    const updated = await this.db
      .update(users)
      .set({ deletedAt: null })
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return updated.length > 0;
  }

  async findParentState(entityType: TrashEntityType, id: string): Promise<{ parentDeleted: boolean }> {
    if (entityType === "scene" || entityType === "track" || entityType === "handout") {
      const table = entityType === "scene" ? scenes : entityType === "track" ? tracks : handouts;
      const rows = await this.db.select().from(table).where(eq(table.id, id)).limit(1);
      const moduleId = rows[0]?.moduleId;
      if (!moduleId) return { parentDeleted: false };
      const parents = await this.db.select({ deletedAt: modules.deletedAt }).from(modules).where(eq(modules.id, moduleId)).limit(1);
      return { parentDeleted: parents[0]?.deletedAt != null };
    }
    if (entityType === "session") {
      const rows = await this.db.select({ moduleId: sessions.moduleId }).from(sessions).where(eq(sessions.id, id)).limit(1);
      const moduleId = rows[0]?.moduleId;
      if (!moduleId) return { parentDeleted: false };
      const parents = await this.db.select({ deletedAt: modules.deletedAt }).from(modules).where(eq(modules.id, moduleId)).limit(1);
      return { parentDeleted: parents[0]?.deletedAt != null };
    }
    return { parentDeleted: false };
  }
}

export const trashSoftDeleteHelpers = { OWNER_SCOPED };
