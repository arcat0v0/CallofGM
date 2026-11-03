import { z } from "zod";
import { RuleId } from "./rules/rule-id";
import { HandoutDto } from "./handouts";
import { ThemeId } from "./themes";

export const CreateModuleRequest = z.object({
  name: z.string().min(1),
  description: z.string(),
  ruleId: RuleId,
  themeId: ThemeId.nullable().optional(),
});
export type CreateModuleRequest = z.infer<typeof CreateModuleRequest>;

export const UpdateModuleRequest = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  themeId: ThemeId.nullable().optional(),
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

export const ModuleDto = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  ruleId: RuleId,
  themeId: ThemeId.nullable(),
  sourceTemplateId: z.string().nullable().optional(),
  sourceTemplateVersion: z.number().int().nullable().optional(),
  createdAt: z.number().int(),
});
export type ModuleDto = z.infer<typeof ModuleDto>;

export const SceneDto = z.object({
  id: z.string(),
  moduleId: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
  bgAssetId: z.string().nullable(),
  createdAt: z.number().int(),
});
export type SceneDto = z.infer<typeof SceneDto>;

export const TrackDto = z.object({
  id: z.string(),
  moduleId: z.string(),
  name: z.string(),
  audioAssetId: z.string(),
  type: z.enum(["bgm", "se"]),
  duration: z.number().int(),
  audioSize: z.number().int().nullable(),
  audioUploadedAt: z.number().int().nullable(),
  createdAt: z.number().int(),
});
export type TrackDto = z.infer<typeof TrackDto>;

export const ModuleSummaryDto = z.object({
  moduleId: z.string(),
  sceneCount: z.number().int(),
  handoutCount: z.number().int(),
  trackCount: z.number().int(),
  characterCount: z.number().int(),
  coverAssetId: z.string().nullable(),
  updatedAt: z.number().int(),
});
export type ModuleSummaryDto = z.infer<typeof ModuleSummaryDto>;

export const CatalogHandoutDto = HandoutDto.extend({
  moduleId: z.string(),
  createdAt: z.number().int(),
});
export type CatalogHandoutDto = z.infer<typeof CatalogHandoutDto>;

export const ModuleCharacterLinkDto = z.object({
  id: z.string(),
  moduleId: z.string(),
  characterId: z.string(),
  createdAt: z.number().int(),
});
export type ModuleCharacterLinkDto = z.infer<typeof ModuleCharacterLinkDto>;
