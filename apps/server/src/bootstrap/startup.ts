import type { Database } from "bun:sqlite";
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { mkdir } from "fs/promises";
import { dirname } from "path";
import type { DbClient } from "@/platform/db/client";
import { runMigrations } from "@/platform/db/migration";
import { blacklistEntries, sessionOutbox } from "@/platform/db/schema";
import { logger } from "@/platform/logging/logger";

const BLACKLIST_CLEANUP_MS = 60 * 60 * 1000;

export class StartupService {
	private db: DbClient;
	private sqlite: Database;
	private databaseUrl: string;
	private ready = false;
	private cleanupTimer: ReturnType<typeof setInterval> | null = null;

	constructor(sqlite: Database, db: DbClient, databaseUrl: string) {
		this.sqlite = sqlite;
		this.db = db;
		this.databaseUrl = databaseUrl;
	}

	async startup(): Promise<void> {
		if (this.databaseUrl !== ":memory:") {
			const dir = dirname(this.databaseUrl);
			await mkdir(dir, { recursive: true });
		}

		await runMigrations(this.db);
		await this.recoverOutbox();
		await this.cleanupExpiredBlacklist();
		this.cleanupTimer = setInterval(() => {
			this.cleanupExpiredBlacklist().catch((err) => {
				logger.error("periodic blacklist cleanup failed", { err });
			});
		}, BLACKLIST_CLEANUP_MS);
		this.ready = true;
	}

	stop(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;
		}
		this.ready = false;
	}

	pingDatabase(): boolean {
		try {
			this.sqlite.query("SELECT 1").get();
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * outbox 恢复：进程在“数据库已提交但尚未广播”窗口崩溃后，
	 * 重启时没有任何活跃连接（ring buffer 为空），重连客户端一律走全量快照。
	 * 因此 pending 记录只需标记为已投递，事件内容仍持久在 outbox 供快照历史查询。
	 */
	private async recoverOutbox(): Promise<void> {
		const recovered = await this.db
			.update(sessionOutbox)
			.set({ status: "delivered" })
			.where(eq(sessionOutbox.status, "pending"))
			.returning({ id: sessionOutbox.id });
		if (recovered.length > 0) {
			logger.info("recovered pending outbox events", {
				count: recovered.length,
			});
		}
	}

	/**
	 * 过期黑名单在读取时即视为无效（isFingerprintBlacklisted 带 expiresAt 条件），
	 * 全局软删除约束下不再做物理清理，仅保留启动日志便于运维观察。
	 */
	private async cleanupExpiredBlacklist(): Promise<void> {
		const rows = await this.db
			.select({ id: blacklistEntries.id })
			.from(blacklistEntries)
			.where(
				and(
					isNotNull(blacklistEntries.expiresAt),
					lt(blacklistEntries.expiresAt, Date.now()),
				),
			);
		if (rows.length > 0) {
			logger.info("expired blacklist entries remain (soft delete policy)", {
				count: rows.length,
			});
		}
	}

	isReady(): boolean {
		return this.ready;
	}
}
