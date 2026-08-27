import type { RuleId } from "@cogm/shared";

export type CursorPageOptions = {
  limit: number;
  offset?: number;
  cursor?: string;
};

export interface CharacterRecord {
  id: string;
  name: string;
  kind: string;
  ruleId: string;
  sheetJson: string;
  createdAt: number;
}

export interface CharacterPortraitRecord {
  id: string;
  characterId: string;
  expressionKey: string;
  portraitAssetId: string;
  isDefault: number;
  createdAt: number;
}

export interface StagingRecord {
  id: string;
  characterName: string;
  sheetJson: string;
  ruleId: string;
  errorsJson: string;
  expiresAt: number;
  consumedAt: number | null;
  gmSessionId: string | null;
  createdAt: number;
}

export interface CharactersRepository {
  findCharacterById(id: string): Promise<CharacterRecord | null>;
  saveCharacter(character: {
    id: string;
    name: string;
    kind: string;
    ruleId: string;
    sheetJson: string;
    createdAt: number;
  }): Promise<void>;
  updateCharacter(
    id: string,
    updates: {
      name?: string;
      kind?: string;
      sheetJson?: string;
    }
  ): Promise<CharacterRecord>;
  deleteCharacter(id: string): Promise<void>;
  listCharacters(options: CursorPageOptions): Promise<{ items: CharacterRecord[]; nextCursor: string | null }>;

  findMediaAsset(id: string): Promise<{ id: string; purpose: string; mimeType: string } | null>;
  findPortraitById(id: string): Promise<CharacterPortraitRecord | null>;
  savePortrait(portrait: {
    id: string;
    characterId: string;
    expressionKey: string;
    portraitAssetId: string;
    isDefault: number;
    createdAt: number;
  }): Promise<void>;
  unsetDefaultPortraits(characterId: string): Promise<void>;
  deletePortrait(id: string): Promise<void>;
  listPortraitsByCharacterId(characterId: string): Promise<CharacterPortraitRecord[]>;

  findStagingById(id: string): Promise<StagingRecord | null>;
  saveStaging(staging: {
    id: string;
    characterName: string;
    sheetJson: string;
    ruleId: string;
    errorsJson: string;
    expiresAt: number;
    consumedAt: number | null;
    gmSessionId: string | null;
    createdAt: number;
  }): Promise<void>;
  consumeStaging(id: string, consumedAt: number): Promise<void>;

  moduleExists(moduleId: string): Promise<boolean>;
  findModule(id: string): Promise<{ id: string; ruleId: string } | null>;
  findModuleCharacterLink(moduleId: string, characterId: string): Promise<{ id: string } | null>;
  linkCharacterToModule(link: {
    id: string;
    moduleId: string;
    characterId: string;
    createdAt: number;
  }): Promise<void>;
  unlinkModuleCharacter(moduleId: string, characterId: string): Promise<void>;
  listModuleCharacters(
    moduleId: string,
    options: CursorPageOptions
  ): Promise<{ items: CharacterRecord[]; nextCursor: string | null }>;
}
