import { z } from "zod";
import { RuleId } from "./rules/rule-id";
import { CharacterRole } from "./session";

export const CreateCharacterRequest = z.object({
  name: z.string().trim().min(1).max(100),
  kind: CharacterRole,
  ruleId: RuleId,
  sheetData: z.unknown(),
});
export type CreateCharacterRequest = z.infer<typeof CreateCharacterRequest>;

export const UpdateCharacterRequest = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  kind: CharacterRole.optional(),
  sheetData: z.unknown().optional(),
});
export type UpdateCharacterRequest = z.infer<typeof UpdateCharacterRequest>;

export const ImportConfirmRequest = z.object({
  importToken: z.string().min(1),
  kind: CharacterRole,
  ruleId: RuleId.optional(),
  moduleId: z.string().min(1).optional(),
  /** 传入既有人物 ID 时更新该人物（姓名 + 数值），否则新建 */
  characterId: z.string().min(1).optional(),
});
export type ImportConfirmRequest = z.infer<typeof ImportConfirmRequest>;

export const AddPortraitRequest = z.object({
  expressionKey: z.string().trim().min(1).max(64),
  portraitAssetId: z.string().min(1),
  isDefault: z.boolean().default(false),
});
export type AddPortraitRequest = z.infer<typeof AddPortraitRequest>;

export const CharacterDto = z.object({
  id: z.string(),
  name: z.string(),
  kind: CharacterRole,
  ruleId: RuleId,
  sheetJson: z.string(),
  createdAt: z.number().int(),
});
export type CharacterDto = z.infer<typeof CharacterDto>;

export const CharacterPortraitDto = z.object({
  id: z.string(),
  characterId: z.string(),
  expressionKey: z.string(),
  portraitAssetId: z.string(),
  isDefault: z.number().int().min(0).max(1),
  createdAt: z.number().int(),
});
export type CharacterPortraitDto = z.infer<typeof CharacterPortraitDto>;

export const CharacterDetailDto = CharacterDto.extend({
  portraits: z.array(CharacterPortraitDto),
});
export type CharacterDetailDto = z.infer<typeof CharacterDetailDto>;

export const CharacterImportErrorDto = z.object({
  cell: z.string(),
  message: z.string(),
});
export type CharacterImportErrorDto = z.infer<typeof CharacterImportErrorDto>;

export const CharacterImportPreviewResponse = z.object({
  importToken: z.string(),
  preview: z.object({
    characterName: z.string(),
    sheetData: z.unknown(),
    errors: z.array(CharacterImportErrorDto),
    warnings: z.array(CharacterImportErrorDto).default([]),
  }),
});
export type CharacterImportPreviewResponse = z.infer<typeof CharacterImportPreviewResponse>;
