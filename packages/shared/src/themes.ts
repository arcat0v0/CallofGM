import { z } from "zod";

export const THEME_API_VERSION = 1;
export const THEME_FORMAT_VERSION = 1;

const RELATIVE_PATH_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._\-/]+$/;

export const ThemeId = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/, "主题 id 必须为 author.theme 形式")
  .refine((value) => value !== "default", "default 为保留 id");

export const ThemeVersion = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "主题版本必须为 x.y.z");

export const ThemeRelativePath = z
  .string()
  .min(1)
  .max(240)
  .regex(RELATIVE_PATH_PATTERN, "非法主题文件路径");

export const ThemeManifest = z.object({
  formatVersion: z.literal(THEME_FORMAT_VERSION),
  id: ThemeId,
  name: z.string().min(1).max(80),
  version: ThemeVersion,
  apiVersion: z.number().int().positive(),
  description: z.string().max(500).optional(),
  author: z.string().max(100).optional(),
  license: z.string().max(50).optional(),
  repository: z.string().url().optional(),
  homepage: z.string().url().optional(),
  entry: z.literal("bundle.js"),
  styles: z.array(ThemeRelativePath).max(12).default([]),
  defaultLocale: z.string().min(2).max(20).default("zh-CN"),
  locales: z.array(z.string().min(2).max(20)).max(20).default([]),
  colorScheme: z.enum(["dark", "light"]).optional(),
  themeColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  icon: ThemeRelativePath.optional(),
  slots: z.array(z.string().min(1).max(80)).max(100).optional(),
  tokens: z
    .record(z.string().regex(/^[a-z0-9-]+$/), z.string().min(1).max(120))
    .optional(),
  bundleHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  signature: z.string().nullable().optional(),
});
export type ThemeManifest = z.infer<typeof ThemeManifest>;

export const ThemeSummaryDto = z.object({
  id: ThemeId,
  name: z.string(),
  version: ThemeVersion,
  apiVersion: z.number().int(),
  description: z.string().nullable(),
  author: z.string().nullable(),
  repository: z.string().nullable(),
  colorScheme: z.enum(["dark", "light"]).nullable(),
  slots: z.array(z.string()).nullable(),
  previewUrl: z.string().nullable(),
  digest: z.string(),
  installedAt: z.number().int(),
  usedByModules: z.number().int(),
  usedByGmUi: z.boolean(),
});
export type ThemeSummaryDto = z.infer<typeof ThemeSummaryDto>;

export const ThemeListResponse = z.object({
  items: z.array(ThemeSummaryDto),
});
export type ThemeListResponse = z.infer<typeof ThemeListResponse>;

export const UiSettingsDto = z.object({
  gmThemeId: z.string().nullable(),
});
export type UiSettingsDto = z.infer<typeof UiSettingsDto>;

export const UpdateUiSettingsRequest = z.object({
  gmThemeId: z.string().nullable(),
});
export type UpdateUiSettingsRequest = z.infer<typeof UpdateUiSettingsRequest>;