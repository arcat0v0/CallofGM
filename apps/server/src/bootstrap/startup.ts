import { lt, and, isNotNull, eq } from "drizzle-orm";
import { type DbClient } from "@/platform/db/client";
import { runMigrations } from "@/platform/db/migration";
import { sessionOutbox, blacklistEntries } from "@/platform/db/schema";
import { mkdir } from "fs/promises";
import { dirname } from "path";

export class StartupService {
  private db: DbClient;
  private databaseUrl: string;
  private ready = false;

  constructor(db: DbClient, databaseUrl: string) {
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
    this.ready = true;
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
      console.log(`[Startup] Recovered ${recovered.length} pending outbox events`);
    }
  }

  /** 过期黑名单在读取时视为无效，启动时物理清理 */
  private async cleanupExpiredBlacklist(): Promise<void> {
    const now = Date.now();
    const removed = await this.db
      .delete(blacklistEntries)
      .where(and(isNotNull(blacklistEntries.expiresAt), lt(blacklistEntries.expiresAt, now)))
      .returning({ id: blacklistEntries.id });
    if (removed.length > 0) {
      console.log(`[Startup] Cleaned up ${removed.length} expired blacklist entries`);
    }
  }

  isReady(): boolean {
    return this.ready;
  }
}
