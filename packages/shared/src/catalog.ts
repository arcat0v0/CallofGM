import { z } from "zod";
import { RuleId } from "./rules/rule-id";

export const CreateModuleRequest = z.object({
  name: z.string().min(1),
  description: z.string(),
  ruleId: RuleId,
});
export type CreateModuleRequest = z.infer<typeof CreateModuleRequest>;

export const UpdateModuleRequest = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});
export type UpdateModuleRequest = z.infer<typeof UpdateModuleRequest>;

export const CreateSceneRequest = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int(),
  bgAssetId: z.string().nullable().optional(),
});
export type CreateSceneRequest = z.infer<typeof CreateSceneRequest>;

export const UpdateSceneRequest = z.object({
  name: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  bgAssetId: z.string().nullable().optional(),
});
export type UpdateSceneRequest = z.infer<typeof UpdateSceneRequest>;

export const CreateTrackRequest = z.object({
  name: z.string().min(1),
  audioAssetId: z.string().min(1),
  type: z.enum(["bgm", "se"]),
  duration: z.number().int().min(0),
});
export type CreateTrackRequest = z.infer<typeof CreateTrackRequest>;

export const UpdateTrackRequest = z.object({
  name: z.string().min(1).optional(),
  audioAssetId: z.string().min(1).optional(),
  type: z.enum(["bgm", "se"]).optional(),
  duration: z.number().int().min(0).optional(),
});
export type UpdateTrackRequest = z.infer<typeof UpdateTrackRequest>;

export const CreateHandoutRequest = z.object({
  title: z.string().min(1),
  content: z.string(),
  imageAssetId: z.string().nullable().optional(),
});
export type CreateHandoutRequest = z.infer<typeof CreateHandoutRequest>;

export const UpdateHandoutRequest = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  imageAssetId: z.string().nullable().optional(),
});
export type UpdateHandoutRequest = z.infer<typeof UpdateHandoutRequest>;

export const LinkModuleCharacterRequest = z.object({
  characterId: z.string().min(1),
});
export type LinkModuleCharacterRequest = z.infer<typeof LinkModuleCharacterRequest>;
