import { eq, and, or, gt, asc, isNull } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import {
  characters,
  characterPortraits,
  moduleCharacters,
  importStagings,
  modules,
  mediaAssets,
  sessionCharacters,
  sessionClaims,
  checkRequests,
  sessionMessages,
} from "@/platform/db/schema";
import {
  CharacterNotFoundError,
  PortraitNotFoundError,
  StagingConsumedError,
  ModuleCharacterNotLinkedError,
} from "../domain/errors";
import type { CharactersRepository, CursorPageOptions } from "../application/ports";



function paginated<T extends { id: string }>(items: T[], limit: number) {
  const hasMore = items.length > limit;
  const returnedItems = hasMore ? items.slice(0, limit) : items;
  const lastItem = returnedItems[returnedItems.length - 1];
  return {
    items: returnedItems,
    nextCursor: hasMore && lastItem ? lastItem.id : null,
  };
}

export class DrizzleCharactersRepository implements CharactersRepository {
  constructor(private readonly db: DbClient) {}

  async findCharacterById(id: string) {
    const result = await this.db
      .select()
      .from(characters)
      .where(eq(characters.id, id))
      .limit(1);
    return result[0] || null;
  }

  async saveCharacter(character: typeof characters.$inferInsert): Promise<void> {
    await this.db.insert(characters).values(character);
  }

  async updateCharacter(
    id: string,
    updates: Partial<Omit<typeof characters.$inferInsert, "id" | "createdAt" | "ruleId">>
  ) {
    const result = await this.db
      .update(characters)
      .set(updates)
      .where(eq(characters.id, id))
      .returning();
    const row = result[0];
    if (!row) {
      throw new CharacterNotFoundError();
    }
    return row;
  }

  async isCharacterInUse(id: string): Promise<boolean> {
    const [sc, claim, req, msg] = await Promise.all([
      this.db.select({ id: sessionCharacters.id }).from(sessionCharacters).where(eq(sessionCharacters.characterId, id)).limit(1),
      this.db.select({ id: sessionClaims.id }).from(sessionClaims).where(eq(sessionClaims.characterId, id)).limit(1),
      this.db.select({ id: checkRequests.id }).from(checkRequests).where(eq(checkRequests.characterId, id)).limit(1),
      this.db.select({ id: sessionMessages.id }).from(sessionMessages).where(eq(sessionMessages.characterId, id)).limit(1),
    ]);
    return sc.length > 0 || claim.length > 0 || req.length > 0 || msg.length > 0;
  }

  async deleteCharacter(id: string): Promise<void> {
    const result = await this.db
      .delete(characters)
      .where(eq(characters.id, id))
      .returning();
    if (result.length === 0) {
      throw new CharacterNotFoundError();
    }
  }

  async listCharacters(options: CursorPageOptions) {
    const limit = options.limit;
    let items: (typeof characters.$inferSelect)[];
    if (options.cursor) {
      const cursorRow = await this.db
        .select()
        .from(characters)
        .where(eq(characters.id, options.cursor))
        .limit(1);
      const c = cursorRow[0];
      if (!c) {
        return { items: [], nextCursor: null };
      }
      items = await this.db
        .select()
        .from(characters)
        .where(
          or(
            gt(characters.createdAt, c.createdAt),
            and(eq(characters.createdAt, c.createdAt), gt(characters.id, c.id))
          )
        )
        .orderBy(asc(characters.createdAt), asc(characters.id))
        .limit(limit + 1);
    } else if (options.offset !== undefined) {
      items = await this.db
        .select()
        .from(characters)
        .orderBy(asc(characters.createdAt), asc(characters.id))
        .limit(limit + 1)
        .offset(options.offset);
    } else {
      items = await this.db
        .select()
        .from(characters)
        .orderBy(asc(characters.createdAt), asc(characters.id))
        .limit(limit + 1);
    }
    return paginated(items, limit);
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

  async findPortraitById(id: string) {
    const result = await this.db
      .select()
      .from(characterPortraits)
      .where(eq(characterPortraits.id, id))
      .limit(1);
    return result[0] || null;
  }

  async savePortrait(portrait: typeof characterPortraits.$inferInsert): Promise<void> {
    await this.db.insert(characterPortraits).values(portrait);
  }

  async unsetDefaultPortraits(characterId: string): Promise<void> {
    await this.db
      .update(characterPortraits)
      .set({ isDefault: 0 })
      .where(eq(characterPortraits.characterId, characterId));
  }

  async deletePortrait(id: string): Promise<void> {
    const result = await this.db
      .delete(characterPortraits)
      .where(eq(characterPortraits.id, id))
      .returning();
    if (result.length === 0) {
      throw new PortraitNotFoundError();
    }
  }

  async listPortraitsByCharacterId(characterId: string) {
    return await this.db
      .select()
      .from(characterPortraits)
      .where(eq(characterPortraits.characterId, characterId));
  }

  async findStagingById(id: string) {
    const result = await this.db
      .select()
      .from(importStagings)
      .where(eq(importStagings.id, id))
      .limit(1);
    return result[0] || null;
  }

  async saveStaging(staging: typeof importStagings.$inferInsert): Promise<void> {
    await this.db.insert(importStagings).values(staging);
  }

  async consumeStaging(id: string, consumedAt: number): Promise<void> {
    const result = await this.db
      .update(importStagings)
      .set({ consumedAt })
      .where(and(eq(importStagings.id, id), isNull(importStagings.consumedAt)))
      .returning();
    if (result.length === 0) {
      throw new StagingConsumedError();
    }
  }

  async moduleExists(moduleId: string): Promise<boolean> {
    const result = await this.db
      .select({ id: modules.id })
      .from(modules)
      .where(eq(modules.id, moduleId))
      .limit(1);
    return result.length > 0;
  }

  async findModule(id: string): Promise<{ id: string; ruleId: string } | null> {
    const result = await this.db
      .select({ id: modules.id, ruleId: modules.ruleId })
      .from(modules)
      .where(eq(modules.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  async findModuleCharacterLink(moduleId: string, characterId: string) {
    const result = await this.db
      .select()
      .from(moduleCharacters)
      .where(
        and(
          eq(moduleCharacters.moduleId, moduleId),
          eq(moduleCharacters.characterId, characterId)
        )
      )
      .limit(1);
    return result[0] || null;
  }

  async linkCharacterToModule(link: typeof moduleCharacters.$inferInsert): Promise<void> {
    await this.db.insert(moduleCharacters).values(link);
  }

  async unlinkModuleCharacter(moduleId: string, characterId: string): Promise<void> {
    const result = await this.db
      .delete(moduleCharacters)
      .where(
        and(
          eq(moduleCharacters.moduleId, moduleId),
          eq(moduleCharacters.characterId, characterId)
        )
      )
      .returning();
    if (result.length === 0) {
      throw new ModuleCharacterNotLinkedError();
    }
  }

  async listModuleCharacters(moduleId: string, options: CursorPageOptions) {
    const limit = options.limit;
    let items: (typeof characters.$inferSelect)[];
    if (options.cursor) {
      const cursorRow = await this.db
        .select()
        .from(characters)
        .where(eq(characters.id, options.cursor))
        .limit(1);
      const c = cursorRow[0];
      if (!c) {
        return { items: [], nextCursor: null };
      }
      items = await this.db
        .select({
          id: characters.id,
          name: characters.name,
          kind: characters.kind,
          ruleId: characters.ruleId,
          sheetJson: characters.sheetJson,
          createdAt: characters.createdAt,
        })
        .from(moduleCharacters)
        .innerJoin(characters, eq(moduleCharacters.characterId, characters.id))
        .where(
          and(
            eq(moduleCharacters.moduleId, moduleId),
            or(
              gt(characters.createdAt, c.createdAt),
              and(eq(characters.createdAt, c.createdAt), gt(characters.id, c.id))
            )
          )
        )
        .orderBy(asc(characters.createdAt), asc(characters.id))
        .limit(limit + 1);
    } else if (options.offset !== undefined) {
      items = await this.db
        .select({
          id: characters.id,
          name: characters.name,
          kind: characters.kind,
          ruleId: characters.ruleId,
          sheetJson: characters.sheetJson,
          createdAt: characters.createdAt,
        })
        .from(moduleCharacters)
        .innerJoin(characters, eq(moduleCharacters.characterId, characters.id))
        .where(eq(moduleCharacters.moduleId, moduleId))
        .orderBy(asc(characters.createdAt), asc(characters.id))
        .limit(limit + 1)
        .offset(options.offset);
    } else {
      items = await this.db
        .select({
          id: characters.id,
          name: characters.name,
          kind: characters.kind,
          ruleId: characters.ruleId,
          sheetJson: characters.sheetJson,
          createdAt: characters.createdAt,
        })
        .from(moduleCharacters)
        .innerJoin(characters, eq(moduleCharacters.characterId, characters.id))
        .where(eq(moduleCharacters.moduleId, moduleId))
        .orderBy(asc(characters.createdAt), asc(characters.id))
        .limit(limit + 1);
    }
    return paginated(items, limit);

  }
}
