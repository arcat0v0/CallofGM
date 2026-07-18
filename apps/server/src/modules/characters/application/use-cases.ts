import { type IdGenerator, type Clock } from "@/platform/ports";
import { type RuleRegistry } from "@/rules/registry";
import { type DrizzleCharactersRepository } from "../infrastructure/drizzle-characters-repository";
import {
  CharacterNotFoundError,
  StagingRecordNotFoundError,
} from "../domain/errors";
import { type RuleId } from "@cogm/shared";

export class CreateCharacterUseCase {
  constructor(
    private readonly repo: DrizzleCharactersRepository,
    private readonly ruleRegistry: RuleRegistry,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: {
    name: string;
    kind: string;
    ruleId: RuleId;
    sheetData: unknown;
  }) {
    const sheetData = this.ruleRegistry.get(input.ruleId).characterSheetSchema.parse(input.sheetData);
    const id = this.idGenerator.nextId();
    const character = {
      id,
      name: input.name,
      kind: input.kind,
      ruleId: input.ruleId,
      sheetJson: JSON.stringify(sheetData),
      createdAt: this.clock.nowEpochMs(),
    };
    await this.repo.saveCharacter(character);
    return character;
  }
}

export class UpdateCharacterUseCase {
  constructor(
    private readonly repo: DrizzleCharactersRepository,
    private readonly ruleRegistry: RuleRegistry
  ) {}

  async execute(
    id: string,
    input: {
      name?: string;
      kind?: string;
      sheetData?: unknown;
    }
  ) {
    const updates: { name?: string; kind?: string; sheetJson?: string } = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.kind !== undefined) updates.kind = input.kind;
    if (input.sheetData !== undefined) {
      const character = await this.repo.findCharacterById(id);
      if (!character) {
        throw new CharacterNotFoundError();
      }
      const sheetData = this.ruleRegistry
        .get(character.ruleId as RuleId)
        .characterSheetSchema.parse(input.sheetData);
      updates.sheetJson = JSON.stringify(sheetData);
    }
    return await this.repo.updateCharacter(id, updates);
  }
}

export class DeleteCharacterUseCase {
  constructor(private readonly repo: DrizzleCharactersRepository) {}

  async execute(id: string) {
    await this.repo.deleteCharacter(id);
  }
}

export class GetCharacterUseCase {
  constructor(private readonly repo: DrizzleCharactersRepository) {}

  async execute(id: string) {
    const character = await this.repo.findCharacterById(id);
    if (!character) {
      throw new CharacterNotFoundError();
    }
    const portraits = await this.repo.listPortraitsByCharacterId(id);
    return {
      ...character,
      portraits,
    };
  }
}

export class ListCharactersUseCase {
  constructor(private readonly repo: DrizzleCharactersRepository) {}

  async execute() {
    return await this.repo.listCharacters();
  }
}

export class AddPortraitUseCase {
  constructor(
    private readonly repo: DrizzleCharactersRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: {
    characterId: string;
    expressionKey: string;
    portraitAssetId: string;
    isDefault: boolean;
  }) {
    const character = await this.repo.findCharacterById(input.characterId);
    if (!character) {
      throw new CharacterNotFoundError();
    }
    if (input.isDefault) {
      await this.repo.unsetDefaultPortraits(input.characterId);
    }
    const id = this.idGenerator.nextId();
    const portrait = {
      id,
      characterId: input.characterId,
      expressionKey: input.expressionKey,
      portraitAssetId: input.portraitAssetId,
      isDefault: input.isDefault ? 1 : 0,
      createdAt: this.clock.nowEpochMs(),
    };
    await this.repo.savePortrait(portrait);
    return portrait;
  }
}

export class DeletePortraitUseCase {
  constructor(private readonly repo: DrizzleCharactersRepository) {}

  async execute(id: string) {
    await this.repo.deletePortrait(id);
  }
}

export class ImportPreviewUseCase {
  constructor(
    private readonly repo: DrizzleCharactersRepository,
    private readonly ruleRegistry: RuleRegistry,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: {
    fileBuffer: ArrayBuffer;
    ruleId: RuleId;
  }) {
    const ruleSystem = this.ruleRegistry.get(input.ruleId);
    const preview = await ruleSystem.parseCharacterSheet(input.fileBuffer);
    const importToken = this.idGenerator.nextId();
    await this.repo.saveStaging({
      id: importToken,
      characterName: preview.characterName,
      sheetJson: JSON.stringify(preview.sheetData),
      createdAt: this.clock.nowEpochMs(),
    });
    return {
      importToken,
      preview,
    };
  }
}

export class ImportConfirmUseCase {
  constructor(
    private readonly repo: DrizzleCharactersRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: {
    importToken: string;
    kind: string;
    ruleId: RuleId;
    moduleId?: string;
  }) {
    const staging = await this.repo.findStagingById(input.importToken);
    if (!staging) {
      throw new StagingRecordNotFoundError();
    }
    const characterId = this.idGenerator.nextId();
    const character = {
      id: characterId,
      name: staging.characterName,
      kind: input.kind,
      ruleId: input.ruleId,
      sheetJson: staging.sheetJson,
      createdAt: this.clock.nowEpochMs(),
    };
    await this.repo.saveCharacter(character);
    if (input.moduleId) {
      const linkId = this.idGenerator.nextId();
      await this.repo.linkCharacterToModule({
        id: linkId,
        moduleId: input.moduleId,
        characterId,
        createdAt: this.clock.nowEpochMs(),
      });
    }
    await this.repo.deleteStaging(input.importToken);
    return character;
  }
}
