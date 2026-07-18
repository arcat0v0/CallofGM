import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { type DbClient } from "./client";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runMigrations(db: DbClient): Promise<void> {
  const migrationsFolder = join(__dirname, "../../../migrations");
  await migrate(db, { migrationsFolder });
}
