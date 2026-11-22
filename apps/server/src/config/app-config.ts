import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseToml } from "smol-toml";
import { z } from "zod";

const CONFIG_DIR = fileURLToPath(
	new URL("../../../../config", import.meta.url),
);
export const DEFAULT_CONFIG_PATH = join(CONFIG_DIR, "cogm.toml");

const DEFAULT_DEV_CORS_ORIGINS = [
	"http://localhost:15633",
	"http://localhost:15632",
];

export class ConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ConfigError";
	}
}

const EnvironmentSchema = z.enum(["development", "production", "test"]);
export type Environment = z.infer<typeof EnvironmentSchema>;

const absoluteUrl = z
	.string()
	.min(1)
	.max(2_048)
	.refine((value) => {
		try {
			new URL(value);
			return true;
		} catch {
			return false;
		}
	}, "must be an absolute URL");

const stunUrl = z
	.string()
	.min(1)
	.max(2_048)
	.regex(/^stuns?:/);
const turnUrl = z
	.string()
	.min(1)
	.max(2_048)
	.regex(/^turns?:/);

const FileConfigSchema = z
	.object({
		server: z
			.object({
				host: z
					.string()
					.optional()
					.transform((value) => value?.trim() || undefined),
				port: z.number().int().min(1).max(65_535).default(15_632),
			})
			.strict()
			.prefault({}),
		database: z
			.object({
				url: z.string().min(1).default("data/db.sqlite"),
				backupDir: z.string().min(1).optional(),
			})
			.strict()
			.prefault({}),
		media: z
			.object({
				dir: z.string().min(1).default("data/media"),
			})
			.strict()
			.prefault({}),
		themes: z
			.object({
				dir: z.string().min(1).default("data/themes"),
			})
			.strict()
			.prefault({}),
		security: z
			.object({
				trustProxy: z.boolean().default(false),
				corsOrigins: z.array(absoluteUrl).max(64).default([]),
			})
			.strict()
			.prefault({}),
		voice: z
			.object({
				maxParticipants: z.number().int().min(2).max(256).default(8),
				stunUrls: z.array(stunUrl).max(16).default([]),
				turnUrls: z.array(turnUrl).max(16).default([]),
				turnTtlSeconds: z.number().int().min(60).max(86_400).default(600),
			})
			.strict()
			.prefault({}),
		dev: z
			.object({
				httpsPort: z.number().int().min(1).max(65_535).default(15_633),
				clientPort: z.number().int().min(1).max(65_535).default(15_634),
				httpsHosts: z.array(z.string().min(1).max(255)).max(64).default([]),
			})
			.strict()
			.prefault({}),
	})
	.strict();

export type FileConfig = z.infer<typeof FileConfigSchema>;

const AppConfigSchema = z
	.object({
		host: z.string().min(1).optional(),
		port: z.number().int().min(1).max(65_535),
		environment: EnvironmentSchema,
		databaseUrl: z.string().min(1),
		backupDir: z.string().min(1).optional(),
		mediaDir: z.string().min(1),
		themesDir: z.string().min(1),
		corsOrigins: z.array(absoluteUrl).max(64),
		trustProxy: z.boolean(),
		voice: z
			.object({
				maxParticipants: z.number().int().min(2).max(256),
				stunUrls: z.array(stunUrl).max(16),
				turnUrls: z.array(turnUrl).max(16),
				turnRestSecret: z.string().max(4_096).optional(),
				turnTtlSeconds: z.number().int().min(60).max(86_400),
			})
			.strict(),
		dev: z
			.object({
				httpsPort: z.number().int().min(1).max(65_535),
				clientPort: z.number().int().min(1).max(65_535),
				httpsHosts: z.array(z.string().min(1).max(255)).max(64),
			})
			.strict(),
	})
	.strict()
	.superRefine((config, context) => {
		const hasTurnUrls = config.voice.turnUrls.length > 0;
		const hasTurnSecret = Boolean(config.voice.turnRestSecret);
		if (hasTurnUrls !== hasTurnSecret) {
			context.addIssue({
				code: "custom",
				path: ["voice", "turnRestSecret"],
				message:
					"VOICE_TURN_URLS and VOICE_TURN_REST_SECRET must be configured together",
			});
		}
	});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export interface LoadConfigOptions {
	/** 显式配置文件路径；用于部署、开发脚本与测试。 */
	path?: string;
	/** 显式本地覆盖文件路径；默认主配置旁的 cogm.local.toml。 */
	localPath?: string;
	env?: Record<string, string | undefined>;
	overrides?: DeepPartial<AppConfig>;
}

type DeepPartial<T> = {
	[K in keyof T]?: T[K] extends readonly unknown[]
		? T[K]
		: T[K] extends object
			? DeepPartial<T[K]>
			: T[K];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeDeep(
	base: Record<string, unknown>,
	override: Record<string, unknown>,
): Record<string, unknown> {
	const result = { ...base };
	for (const [key, value] of Object.entries(override)) {
		const current = result[key];
		result[key] =
			isPlainObject(current) && isPlainObject(value)
				? mergeDeep(current, value)
				: value;
	}
	return result;
}

function readConfigFile(path: string): Record<string, unknown> {
	if (!existsSync(path)) {
		throw new ConfigError(`Config file not found: ${path}`);
	}
	const text = readFileSync(path, "utf8");
	try {
		const value = path.toLowerCase().endsWith(".json")
			? JSON.parse(text)
			: parseToml(text);
		if (!isPlainObject(value)) {
			throw new Error("config root must be an object");
		}
		return value;
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		throw new ConfigError(`Failed to parse config file ${path}: ${detail}`);
	}
}

function resolveEnvironment(
	env: Record<string, string | undefined>,
): Environment {
	const raw = env.NODE_ENV?.trim();
	if (!raw) {
		return "development";
	}
	const parsed = EnvironmentSchema.safeParse(raw);
	if (!parsed.success) {
		throw new ConfigError(
			`NODE_ENV must be development, production, or test, got "${raw}"`,
		);
	}
	return parsed.data;
}

function resolveFromFile(
	file: FileConfig,
	environment: Environment,
	turnRestSecret: string | undefined,
): AppConfig {
	const corsOrigins =
		file.security.corsOrigins.length > 0
			? file.security.corsOrigins
			: environment === "production"
				? []
				: DEFAULT_DEV_CORS_ORIGINS;

	return AppConfigSchema.parse({
		host: file.server.host,
		port: file.server.port,
		environment,
		databaseUrl: file.database.url,
		backupDir: file.database.backupDir,
		mediaDir: file.media.dir,
		themesDir: file.themes.dir,
		corsOrigins,
		trustProxy: file.security.trustProxy,
		voice: {
			maxParticipants: file.voice.maxParticipants,
			stunUrls: file.voice.stunUrls,
			turnUrls: file.voice.turnUrls,
			turnRestSecret,
			turnTtlSeconds: file.voice.turnTtlSeconds,
		},
		dev: file.dev,
	});
}

/** 以代码默认值构建配置；测试与开发工具使用，不读取配置文件。 */
export function createAppConfig(
	overrides: DeepPartial<AppConfig> = {},
): AppConfig {
	const base = resolveFromFile(
		FileConfigSchema.parse({}),
		overrides.environment ?? "development",
		undefined,
	);
	return AppConfigSchema.parse(mergeDeep(base, overrides));
}

/** 读取 config/cogm.toml，按需合并 config/cogm.local.toml，再应用显式覆盖。 */
export function loadConfig(options: LoadConfigOptions = {}): AppConfig {
	const env = options.env ?? process.env;
	const environment = resolveEnvironment(env);
	const selectedPath = options.path ?? env.COGM_CONFIG?.trim();
	const path = selectedPath || DEFAULT_CONFIG_PATH;
	const localPath = options.localPath ?? join(dirname(path), "cogm.local.toml");

	let raw = readConfigFile(path);
	if (localPath && existsSync(localPath)) {
		raw = mergeDeep(raw, readConfigFile(localPath));
	}

	const file = FileConfigSchema.parse(raw);
	const turnRestSecret = env.VOICE_TURN_REST_SECRET?.trim() || undefined;
	const base = resolveFromFile(file, environment, turnRestSecret);
	return AppConfigSchema.parse(
		mergeDeep(base, (options.overrides ?? {}) as Record<string, unknown>),
	);
}

/** 将有效配置还原为可写文件结构；不包含任何密钥。 */
export function toFileConfig(config: AppConfig): FileConfig {
	return {
		server: { host: config.host, port: config.port },
		database: {
			url: config.databaseUrl,
			...(config.backupDir ? { backupDir: config.backupDir } : {}),
		},
		media: { dir: config.mediaDir },
		themes: { dir: config.themesDir },
		security: {
			trustProxy: config.trustProxy,
			corsOrigins: config.corsOrigins,
		},
		voice: {
			maxParticipants: config.voice.maxParticipants,
			stunUrls: config.voice.stunUrls,
			turnUrls: config.voice.turnUrls,
			turnTtlSeconds: config.voice.turnTtlSeconds,
		},
		dev: config.dev,
	};
}
