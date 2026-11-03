import { z } from "zod";
import { RuleId } from "./rules/rule-id";
import { SessionSettings } from "./session";
import { ThemeId } from "./themes";

export const CreateTemplateRequest = z.object({
	name: z.string().trim().min(1).max(100),
	description: z.string().max(2000).default(""),
	ruleId: RuleId,
	themeId: ThemeId.nullable().optional(),
	sourceModuleId: z.string().min(1).optional(),
});
export type CreateTemplateRequest = z.infer<typeof CreateTemplateRequest>;

export const UpdateTemplateRequest = z.object({
	name: z.string().trim().min(1).max(100).optional(),
	description: z.string().max(2000).optional(),
	themeId: ThemeId.nullable().optional(),
	settings: SessionSettings.optional(),
});
export type UpdateTemplateRequest = z.infer<typeof UpdateTemplateRequest>;

export const TemplateDto = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	ruleId: RuleId,
	themeId: ThemeId.nullable(),
	currentVersion: z.number().int(),
	sourceModuleId: z.string().nullable(),
	sourceTemplateId: z.string().nullable(),
	sceneCount: z.number().int(),
	trackCount: z.number().int(),
	handoutCount: z.number().int(),
	characterCount: z.number().int(),
	createdAt: z.number().int(),
	updatedAt: z.number().int(),
});
export type TemplateDto = z.infer<typeof TemplateDto>;

export const SaveTemplateVersionRequest = z.object({
	note: z.string().max(500).optional(),
});
export type SaveTemplateVersionRequest = z.infer<
	typeof SaveTemplateVersionRequest
>;

export const TemplateVersionDto = z.object({
	id: z.string(),
	templateId: z.string(),
	version: z.number().int(),
	note: z.string().nullable(),
	createdAt: z.number().int(),
});
export type TemplateVersionDto = z.infer<typeof TemplateVersionDto>;

export const TemplateSceneDto = z.object({
	id: z.string(),
	templateId: z.string(),
	name: z.string(),
	sortOrder: z.number().int(),
	bgAssetId: z.string().nullable(),
	createdAt: z.number().int(),
});
export type TemplateSceneDto = z.infer<typeof TemplateSceneDto>;

export const TemplateTrackDto = z.object({
	id: z.string(),
	templateId: z.string(),
	name: z.string(),
	audioAssetId: z.string(),
	type: z.enum(["bgm", "se"]),
	duration: z.number().int(),
	createdAt: z.number().int(),
});
export type TemplateTrackDto = z.infer<typeof TemplateTrackDto>;

export const TemplateHandoutDto = z.object({
	id: z.string(),
	templateId: z.string(),
	title: z.string(),
	content: z.string(),
	imageAssetId: z.string().nullable(),
	createdAt: z.number().int(),
});
export type TemplateHandoutDto = z.infer<typeof TemplateHandoutDto>;

export const TemplateCharacterDto = z.object({
	id: z.string(),
	characterId: z.string(),
	name: z.string(),
	kind: z.enum(["pc", "npc"]),
	ruleId: RuleId,
	sheetJson: z.string(),
	sheetVersion: z.number().int(),
});
export type TemplateCharacterDto = z.infer<typeof TemplateCharacterDto>;

export const TemplateDetailDto = TemplateDto.extend({
	settings: SessionSettings,
	scenes: z.array(TemplateSceneDto),
	tracks: z.array(TemplateTrackDto),
	handouts: z.array(TemplateHandoutDto),
	characters: z.array(TemplateCharacterDto),
});
export type TemplateDetailDto = z.infer<typeof TemplateDetailDto>;

export const InstantiateTemplateRequest = z.object({
	version: z.number().int().positive().optional(),
	name: z.string().trim().min(1).max(100).optional(),
	description: z.string().max(2000).optional(),
	quickStart: z.boolean().default(false),
	sessionName: z.string().trim().max(60).optional(),
});
export type InstantiateTemplateRequest = z.infer<
	typeof InstantiateTemplateRequest
>;

export const InstantiateTemplateResponse = z.object({
	moduleId: z.string(),
	sessionId: z.string().nullable(),
});
export type InstantiateTemplateResponse = z.infer<
	typeof InstantiateTemplateResponse
>;
