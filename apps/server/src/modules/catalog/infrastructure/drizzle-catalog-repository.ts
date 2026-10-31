import { eq, and, or, gt, asc } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import {
  modules,
  scenes,
  tracks,
  handouts,
  mediaAssets,
  sessions,
} from "@/platform/db/schema";
import type {
  CatalogRepository,
  CatalogModule,
  CatalogScene,
  CatalogTrack,
  CatalogHandout
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
    const result = await this.db
      .select()
      .from(tracks)
      .where(eq(tracks.id, id))
      .limit(1);
    if (!result[0]) return null;
    return {
      ...result[0],
      type: result[0].type as "bgm" | "se"
    };
  }

  async saveTrack(track: CatalogTrack): Promise<void> {
    await this.db.insert(tracks).values(track);
  }

  async updateTrack(
    id: string,
    updates: Partial<Omit<CatalogTrack, "id" | "moduleId" | "createdAt">>
  ): Promise<CatalogTrack> {
    const result = await this.db
      .update(tracks)
      .set(updates)
      .where(eq(tracks.id, id))
      .returning();
    const row = result[0];
    if (!row) {
      throw new TrackNotFoundError();
    }
    return {
      id: row.id,
      moduleId: row.moduleId,
      name: row.name,
      audioAssetId: row.audioAssetId,
      type: row.type as "bgm" | "se",
      duration: row.duration,
      createdAt: row.createdAt
    };
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
    const mapTrack = (t: typeof tracks.$inferSelect): CatalogTrack => ({
      ...t,
      type: t.type as "bgm" | "se"
    });
    let rows: (typeof tracks.$inferSelect)[];
    if (options.cursor) {
      const cursorRow = await this.db
        .select()
        .from(tracks)
        .where(eq(tracks.id, options.cursor))
        .limit(1);
      const c = cursorRow[0];
      if (!c) {
        return { items: [], nextCursor: null };
      }
      rows = await this.db
        .select()
        .from(tracks)
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
      rows = await this.db
        .select()
        .from(tracks)
        .where(eq(tracks.moduleId, moduleId))
        .orderBy(asc(tracks.createdAt), asc(tracks.id))
        .limit(limit + 1)
        .offset(options.offset);
    } else {
      rows = await this.db
        .select()
        .from(tracks)
        .where(eq(tracks.moduleId, moduleId))
        .orderBy(asc(tracks.createdAt), asc(tracks.id))
        .limit(limit + 1);
    }
    return paginated(rows.map(mapTrack), limit);
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
