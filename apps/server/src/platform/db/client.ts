import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { mkdirSync } from "fs";
import { dirname } from "path";

export type DbClient = BunSQLiteDatabase<typeof schema>;

export interface DbContext {
  db: DbClient;
  sqlite: Database;
}

export function createDb(databaseUrl: string): DbContext {
  if (databaseUrl !== ":memory:") {
    mkdirSync(dirname(databaseUrl), { recursive: true });
  }
  const sqlite = new Database(databaseUrl);
  sqlite.exec("PRAGMA foreign_keys = ON;");
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA busy_timeout = 5000;");
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}
