import { eq } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import {
  characters,
  characterPortraits,
  moduleCharacters,
  importStagings,
} from "@/platform/db/schema";
import {
  CharacterNotFoundError,
  PortraitNotFoundError,
  StagingRecordNotFoundError,
} from "../domain/errors";

export class DrizzleCharactersRepository {
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

  async deleteCharacter(id: string): Promise<void> {
    const result = await this.db
      .delete(characters)
      .where(eq(characters.id, id))
      .returning();
    if (result.length === 0) {
      throw new CharacterNotFoundError();
    }
  }

  async listCharacters() {
    return await this.db.select().from(characters);
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

  async deleteStaging(id: string): Promise<void> {
    const result = await this.db
      .delete(importStagings)
      .where(eq(importStagings.id, id))
      .returning();
    if (result.length === 0) {
      throw new StagingRecordNotFoundError();
    }
  }

  async linkCharacterToModule(link: typeof moduleCharacters.$inferInsert): Promise<void> {
    await this.db.insert(moduleCharacters).values(link);
  }
}
