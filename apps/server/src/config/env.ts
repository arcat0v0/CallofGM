import { z } from "zod";
import { parseCorsOrigins } from "@/platform/security/origin";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().default(15632),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().default("data/db.sqlite"),
  /** 上传媒体根目录 */
  MEDIA_DIR: z.string().default("data/media"),
  /** 逗号分隔的 CORS 来源；生产未配置时仅允许同源 */
  CORS_ORIGINS: z.string().optional(),
  /** 为 true 时才信任 X-Forwarded-For */
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
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
