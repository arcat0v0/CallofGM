import { type IdGenerator, type Clock } from "@/platform/ports";
import { type RuleRegistry } from "@/rules/registry";
import { type CharactersRepository, type CursorPageOptions } from "./ports";
import { AppError } from "@/platform/errors/app-error";
import {
  CharacterNotFoundError,
  StagingRecordNotFoundError,
  StagingExpiredError,
  StagingConsumedError,
  StagingHasErrorsError,
  InvalidKindError,
  ModuleCharacterAlreadyLinkedError,
  StagingOwnerMismatchError,
  InvalidMediaAssetError,
  CharacterRuleMismatchError,
  CharacterInUseError,
} from "../domain/errors";
import { ModuleNotFoundError, MediaAssetNotFoundError } from "@/modules/catalog";
import { type RuleId } from "@cogm/shared";

const STAGING_TTL_MS = 30 * 60 * 1000;

function assertKind(kind: string): asserts kind is "pc" | "npc" {
  if (kind !== "pc" && kind !== "npc") {
    throw new InvalidKindError();
  }
}

function parseStagingErrors(errorsJson: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(errorsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export class CreateCharacterUseCase {
  constructor(
    private readonly repo: CharactersRepository,
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
    assertKind(input.kind);
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
    private readonly repo: CharactersRepository,
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
    if (input.kind !== undefined) {
      assertKind(input.kind);
      updates.kind = input.kind;
    }
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
  constructor(private readonly repo: CharactersRepository) {}
  async execute(id: string) {
    const inUse = await this.repo.isCharacterInUse(id);
    if (inUse) {
      throw new CharacterInUseError();
    }
    await this.repo.deleteCharacter(id);
  }
}

export class GetCharacterUseCase {
  constructor(private readonly repo: CharactersRepository) {}
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
  constructor(private readonly repo: CharactersRepository) {}
  async execute(options: CursorPageOptions) {
    return await this.repo.listCharacters(options);
  }
}

export class AddPortraitUseCase {
  constructor(
    private readonly repo: CharactersRepository,
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
    const asset = await this.repo.findMediaAsset(input.portraitAssetId);
    if (!asset) {
      throw new MediaAssetNotFoundError();
    }
    if (asset.purpose !== "portrait" || !asset.mimeType.startsWith("image/")) {
      throw new InvalidMediaAssetError();
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
  constructor(private readonly repo: CharactersRepository) {}
  async execute(id: string) {
    await this.repo.deletePortrait(id);
  }
}

export class ImportPreviewUseCase {
  constructor(
    private readonly repo: CharactersRepository,
    private readonly ruleRegistry: RuleRegistry,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: {
    fileBuffer: ArrayBuffer;
    ruleId: RuleId;
    gmSessionId: string | null;
  }) {
    const ruleSystem = this.ruleRegistry.get(input.ruleId);
    if (!ruleSystem.parseCharacterSheet) {
      throw new AppError("RULE_ACTION_UNSUPPORTED", `Character sheet parsing is not supported for rule: ${input.ruleId}`, 400);
    }
    const preview = await ruleSystem.parseCharacterSheet(input.fileBuffer);
    const now = this.clock.nowEpochMs();
    const importToken = this.idGenerator.nextId();
    await this.repo.saveStaging({
      id: importToken,
      characterName: preview.characterName,
      sheetJson: JSON.stringify(preview.sheetData),
      ruleId: input.ruleId,
      errorsJson: JSON.stringify(preview.errors),
      expiresAt: now + STAGING_TTL_MS,
      consumedAt: null,
      gmSessionId: input.gmSessionId,
      createdAt: now,
    });
    return {
      importToken,
      preview,
    };
  }
}

export class ImportConfirmUseCase {
  constructor(
    private readonly repo: CharactersRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: {
    importToken: string;
    kind: string;
    ruleId?: RuleId;
    moduleId?: string;
    gmSessionId: string | null;
  }) {
    const staging = await this.repo.findStagingById(input.importToken);
    if (!staging) {
      throw new StagingRecordNotFoundError();
    }
    const now = this.clock.nowEpochMs();
    if (staging.consumedAt !== null) {
      throw new StagingConsumedError();
    }
    if (staging.expiresAt < now) {
      throw new StagingExpiredError();
    }
    if (staging.gmSessionId && staging.gmSessionId !== input.gmSessionId) {
      throw new StagingOwnerMismatchError();
    }
    if (parseStagingErrors(staging.errorsJson).length > 0) {
      throw new StagingHasErrorsError();
    }
    assertKind(input.kind);
    if (input.moduleId) {
      const exists = await this.repo.moduleExists(input.moduleId);
      if (!exists) {
        throw new ModuleNotFoundError();
      }
    }
    const characterId = this.idGenerator.nextId();
    const character = {
      id: characterId,
      name: staging.characterName,
      kind: input.kind,
      ruleId: staging.ruleId,
      sheetJson: staging.sheetJson,
      createdAt: now,
    };
    await this.repo.saveCharacter(character);
    if (input.moduleId) {
      const linkId = this.idGenerator.nextId();
      await this.repo.linkCharacterToModule({
        id: linkId,
        moduleId: input.moduleId,
        characterId,
        createdAt: now,
      });
    }
    await this.repo.consumeStaging(input.importToken, now);
    return character;
  }
}

export class ListModuleCharactersUseCase {
  constructor(private readonly repo: CharactersRepository) {}
  async execute(moduleId: string, options: CursorPageOptions) {
    const exists = await this.repo.moduleExists(moduleId);
    if (!exists) {
      throw new ModuleNotFoundError();
    }
    return this.repo.listModuleCharacters(moduleId, options);
  }
}

export class LinkModuleCharacterUseCase {
  constructor(
    private readonly repo: CharactersRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: { moduleId: string; characterId: string }) {
    const moduleRecord = await this.repo.findModule(input.moduleId);
    if (!moduleRecord) {
      throw new ModuleNotFoundError();
    }
    const character = await this.repo.findCharacterById(input.characterId);
    if (!character) {
      throw new CharacterNotFoundError();
    }
    if (character.ruleId !== moduleRecord.ruleId) {
      throw new CharacterRuleMismatchError();
    }
    const existing = await this.repo.findModuleCharacterLink(input.moduleId, input.characterId);
    if (existing) {
      throw new ModuleCharacterAlreadyLinkedError();
    }
    const link = {
      id: this.idGenerator.nextId(),
      moduleId: input.moduleId,
      characterId: input.characterId,
      createdAt: this.clock.nowEpochMs(),
    };
    await this.repo.linkCharacterToModule(link);
    return link;
  }
}

export class UnlinkModuleCharacterUseCase {
  constructor(private readonly repo: CharactersRepository) {}
  async execute(moduleId: string, characterId: string) {
    const exists = await this.repo.moduleExists(moduleId);
    if (!exists) {
      throw new ModuleNotFoundError();
    }
    await this.repo.unlinkModuleCharacter(moduleId, characterId);
  }
}
