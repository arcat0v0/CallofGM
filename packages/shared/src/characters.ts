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
});
export type ImportConfirmRequest = z.infer<typeof ImportConfirmRequest>;

export const AddPortraitRequest = z.object({
  expressionKey: z.string().trim().min(1).max(64),
  portraitAssetId: z.string().min(1),
  isDefault: z.boolean().default(false),
});
export type AddPortraitRequest = z.infer<typeof AddPortraitRequest>;
