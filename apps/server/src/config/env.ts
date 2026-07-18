import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().default("data/db.sqlite"),
  GM_PASSWORD_HASH: z.string().default("$argon2id$v=19$m=65536,t=2,p=1$67s8bMY7vudyDYlrt6OO97+VgLsFP/+Ok80EMkwESHQ$bs1IpVx/mtJ6wOI8HnrTodq3aYmC1KIIuMTEpv02yTc"),
  /** 玩家 token HMAC 签名密钥；生产环境必须显式配置 */
  PLAYER_TOKEN_SECRET: z.string().default("dev-player-secret-key"),
  /** 上传媒体根目录 */
  MEDIA_DIR: z.string().default("data/media"),
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
