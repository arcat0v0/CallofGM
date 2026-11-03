import { and, asc, eq, inArray, isNull, desc, sql } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import {
  templates,
  templateVersions,
  templateScenes,
  templateTracks,
  templateHandouts,
  templateCharacters,
  characters,
} from "@/platform/db/schema";
import type {
  TemplatesRepository,
  TemplateRecord,
  TemplateVersionRecord,
  TemplateSceneRecord,
  TemplateTrackRecord,
  TemplateHandoutRecord,
  TemplateCharacterRecord,
  TemplateSummaryCounts,
} from "../application/ports";

export class DrizzleTemplatesRepository implements TemplatesRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: string): Promise<TemplateRecord | null> {
    const rows = await this.db
      .select()
      .from(templates)
      .where(and(eq(templates.id, id), isNull(templates.deletedAt)))
      .limit(1);
    return (rows[0] as TemplateRecord | undefined) ?? null;
  }

  async listByOwner(ownerId: string, limit: number, cursor?: string) {
    const rows = await this.db
      .select()
      .from(templates)
      .where(and(eq(templates.ownerId, ownerId), isNull(templates.deletedAt)))
      .orderBy(asc(templates.createdAt), asc(templates.id));
    const filtered = cursor ? rows.filter((row) => row.id > cursor) : rows;
    const hasMore = filtered.length > limit;
    const items = (hasMore ? filtered.slice(0, limit) : filtered) as TemplateRecord[];
    const last = items[items.length - 1];
    return { items, nextCursor: hasMore && last ? last.id : null };
  }

  async save(template: typeof templates.$inferInsert): Promise<void> {
    await this.db.insert(templates).values(template);
  }

  async update(id: string, patch: Partial<Omit<TemplateRecord, "id" | "createdAt">>): Promise<void> {
    await this.db.update(templates).set(patch).where(eq(templates.id, id));
  }

  async softDelete(id: string, deletedAt: number): Promise<void> {
    await this.db
      .update(templates)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(eq(templates.id, id));
  }

  async counts(templateId: string): Promise<TemplateSummaryCounts> {
    const [sceneRows, trackRows, handoutRows, characterRows] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(templateScenes)
        .where(and(eq(templateScenes.templateId, templateId), isNull(templateScenes.deletedAt))),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(templateTracks)
        .where(and(eq(templateTracks.templateId, templateId), isNull(templateTracks.deletedAt))),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(templateHandouts)
        .where(and(eq(templateHandouts.templateId, templateId), isNull(templateHandouts.deletedAt))),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(templateCharacters)
        .where(and(eq(templateCharacters.templateId, templateId), isNull(templateCharacters.deletedAt))),
    ]);
    return {
      sceneCount: Number(sceneRows[0]?.count ?? 0),
      trackCount: Number(trackRows[0]?.count ?? 0),
      handoutCount: Number(handoutRows[0]?.count ?? 0),
      characterCount: Number(characterRows[0]?.count ?? 0),
    };
  }

  async saveVersion(version: typeof templateVersions.$inferInsert): Promise<void> {
    await this.db.insert(templateVersions).values(version).onConflictDoNothing();
  }

  async listVersions(templateId: string): Promise<TemplateVersionRecord[]> {
    const rows = await this.db
      .select()
      .from(templateVersions)
      .where(eq(templateVersions.templateId, templateId))
      .orderBy(desc(templateVersions.version));
    return rows as TemplateVersionRecord[];
  }

  async findVersion(templateId: string, version: number): Promise<TemplateVersionRecord | null> {
    const rows = await this.db
      .select()
      .from(templateVersions)
      .where(and(eq(templateVersions.templateId, templateId), eq(templateVersions.version, version)))
      .limit(1);
    return (rows[0] as TemplateVersionRecord | undefined) ?? null;
  }

  async listScenes(templateId: string): Promise<TemplateSceneRecord[]> {
    const rows = await this.db
      .select()
      .from(templateScenes)
      .where(and(eq(templateScenes.templateId, templateId), isNull(templateScenes.deletedAt)))
      .orderBy(asc(templateScenes.sortOrder));
    return rows as TemplateSceneRecord[];
  }

  async saveScene(scene: typeof templateScenes.$inferInsert): Promise<void> {
    await this.db.insert(templateScenes).values(scene);
  }

  async listTracks(templateId: string): Promise<TemplateTrackRecord[]> {
    const rows = await this.db
      .select()
      .from(templateTracks)
      .where(and(eq(templateTracks.templateId, templateId), isNull(templateTracks.deletedAt)));
    return rows as TemplateTrackRecord[];
  }

  async saveTrack(track: typeof templateTracks.$inferInsert): Promise<void> {
    await this.db.insert(templateTracks).values(track);
  }

  async listHandouts(templateId: string): Promise<TemplateHandoutRecord[]> {
    const rows = await this.db
      .select()
      .from(templateHandouts)
      .where(and(eq(templateHandouts.templateId, templateId), isNull(templateHandouts.deletedAt)));
    return rows as TemplateHandoutRecord[];
  }

  async saveHandout(handout: typeof templateHandouts.$inferInsert): Promise<void> {
    await this.db.insert(templateHandouts).values(handout);
  }

  async listCharacters(templateId: string): Promise<TemplateCharacterRecord[]> {
    const rows = await this.db
      .select({
        characterId: characters.id,
        name: characters.name,
        kind: characters.kind,
        ruleId: characters.ruleId,
        sheetJson: characters.sheetJson,
        sheetVersion: characters.sheetVersion,
      })
      .from(templateCharacters)
      .innerJoin(characters, eq(templateCharacters.characterId, characters.id))
      .where(
        and(
          eq(templateCharacters.templateId, templateId),
          isNull(templateCharacters.deletedAt),
          isNull(characters.deletedAt)
        )
      );
    return rows as TemplateCharacterRecord[];
  }

  async linkCharacter(templateId: string, characterId: string): Promise<void> {
    await this.db
      .insert(templateCharacters)
      .values({
        id: `${templateId}:${characterId}`,
        templateId,
        characterId,
        deletedAt: null,
        createdAt: Date.now(),
      })
      .onConflictDoNothing();
  }

  async unlinkCharacter(templateId: string, characterId: string): Promise<void> {
    await this.db
      .update(templateCharacters)
      .set({ deletedAt: Date.now() })
      .where(
        and(
          eq(templateCharacters.templateId, templateId),
          eq(templateCharacters.characterId, characterId)
        )
      );
  }
}
