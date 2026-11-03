import { eq, inArray } from "drizzle-orm";
import type { SessionEvent } from "@cogm/shared";
import type { DbClient } from "@/platform/db/client";
import type { TransactionRunner } from "@/platform/db/transaction";
import { sessions, sessionOutbox } from "@/platform/db/schema";
import type { Clock, IdGenerator } from "@/platform/ports";
import { SessionNotFoundError } from "@/modules/sessions";
import type { ConnectionRegistry } from "./connection-registry";
import type { EventRingBuffer } from "./event-ring-buffer";
import type { VisibilityScope } from "./domain/visibility";
import type { ProducedEvent } from "./application/command-handler";
import type { SessionHistoryRecorder } from "./application/history-recorder";

export interface StagedEvents {
  sessionId: string;
  outboxIds: string[];
  entries: Array<{ event: SessionEvent; visibility: VisibilityScope }>;
}

/**
 * 实时事件总线：eventId 分配 → outbox 落库 →（事务提交后）→ ring buffer → 按可见性发布。
 * 禁止在数据库提交前广播；outbox 覆盖“已提交但尚未广播即崩溃”的窗口。
 */
export class SessionEventBus {
  constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly ringBuffer: EventRingBuffer,
    private readonly connectionRegistry: ConnectionRegistry,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly historyRecorder: SessionHistoryRecorder
  ) {}

  /**
   * 在既有事务内分配连续 eventId、写 outbox、推进 sessions.last_event_id。
   * 提交前不得调用 deliver。
   */
  async stage(tx: DbClient, sessionId: string, produced: ProducedEvent[]): Promise<StagedEvents> {
    const staged: StagedEvents = { sessionId, outboxIds: [], entries: [] };
    if (produced.length === 0) {
      return staged;
    }

    const rows = await tx
      .select({ lastEventId: sessions.lastEventId })
      .from(sessions)
      .where(eq(sessions.id, sessionId));
    const row = rows[0];
    if (!row) {
      throw new SessionNotFoundError();
    }

    const now = this.clock.nowEpochMs();
    let nextEventId = row.lastEventId;
    for (const p of produced) {
      nextEventId += 1;
      const event: SessionEvent = {
        protocolVersion: 1,
        eventId: nextEventId,
        type: p.type,
        occurredAt: now,
        payload: p.payload,
      };
      const outboxId = this.idGenerator.nextId();
      await tx.insert(sessionOutbox).values({
        id: outboxId,
        sessionId,
        eventId: nextEventId,
        type: p.type,
        payloadJson: JSON.stringify(p.payload),
        visibilityJson: JSON.stringify(p.visibility),
        status: "pending",
        createdAt: now,
      });
      staged.outboxIds.push(outboxId);
      staged.entries.push({ event, visibility: p.visibility });
    }

    await tx.update(sessions).set({ lastEventId: nextEventId }).where(eq(sessions.id, sessionId));
    await this.historyRecorder.record(tx, sessionId, staged);
    return staged;
  }

  resetRingBuffer(sessionId: string, minValidEventId: number): void {
    this.ringBuffer.evict(sessionId);
    this.ringBuffer.markReset(sessionId, minValidEventId);
  }

  /** 事务提交后：事件入 ring buffer、按可见范围发布、标记 outbox 已投递。 */
  async deliver(staged: StagedEvents): Promise<void> {
    for (const entry of staged.entries) {
      this.ringBuffer.add(staged.sessionId, entry.event, entry.visibility);
      await this.connectionRegistry.publish(staged.sessionId, entry.event, entry.visibility);
    }
    if (staged.outboxIds.length > 0) {
      await this.db
        .update(sessionOutbox)
        .set({ status: "delivered" })
        .where(inArray(sessionOutbox.id, staged.outboxIds));
    }
  }

  /** 独立事务一站式发送（HTTP 路由等非 executor 调用方使用）。 */
  async emit(sessionId: string, produced: ProducedEvent[]): Promise<SessionEvent[]> {
    const staged = await this.transactionRunner.run((tx) => this.stage(tx, sessionId, produced));
    await this.deliver(staged);
    return staged.entries.map((e) => e.event);
  }
}
