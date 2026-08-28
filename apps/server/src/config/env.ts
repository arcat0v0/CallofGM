import { z } from "zod";
import { parseCorsOrigins } from "@/platform/security/origin";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().default(15632),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().default("data/db.sqlite"),
  GM_PASSWORD_HASH: z.string().default("$argon2id$v=19$m=65536,t=2,p=1$npi5iaUalSoKbb21jzwXOSSfb0xdW2n8ZVFBbw3L1jQ$WupJUJPiAB0gXzuOlOIMf17UDal+hZKZytb1+6cTKdg"),
  /** 历史配置项；opaque player token 不再使用 HMAC，生产仍要求显式设置以免空仓库误部署 */
  PLAYER_TOKEN_SECRET: z.string().default("dev-player-secret-key"),
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
  const env = parsed.data;
  if (env.NODE_ENV === "production") {
    if (!process.env.GM_PASSWORD_HASH) {
      throw new Error("GM_PASSWORD_HASH must be explicitly configured in production");
    }
    if (!process.env.PLAYER_TOKEN_SECRET || env.PLAYER_TOKEN_SECRET === "dev-player-secret-key") {
      throw new Error("PLAYER_TOKEN_SECRET must be explicitly configured in production");
    }
  }
  return env;
}

export function corsOriginsFor(env: Env): string[] {
  return parseCorsOrigins(env.CORS_ORIGINS, env.NODE_ENV);
}
