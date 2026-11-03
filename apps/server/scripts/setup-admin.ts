import { parseEnv } from "@/config/env";
import { createDb } from "@/platform/db/client";
import { runMigrations } from "@/platform/db/migration";
import { DrizzleIdentityRepository } from "@/modules/identity";
import { CreateUserUseCase } from "@/modules/identity";
import { SystemClock, UuidGenerator } from "@/platform/ports";

const args = process.argv.slice(2);
const username = args[0] ?? process.env.COGM_ADMIN_USERNAME;
let password = args[1] ?? process.env.COGM_ADMIN_PASSWORD;

if (!username || !password) {
  console.error("用法: bun run setup:admin <用户名> <密码>");
  process.exit(1);
}

const env = parseEnv();
const dbContext = createDb(env.DATABASE_URL);
await runMigrations(dbContext.db);

const repo = new DrizzleIdentityRepository(dbContext.db);
const clock = new SystemClock();
const existing = await repo.findUserByUsernameNormalized(username.trim().toLowerCase());
if (existing) {
  await repo.updateUser(existing.id, {
    passwordHash: await Bun.password.hash(password),
    role: "admin",
    disabledAt: null,
    deletedAt: null,
    updatedAt: clock.nowEpochMs(),
  });
  console.log(`已更新管理员 ${existing.username}`);
} else {
  const created = await new CreateUserUseCase(new UuidGenerator(), clock, repo).execute({
    username,
    password,
    role: "admin",
  });
  console.log(`已创建管理员 ${created.username}`);
}
process.exit(0);
