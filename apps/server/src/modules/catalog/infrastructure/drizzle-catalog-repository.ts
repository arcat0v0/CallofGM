import { eq, and, or, gt, asc, count, isNotNull, max } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import {
  modules,
  scenes,
  tracks,
  handouts,
  mediaAssets,
  sessions,
  moduleCharacters,
} from "@/platform/db/schema";
import type {
  CatalogRepository,
  CatalogModule,
  CatalogScene,
  CatalogTrack,
  CatalogHandout,
  ModuleSummary
} from "../application/ports";
import {
  ModuleNotFoundError,
  SceneNotFoundError,
  TrackNotFoundError,
  HandoutNotFoundError
} from "../domain/errors";


function paginated<T extends { id: string }>(items: T[], limit: number) {
  const hasMore = items.length > limit;
  const returnedItems = hasMore ? items.slice(0, limit) : items;
  const lastItem = returnedItems[returnedItems.length - 1];
  return {
    items: returnedItems,
    nextCursor: hasMore && lastItem ? lastItem.id : null
  };
}

type CursorPageOptions = {
  limit: number;
  offset?: number;
  cursor?: string;
};

function mapTrackRow(row: {
  track: typeof tracks.$inferSelect;
  assetSize: number | null;
  assetCreatedAt: number | null;
}): CatalogTrack {
  return {
    id: row.track.id,
    moduleId: row.track.moduleId,
    name: row.track.name,
    audioAssetId: row.track.audioAssetId,
    type: row.track.type as "bgm" | "se",
    duration: row.track.duration,
    audioSize: row.assetSize,
    audioUploadedAt: row.assetCreatedAt,
    createdAt: row.track.createdAt,
  };
}
export class DrizzleCatalogRepository implements CatalogRepository {
  constructor(private readonly db: DbClient) {}

  async findModuleById(id: string): Promise<CatalogModule | null> {
    const result = await this.db
      .select()
      .from(modules)
      .where(eq(modules.id, id))
      .limit(1);
    return result[0] || null;
  }

  async saveModule(module: CatalogModule): Promise<void> {
    await this.db.insert(modules).values(module);
  }

  async updateModule(
    id: string,
    updates: Partial<Omit<CatalogModule, "id" | "createdAt">>
  ): Promise<CatalogModule> {
    const result = await this.db
      .update(modules)
      .set(updates)
      .where(eq(modules.id, id))
      .returning();
    const row = result[0];
    if (!row) {
      throw new ModuleNotFoundError();
    }
    return row;
  }

  async isModuleInUse(id: string): Promise<boolean> {
    const rows = await this.db.select({ id: sessions.id }).from(sessions).where(eq(sessions.moduleId, id)).limit(1);
    return rows.length > 0;
  }

  async deleteModule(id: string): Promise<void> {
    const result = await this.db
      .delete(modules)
      .where(eq(modules.id, id))
      .returning();
    if (result.length === 0) {
      throw new ModuleNotFoundError();
    }
  }

  async listModules(options: {
    limit: number;
    offset?: number;
    cursor?: string;
  }): Promise<{ items: CatalogModule[]; nextCursor: string | null }> {
    const limit = options.limit;
    let items: CatalogModule[];
    if (options.cursor) {
      const cursorModule = await this.db
        .select()
        .from(modules)
        .where(eq(modules.id, options.cursor))
        .limit(1);
      const c = cursorModule[0];
      if (c) {
        items = await this.db
          .select()
          .from(modules)
          .where(
            or(
              gt(modules.createdAt, c.createdAt),
              and(eq(modules.createdAt, c.createdAt), gt(modules.id, c.id))
            )
          )
          .orderBy(asc(modules.createdAt), asc(modules.id))
          .limit(limit + 1);
      } else {
        items = [];
      }
    } else if (options.offset !== undefined) {
      items = await this.db
        .select()
        .from(modules)
        .orderBy(asc(modules.createdAt), asc(modules.id))
        .limit(limit + 1)
        .offset(options.offset);
    } else {
      items = await this.db
        .select()
        .from(modules)
        .orderBy(asc(modules.createdAt), asc(modules.id))
        .limit(limit + 1);
    }

    return paginated(items, limit);
  }

  async listModuleSummaries(): Promise<ModuleSummary[]> {
    const moduleRows = await this.db.select().from(modules);
    if (moduleRows.length === 0) {
      return [];
    }
    const [sceneAgg, handoutAgg, trackAgg, characterAgg, coverRows] = await Promise.all([
      this.db
        .select({ moduleId: scenes.moduleId, total: count(), latest: max(scenes.createdAt) })
        .from(scenes)
        .groupBy(scenes.moduleId),
      this.db
        .select({ moduleId: handouts.moduleId, total: count(), latest: max(handouts.createdAt) })
        .from(handouts)
        .groupBy(handouts.moduleId),
      this.db
        .select({ moduleId: tracks.moduleId, total: count(), latest: max(tracks.createdAt) })
        .from(tracks)
        .groupBy(tracks.moduleId),
      this.db
        .select({ moduleId: moduleCharacters.moduleId, total: count(), latest: max(moduleCharacters.createdAt) })
        .from(moduleCharacters)
        .groupBy(moduleCharacters.moduleId),
      this.db
        .select({ moduleId: scenes.moduleId, bgAssetId: scenes.bgAssetId })
        .from(scenes)
        .where(isNotNull(scenes.bgAssetId))
        .orderBy(asc(scenes.sortOrder), asc(scenes.createdAt), asc(scenes.id)),
    ]);

    const toMap = <T extends { moduleId: string; total: number; latest: number | null }>(rows: T[]) =>
      new Map(rows.map((row) => [row.moduleId, row]));
    const sceneMap = toMap(sceneAgg);
    const handoutMap = toMap(handoutAgg);
    const trackMap = toMap(trackAgg);
    const characterMap = toMap(characterAgg);
    const coverMap = new Map<string, string>();
    for (const row of coverRows) {
      if (row.bgAssetId && !coverMap.has(row.moduleId)) {
        coverMap.set(row.moduleId, row.bgAssetId);
      }
    }

    return moduleRows.map((module) => {
      const latest = Math.max(
        module.createdAt,
        sceneMap.get(module.id)?.latest ?? 0,
        handoutMap.get(module.id)?.latest ?? 0,
        trackMap.get(module.id)?.latest ?? 0,
        characterMap.get(module.id)?.latest ?? 0
      );
      return {
        moduleId: module.id,
        sceneCount: sceneMap.get(module.id)?.total ?? 0,
        handoutCount: handoutMap.get(module.id)?.total ?? 0,
        trackCount: trackMap.get(module.id)?.total ?? 0,
        characterCount: characterMap.get(module.id)?.total ?? 0,
        coverAssetId: coverMap.get(module.id) ?? null,
        updatedAt: latest,
      };
    });
  }

  async findSceneById(id: string): Promise<CatalogScene | null> {
    const result = await this.db
      .select()
      .from(scenes)
      .where(eq(scenes.id, id))
      .limit(1);
    return result[0] || null;
  }

  async saveScene(scene: CatalogScene): Promise<void> {
    await this.db.insert(scenes).values(scene);
  }

  async updateScene(
    id: string,
    updates: Partial<Omit<CatalogScene, "id" | "moduleId" | "createdAt">>
  ): Promise<CatalogScene> {
    const result = await this.db
      .update(scenes)
      .set(updates)
      .where(eq(scenes.id, id))
      .returning();
    const row = result[0];
    if (!row) {
      throw new SceneNotFoundError();
    }
    return row;
  }

  async deleteScene(id: string): Promise<void> {
    const result = await this.db
      .delete(scenes)
      .where(eq(scenes.id, id))
      .returning();
    if (result.length === 0) {
      throw new SceneNotFoundError();
    }
  }

  async listScenesByModuleId(
    moduleId: string,
    options: CursorPageOptions
  ): Promise<{ items: CatalogScene[]; nextCursor: string | null }> {
    const limit = options.limit;
    let items: CatalogScene[];
    if (options.cursor) {
      const cursorRow = await this.db
        .select()
        .from(scenes)
        .where(eq(scenes.id, options.cursor))
        .limit(1);
      const c = cursorRow[0];
      if (!c) {
        return { items: [], nextCursor: null };
      }
      items = await this.db
        .select()
        .from(scenes)
        .where(
          and(
            eq(scenes.moduleId, moduleId),
            or(
              gt(scenes.sortOrder, c.sortOrder),
              and(eq(scenes.sortOrder, c.sortOrder), gt(scenes.createdAt, c.createdAt)),
              and(
                eq(scenes.sortOrder, c.sortOrder),
                eq(scenes.createdAt, c.createdAt),
                gt(scenes.id, c.id)
              )
            )
          )
        )
        .orderBy(asc(scenes.sortOrder), asc(scenes.createdAt), asc(scenes.id))
        .limit(limit + 1);
    } else if (options.offset !== undefined) {
      items = await this.db
        .select()
        .from(scenes)
        .where(eq(scenes.moduleId, moduleId))
        .orderBy(asc(scenes.sortOrder), asc(scenes.createdAt), asc(scenes.id))
        .limit(limit + 1)
        .offset(options.offset);
    } else {
      items = await this.db
        .select()
        .from(scenes)
        .where(eq(scenes.moduleId, moduleId))
        .orderBy(asc(scenes.sortOrder), asc(scenes.createdAt), asc(scenes.id))
        .limit(limit + 1);
    }
    return paginated(items, limit);
  }

  async findTrackById(id: string): Promise<CatalogTrack | null> {
    const rows = await this.db
      .select({ track: tracks, assetSize: mediaAssets.size, assetCreatedAt: mediaAssets.createdAt })
      .from(tracks)
      .leftJoin(mediaAssets, eq(tracks.audioAssetId, mediaAssets.id))
      .where(eq(tracks.id, id))
      .limit(1);
    const row = rows[0];
    return row ? mapTrackRow(row) : null;
  }

  async saveTrack(track: CatalogTrack): Promise<void> {
    await this.db.insert(tracks).values({
      id: track.id,
      moduleId: track.moduleId,
      name: track.name,
      audioAssetId: track.audioAssetId,
      type: track.type,
      duration: track.duration,
      createdAt: track.createdAt,
    });
  }

  async updateTrack(
    id: string,
    updates: Partial<Omit<CatalogTrack, "id" | "moduleId" | "createdAt">>
  ): Promise<CatalogTrack> {
    const { audioSize: _audioSize, audioUploadedAt: _audioUploadedAt, ...columns } = updates;
    const result = await this.db
      .update(tracks)
      .set(columns)
      .where(eq(tracks.id, id))
      .returning({ id: tracks.id });
    if (result.length === 0) {
      throw new TrackNotFoundError();
    }
    const updated = await this.findTrackById(id);
    if (!updated) {
      throw new TrackNotFoundError();
    }
    return updated;
  }

  async deleteTrack(id: string): Promise<void> {
    const result = await this.db
      .delete(tracks)
      .where(eq(tracks.id, id))
      .returning();
    if (result.length === 0) {
      throw new TrackNotFoundError();
    }
  }

  async listTracksByModuleId(
    moduleId: string,
    options: CursorPageOptions
  ): Promise<{ items: CatalogTrack[]; nextCursor: string | null }> {
    const limit = options.limit;
    const selectTracks = () =>
      this.db
        .select({ track: tracks, assetSize: mediaAssets.size, assetCreatedAt: mediaAssets.createdAt })
        .from(tracks)
        .leftJoin(mediaAssets, eq(tracks.audioAssetId, mediaAssets.id));
    let rows: Array<Parameters<typeof mapTrackRow>[0]>;
    if (options.cursor) {
      const cursorRow = await selectTracks().where(eq(tracks.id, options.cursor)).limit(1);
      const c = cursorRow[0]?.track;
      if (!c) {
        return { items: [], nextCursor: null };
      }
      rows = await selectTracks()
        .where(
          and(
            eq(tracks.moduleId, moduleId),
            or(
              gt(tracks.createdAt, c.createdAt),
              and(eq(tracks.createdAt, c.createdAt), gt(tracks.id, c.id))
            )
          )
        )
        .orderBy(asc(tracks.createdAt), asc(tracks.id))
        .limit(limit + 1);
    } else if (options.offset !== undefined) {
      rows = await selectTracks()
        .where(eq(tracks.moduleId, moduleId))
        .orderBy(asc(tracks.createdAt), asc(tracks.id))
        .limit(limit + 1)
        .offset(options.offset);
    } else {
      rows = await selectTracks()
        .where(eq(tracks.moduleId, moduleId))
        .orderBy(asc(tracks.createdAt), asc(tracks.id))
        .limit(limit + 1);
    }
    return paginated(
      rows.map((row) => mapTrackRow(row)),
      limit
    );
  }

  async findHandoutById(id: string): Promise<CatalogHandout | null> {
    const result = await this.db
      .select()
      .from(handouts)
      .where(eq(handouts.id, id))
      .limit(1);
    return result[0] || null;
  }

  async saveHandout(handout: CatalogHandout): Promise<void> {
    await this.db.insert(handouts).values(handout);
  }

  async updateHandout(
    id: string,
    updates: Partial<Omit<CatalogHandout, "id" | "moduleId" | "createdAt">>
  ): Promise<CatalogHandout> {
    const result = await this.db
      .update(handouts)
      .set(updates)
      .where(eq(handouts.id, id))
      .returning();
    const row = result[0];
    if (!row) {
      throw new HandoutNotFoundError();
    }
    return row;
  }

  async deleteHandout(id: string): Promise<void> {
    const result = await this.db
      .delete(handouts)
      .where(eq(handouts.id, id))
      .returning();
    if (result.length === 0) {
      throw new HandoutNotFoundError();
    }
  }

  async listHandoutsByModuleId(
    moduleId: string,
    options: CursorPageOptions
  ): Promise<{ items: CatalogHandout[]; nextCursor: string | null }> {
    const limit = options.limit;
    let items: CatalogHandout[];
    if (options.cursor) {
      const cursorRow = await this.db
        .select()
        .from(handouts)
        .where(eq(handouts.id, options.cursor))
        .limit(1);
      const c = cursorRow[0];
      if (!c) {
        return { items: [], nextCursor: null };
      }
      items = await this.db
        .select()
        .from(handouts)
        .where(
          and(
            eq(handouts.moduleId, moduleId),
            or(
              gt(handouts.createdAt, c.createdAt),
              and(eq(handouts.createdAt, c.createdAt), gt(handouts.id, c.id))
            )
          )
        )
        .orderBy(asc(handouts.createdAt), asc(handouts.id))
        .limit(limit + 1);
    } else if (options.offset !== undefined) {
      items = await this.db
        .select()
        .from(handouts)
        .where(eq(handouts.moduleId, moduleId))
        .orderBy(asc(handouts.createdAt), asc(handouts.id))
        .limit(limit + 1)
        .offset(options.offset);
    } else {
      items = await this.db
        .select()
        .from(handouts)
        .where(eq(handouts.moduleId, moduleId))
        .orderBy(asc(handouts.createdAt), asc(handouts.id))
        .limit(limit + 1);
    }
    return paginated(items, limit);
  }

  async mediaAssetExists(id: string): Promise<boolean> {
    return (await this.findMediaAsset(id)) !== null;
  }

  async findMediaAsset(id: string): Promise<{ id: string; purpose: string; mimeType: string } | null> {
    const result = await this.db
      .select({
        id: mediaAssets.id,
        purpose: mediaAssets.purpose,
        mimeType: mediaAssets.mimeType,
      })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, id))
      .limit(1);
    return result[0] ?? null;
  }
}
