import { eq, and, or, gt, asc, desc } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import {
  modules,
  scenes,
  tracks,
  handouts,
  mediaAssets
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

    const hasMore = items.length > limit;
    const returnedItems = hasMore ? items.slice(0, limit) : items;
    const lastItem = returnedItems[returnedItems.length - 1];
    const nextCursor = (hasMore && lastItem) ? lastItem.id : null;

    return {
      items: returnedItems,
      nextCursor
    };
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

  async listScenesByModuleId(moduleId: string): Promise<CatalogScene[]> {
    return this.db
      .select()
      .from(scenes)
      .where(eq(scenes.moduleId, moduleId))
      .orderBy(asc(scenes.sortOrder), asc(scenes.createdAt));
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

  async listTracksByModuleId(moduleId: string): Promise<CatalogTrack[]> {
    const result = await this.db
      .select()
      .from(tracks)
      .where(eq(tracks.moduleId, moduleId))
      .orderBy(asc(tracks.createdAt));
    return result.map(t => ({
      ...t,
      type: t.type as "bgm" | "se"
    }));
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

  async listHandoutsByModuleId(moduleId: string): Promise<CatalogHandout[]> {
    return this.db
      .select()
      .from(handouts)
      .where(eq(handouts.moduleId, moduleId))
      .orderBy(asc(handouts.createdAt));
  }

  async mediaAssetExists(id: string): Promise<boolean> {
    const result = await this.db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, id))
      .limit(1);
    return result.length > 0;
  }
}
