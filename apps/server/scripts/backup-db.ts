#!/usr/bin/env bun
/**
 * SQLite 热备份：VACUUM INTO 生成一致快照，不中断正在运行的服务。
 * 用法：bun run db:backup
 * 数据库路径与备份目录来自 config/cogm.toml（或 cogm.local.toml）。
 */
import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { loadConfig } from "@/config/app-config";

const config = loadConfig();
const databaseUrl = config.databaseUrl;
if (databaseUrl === ":memory:") {
  console.error("Cannot backup an in-memory database");
  process.exit(1);
}

const source = resolve(databaseUrl);
const backupDir = resolve(config.backupDir ?? join(dirname(source), "backups"));
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
