import { z } from "zod";
import { parseCorsOrigins } from "@/platform/security/origin";

const EnvSchema = z
	.object({
		PORT: z.coerce.number().int().default(15632),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		DATABASE_URL: z.string().default("data/db.sqlite"),
		/** 上传媒体根目录 */
		MEDIA_DIR: z.string().default("data/media"),
		THEMES_DIR: z.string().default("data/themes"),
		/** 逗号分隔的 CORS 来源；生产未配置时仅允许同源 */
		CORS_ORIGINS: z.string().optional(),
		/** 为 true 时才信任 X-Forwarded-For */
		TRUST_PROXY: z
			.enum(["true", "false"])
			.default("false")
			.transform((value) => value === "true"),
		VOICE_MAX_PARTICIPANTS: z.coerce.number().int().min(2).max(256).default(8),
		VOICE_STUN_URLS: z
			.string()
			.default("")
			.transform((value) =>
				value
					.split(",")
					.map((url) => url.trim())
					.filter(Boolean),
			)
			.pipe(
				z
					.array(
						z
							.string()
							.min(1)
							.max(2_048)
							.regex(/^stuns?:/),
					)
					.max(16),
			),
		VOICE_TURN_URLS: z
			.string()
			.default("")
			.transform((value) =>
				value
					.split(",")
					.map((url) => url.trim())
					.filter(Boolean),
			)
			.pipe(
				z
					.array(
						z
							.string()
							.min(1)
							.max(2_048)
							.regex(/^turns?:/),
					)
					.max(16),
			),
		VOICE_TURN_REST_SECRET: z.string().max(4_096).optional(),
		VOICE_TURN_TTL_SECONDS: z.coerce
			.number()
			.int()
			.min(60)
			.max(86_400)
			.default(600),
	})
	.superRefine((env, context) => {
		const hasTurnUrls = env.VOICE_TURN_URLS.length > 0;
		const hasTurnSecret = Boolean(env.VOICE_TURN_REST_SECRET);
		if (hasTurnUrls !== hasTurnSecret) {
			context.addIssue({
				code: "custom",
				message:
					"VOICE_TURN_URLS and VOICE_TURN_REST_SECRET must be configured together",
			});
		}
	});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(): Env {
	const parsed = EnvSchema.safeParse(process.env);
	if (!parsed.success) {
		console.error("Invalid environment variables:", parsed.error.format());
		process.exit(1);
	}
	return parsed.data;
}

export function corsOriginsFor(env: Env): string[] {
	return parseCorsOrigins(env.CORS_ORIGINS, env.NODE_ENV);
}
