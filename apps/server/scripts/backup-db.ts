#!/usr/bin/env bun
/**
 * SQLite 热备份：VACUUM INTO 生成一致快照，不中断正在运行的服务。
 * 用法：bun run db:backup
 * 覆盖 DATABASE_URL（相对 server 工作目录）和 BACKUP_DIR。
 */
import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const databaseUrl = process.env.DATABASE_URL ?? "data/db.sqlite";
if (databaseUrl === ":memory:") {
  console.error("Cannot backup an in-memory database");
  process.exit(1);
}

const source = resolve(databaseUrl);
const backupDir = resolve(process.env.BACKUP_DIR ?? join(dirname(source), "backups"));
await mkdir(backupDir, { recursive: true });

const stamp = new Date().toISOString().replaceAll(":", "-");
const dest = join(backupDir, `db-${stamp}.sqlite`);

const db = new Database(source, { readonly: true });
try {
  db.exec(`VACUUM INTO '${dest.replaceAll("'", "''")}'`);
} finally {
  db.close();
}

console.log(`Backup written to ${dest}`);
