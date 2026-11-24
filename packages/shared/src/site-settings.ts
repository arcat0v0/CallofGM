import { z } from "zod";
import { MAX_MEDIA_UPLOAD_MB } from "./media";

export const DEFAULT_MAX_THEME_UPLOAD_MB = 50;

export const StorageMode = z.enum(["local", "s3"]);
export type StorageMode = z.infer<typeof StorageMode>;

export const OssAccessMode = z.enum(["public", "private"]);
export type OssAccessMode = z.infer<typeof OssAccessMode>;

export const SiteSettingsSection = z.enum([
	"storage",
	"voice",
	"security",
	"ui",
]);
export type SiteSettingsSection = z.infer<typeof SiteSettingsSection>;

const HttpUrlString = z
	.string()
	.trim()
	.max(2_048)
	.refine((value) => {
		if (value === "") return true;
		try {
			const parsed = new URL(value);
			return parsed.protocol === "http:" || parsed.protocol === "https:";
		} catch {
			return false;
		}
	}, "must be an http(s) URL");

const AbsoluteOriginUrl = z
	.string()
	.trim()
	.min(1)
	.max(2_048)
	.refine((value) => {
		try {
			const parsed = new URL(value);
			return parsed.protocol === "http:" || parsed.protocol === "https:";
		} catch {
			return false;
		}
	}, "must be an absolute http(s) URL");

const StunUrl = z
	.string()
	.trim()
	.min(1)
	.max(2_048)
	.regex(/^stuns?:/, "must start with stun: or stuns:");

const TurnUrl = z
	.string()
	.trim()
	.min(1)
	.max(2_048)
	.regex(/^turns?:/, "must start with turn: or turns:");

export const RateLimitRuleSchema = z.object({
	limit: z.number().int().min(1).max(10_000),
	windowSeconds: z.number().int().min(1).max(3_600),
});
export type RateLimitRule = z.infer<typeof RateLimitRuleSchema>;

export const SiteRateLimitsSchema = z.object({
	login: RateLimitRuleSchema,
	identity: RateLimitRuleSchema,
	join: RateLimitRuleSchema,
	sessionReference: RateLimitRuleSchema,
	upload: RateLimitRuleSchema,
});
export type SiteRateLimits = z.infer<typeof SiteRateLimitsSchema>;

export const DEFAULT_SITE_RATE_LIMITS: SiteRateLimits = {
	login: { limit: 10, windowSeconds: 60 },
	identity: { limit: 60, windowSeconds: 60 },
	join: { limit: 30, windowSeconds: 60 },
	sessionReference: { limit: 30, windowSeconds: 60 },
	upload: { limit: 20, windowSeconds: 60 },
};

export const S3PublicConfigDto = z.object({
	endpoint: HttpUrlString,
	publicUploadEndpoint: HttpUrlString,
	region: z.string().trim().max(128),
	bucket: z.string().trim().max(255),
	forcePathStyle: z.boolean(),
	keyPrefix: z.string().trim().max(255),
	accessKeyId: z.string().trim().max(255),
	hasSecretAccessKey: z.boolean(),
	secretAccessKeyMask: z.string().nullable(),
	downloadBaseUrl: HttpUrlString,
	accessMode: OssAccessMode,
	signedUrlTtlSeconds: z.number().int().min(60).max(86_400),
});
export type S3PublicConfigDto = z.infer<typeof S3PublicConfigDto>;

export const SiteStorageSettingsDto = z.object({
	mode: StorageMode,
	maxMediaUploadMb: z.number().int().min(1).max(1_024),
	maxThemeUploadMb: z.number().int().min(1).max(512),
	s3: S3PublicConfigDto,
});
export type SiteStorageSettingsDto = z.infer<typeof SiteStorageSettingsDto>;

export const SiteVoiceSettingsDto = z.object({
	maxParticipants: z.number().int().min(2).max(256),
	stunUrls: z.array(StunUrl).max(16),
	turnUrls: z.array(TurnUrl).max(16),
	hasTurnRestSecret: z.boolean(),
	turnRestSecretMask: z.string().nullable(),
	turnTtlSeconds: z.number().int().min(60).max(86_400),
});
export type SiteVoiceSettingsDto = z.infer<typeof SiteVoiceSettingsDto>;

export const SiteSecuritySettingsDto = z.object({
	trustProxy: z.boolean(),
	corsOrigins: z.array(AbsoluteOriginUrl).max(64),
	rateLimits: SiteRateLimitsSchema,
});
export type SiteSecuritySettingsDto = z.infer<typeof SiteSecuritySettingsDto>;

export const SiteUiSettingsDto = z.object({
	gmThemeId: z.string().nullable(),
});
export type SiteUiSettingsDto = z.infer<typeof SiteUiSettingsDto>;

export const SiteSystemInfoDto = z.object({
	host: z.string().nullable(),
	port: z.number().int(),
	environment: z.enum(["development", "production", "test"]),
	databaseUrl: z.string(),
	backupDir: z.string().nullable(),
	mediaDir: z.string(),
	themesDir: z.string(),
	secretsEncryptionSource: z.enum(["env", "keyfile", "ephemeral"]),
	version: z.string(),
	commit: z.string().nullable(),
	buildTime: z.string().nullable(),
});
export type SiteSystemInfoDto = z.infer<typeof SiteSystemInfoDto>;

export const AdminSiteSettingsResponse = z.object({
	storage: SiteStorageSettingsDto,
	voice: SiteVoiceSettingsDto,
	security: SiteSecuritySettingsDto,
	ui: SiteUiSettingsDto,
	system: SiteSystemInfoDto,
	overriddenSections: z.array(SiteSettingsSection),
	updatedAt: z.number().int().nullable(),
});
export type AdminSiteSettingsResponse = z.infer<
	typeof AdminSiteSettingsResponse
>;

export const S3ConfigInputSchema = z.object({
	endpoint: HttpUrlString,
	publicUploadEndpoint: HttpUrlString.default(""),
	region: z.string().trim().max(128).default("us-east-1"),
	bucket: z.string().trim().max(255),
	forcePathStyle: z.boolean().default(false),
	keyPrefix: z.string().trim().max(255).default(""),
	accessKeyId: z.string().trim().max(255),
	/** 留空或省略表示保持已有密钥不变 */
	secretAccessKey: z.string().max(4_096).optional(),
	clearSecretAccessKey: z.boolean().optional(),
	downloadBaseUrl: HttpUrlString,
	accessMode: OssAccessMode.default("public"),
	signedUrlTtlSeconds: z.number().int().min(60).max(86_400).default(600),
});
export type S3ConfigInput = z.infer<typeof S3ConfigInputSchema>;

export const UpdateStorageSettingsInput = z.object({
	mode: StorageMode,
	maxMediaUploadMb: z.number().int().min(1).max(1_024).default(MAX_MEDIA_UPLOAD_MB),
	maxThemeUploadMb: z
		.number()
		.int()
		.min(1)
		.max(512)
		.default(DEFAULT_MAX_THEME_UPLOAD_MB),
	s3: S3ConfigInputSchema,
});
export type UpdateStorageSettingsInput = z.infer<
	typeof UpdateStorageSettingsInput
>;

export const UpdateVoiceSettingsInput = z.object({
	maxParticipants: z.number().int().min(2).max(256),
	stunUrls: z.array(StunUrl).max(16),
	turnUrls: z.array(TurnUrl).max(16),
	/** 留空或省略表示保持已有密钥不变 */
	turnRestSecret: z.string().max(4_096).optional(),
	clearTurnRestSecret: z.boolean().optional(),
	turnTtlSeconds: z.number().int().min(60).max(86_400),
});
export type UpdateVoiceSettingsInput = z.infer<typeof UpdateVoiceSettingsInput>;

export const UpdateSecuritySettingsInput = z.object({
	trustProxy: z.boolean(),
	corsOrigins: z.array(AbsoluteOriginUrl).max(64),
	rateLimits: SiteRateLimitsSchema,
});
export type UpdateSecuritySettingsInput = z.infer<
	typeof UpdateSecuritySettingsInput
>;

export const UpdateUiSectionInput = z.object({
	gmThemeId: z.string().nullable(),
});
export type UpdateUiSectionInput = z.infer<typeof UpdateUiSectionInput>;

export const UpdateSiteSettingsRequest = z
	.object({
		storage: UpdateStorageSettingsInput.optional(),
		voice: UpdateVoiceSettingsInput.optional(),
		security: UpdateSecuritySettingsInput.optional(),
		ui: UpdateUiSectionInput.optional(),
	})
	.refine(
		(value) =>
			value.storage !== undefined ||
			value.voice !== undefined ||
			value.security !== undefined ||
			value.ui !== undefined,
		"At least one settings section must be provided",
	);
export type UpdateSiteSettingsRequest = z.infer<
	typeof UpdateSiteSettingsRequest
>;

export const ResetSiteSettingsRequest = z.object({
	section: z.enum(["all", "storage", "voice", "security", "ui"]),
});
export type ResetSiteSettingsRequest = z.infer<typeof ResetSiteSettingsRequest>;

export const TestStorageConnectionRequest = z.object({
	s3: S3ConfigInputSchema.optional(),
});
export type TestStorageConnectionRequest = z.infer<
	typeof TestStorageConnectionRequest
>;

export const StorageCheckItemDto = z.object({
	ok: z.boolean(),
	latencyMs: z.number().int().nonnegative().optional(),
	status: z.number().int().optional(),
	url: z.string().optional(),
	error: z.string().optional(),
});
export type StorageCheckItemDto = z.infer<typeof StorageCheckItemDto>;

export const BrowserStorageProbeDto = z.object({
	uploadUrl: z.string(),
	downloadUrl: z.string(),
	headers: z.record(z.string(), z.string()),
	probeToken: z.string(),
	probeContent: z.string(),
});
export type BrowserStorageProbeDto = z.infer<typeof BrowserStorageProbeDto>;

export const TestStorageConnectionResponse = z.object({
	ok: z.boolean(),
	checks: z.object({
		putObject: StorageCheckItemDto,
		headObject: StorageCheckItemDto,
		rangeRead: StorageCheckItemDto,
		downloadDomain: StorageCheckItemDto,
		deleteObject: StorageCheckItemDto,
	}),
	browserProbe: BrowserStorageProbeDto.nullable(),
});
export type TestStorageConnectionResponse = z.infer<
	typeof TestStorageConnectionResponse
>;

export const CleanupStorageProbeRequest = z.object({
	probeToken: z.string().min(1).max(128),
});
export type CleanupStorageProbeRequest = z.infer<
	typeof CleanupStorageProbeRequest
>;

export const StorageMigrationCountsDto = z.object({
	total: z.number().int().nonnegative(),
	migrated: z.number().int().nonnegative(),
	skipped: z.number().int().nonnegative(),
	failed: z.number().int().nonnegative(),
});
export type StorageMigrationCountsDto = z.infer<
	typeof StorageMigrationCountsDto
>;

export const StorageMigrationErrorItemDto = z.object({
	kind: z.enum(["media", "theme"]),
	id: z.string(),
	name: z.string(),
	message: z.string(),
});
export type StorageMigrationErrorItemDto = z.infer<
	typeof StorageMigrationErrorItemDto
>;

export const StorageMigrationStatusDto = z.object({
	status: z.enum(["idle", "running", "completed", "failed"]),
	jobId: z.string().nullable(),
	startedAt: z.number().int().nullable(),
	finishedAt: z.number().int().nullable(),
	media: StorageMigrationCountsDto,
	themes: StorageMigrationCountsDto,
	errors: z.array(StorageMigrationErrorItemDto),
});
export type StorageMigrationStatusDto = z.infer<
	typeof StorageMigrationStatusDto
>;

export const PublicRuntimeConfigDto = z.object({
	storageMode: StorageMode,
	maxMediaUploadBytes: z.number().int().positive(),
	maxThemeUploadBytes: z.number().int().positive(),
});
export type PublicRuntimeConfigDto = z.infer<typeof PublicRuntimeConfigDto>;
