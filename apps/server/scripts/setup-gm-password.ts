import { createDb } from "../src/platform/db/client";
import { runMigrations } from "../src/platform/db/migration";
import { DrizzleIdentityRepository } from "../src/modules/identity";

const databaseUrl = process.env.DATABASE_URL ?? "data/db.sqlite";

const password = process.argv[2] ?? prompt("请输入 GM 密码：");
if (!password || password.trim() === "") {
  console.error("用法: bun run setup:gm <密码>");
  process.exit(1);
}

const { db, sqlite } = createDb(databaseUrl);
await runMigrations(db);
const repo = new DrizzleIdentityRepository(db);
await repo.saveGmPasswordHash(await Bun.password.hash(password), Date.now());
sqlite.close();

console.log(`GM 密码已重置（数据库: ${databaseUrl}）`);
