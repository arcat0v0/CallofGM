import { and, desc, eq, isNotNull, isNull, lt } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import {
  sessionMessages,
  sessionHistoryEvents,
  sessionRewinds,
} from "@/platform/db/schema";
import type { ActorContext } from "@/modules/identity";
import type {
  HistoryArchiveGroup,
  HistoryArchiveItemsReply,
  HistoryAuditReply,
  HistoryItem,
  HistoryPage,
  SnapshotRewindNotice,
} from "@cogm/shared";
import {
  ARCHIVE_DEFAULT_LIMIT,
  ARCHIVE_MAX_LIMIT,
  AUDIT_DEFAULT_LIMIT,
  AUDIT_MAX_LIMIT,
} from "@cogm/shared";
import { checkVisibility, type VisibilityScope } from "../domain/visibility";
import { collectCharacterIds, loadCharacterNames, toMessageDto } from "./chat-message-mapper";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const SCAN_BATCH = 100;
const MAX_SCAN = 2000;

type LiveCandidate =
  | { eventId: number; kind: "chat"; row: typeof sessionMessages.$inferSelect }
  | { eventId: number; kind: "activity"; row: typeof sessionHistoryEvents.$inferSelect };

type ArchiveCandidate = LiveCandidate;

export class SessionHistoryPager {
  constructor(private readonly db: DbClient) {}

  async page(input: {
    sessionId: string;
    actor: ActorContext;
    claimedCharacterId: string | null;
    connectionId: string;
    beforeEventId?: number | null;
    limit?: number;
  }): Promise<HistoryPage> {
    const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const collected: LiveCandidate[] = [];
    let scanCursor = input.beforeEventId ?? null;
    let exhausted = false;
    let scanned = 0;

    while (collected.length < limit + 1 && scanned < MAX_SCAN) {
      const batch = await this.scanLiveBatch(input, scanCursor, SCAN_BATCH);
      if (batch.length === 0) {
        exhausted = true;
        break;
      }
      scanned += batch.length;
      scanCursor = batch[batch.length - 1]!.eventId;
      for (const candidate of batch) {
        if (
          candidate.kind === "activity" &&
          !this.isVisible(candidate.row, input)
        ) {
          continue;
        }
        collected.push(candidate);
        if (collected.length >= limit + 1) {
          break;
        }
      }
    }

    const pageDescending = collected.slice(0, limit);
    const hasMore = collected.length > limit || (pageDescending.length > 0 && !exhausted);
    const items = await this.toItems(this.db, pageDescending.reverse());
    return {
      items,
      hasMore,
      beforeEventId: hasMore ? (pageDescending[0]?.eventId ?? null) : null,
    };
  }

  async archiveGroups(sessionId: string): Promise<HistoryArchiveGroup[]> {
    const rows = await this.db
      .select()
      .from(sessionRewinds)
      .where(eq(sessionRewinds.sessionId, sessionId))
      .orderBy(desc(sessionRewinds.createdAt));
    return rows.map((row) => ({
      id: row.id,
      action: row.action === "undo" ? "undo" : "rewind",
      createdAt: row.createdAt,
      anchorEventId: row.anchorEventId,
      anchorOccurredAt: row.anchorOccurredAt,
      reason: row.reason ?? null,
      undoneAt: row.undoneAt ?? null,
      targetRewindId: row.targetRewindId ?? null,
      archivedMessageCount: row.archivedMessageCount,
      archivedEventCount: row.archivedEventCount,
    }));
  }

  async archivePage(input: {
    sessionId: string;
    rewindId: string;
    beforeEventId?: number | null;
    limit?: number;
  }): Promise<HistoryArchiveItemsReply> {
    const limit = Math.min(Math.max(input.limit ?? ARCHIVE_DEFAULT_LIMIT, 1), ARCHIVE_MAX_LIMIT);
    const collected: ArchiveCandidate[] = [];
    let scanCursor = input.beforeEventId ?? null;
    let exhausted = false;
    let scanned = 0;

    while (collected.length < limit + 1 && scanned < MAX_SCAN) {
      const batch = await this.scanArchiveBatch(input.sessionId, input.rewindId, scanCursor, SCAN_BATCH);
      if (batch.length === 0) {
        exhausted = true;
        break;
      }
      scanned += batch.length;
      scanCursor = batch[batch.length - 1]!.eventId;
      collected.push(...batch.slice(0, limit + 1 - collected.length));
    }

    const pageDescending = collected.slice(0, limit);
    const hasMore = collected.length > limit || (pageDescending.length > 0 && !exhausted);
    const items = await this.toItems(this.db, pageDescending.reverse());
    return {
      items: items.map((item) => ({ ...item, archivedAt: item.archivedAt ?? 0 })),
      hasMore,
      beforeEventId: hasMore ? (pageDescending[0]?.eventId ?? null) : null,
    };
  }

  async auditPage(input: {
    sessionId: string;
    beforeCreatedAt?: number | null;
    limit?: number;
  }): Promise<HistoryAuditReply> {
    const limit = Math.min(Math.max(input.limit ?? AUDIT_DEFAULT_LIMIT, 1), AUDIT_MAX_LIMIT);
    const conditions = [
      eq(sessionMessages.sessionId, input.sessionId),
      eq(sessionMessages.status, "discarded"),
    ];
    if (input.beforeCreatedAt) {
      conditions.push(lt(sessionMessages.createdAt, input.beforeCreatedAt));
    }
    const rows = await this.db
      .select()
      .from(sessionMessages)
      .where(and(...conditions))
      .orderBy(desc(sessionMessages.createdAt))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const nameMap = await loadCharacterNames(this.db, collectCharacterIds(page));
    return {
      items: page.map((row) => toMessageDto(row, nameMap)),
      hasMore,
      beforeCreatedAt: hasMore ? (page[page.length - 1]?.createdAt ?? null) : null,
    };
  }

  async latestRewind(sessionId: string): Promise<SnapshotRewindNotice | null> {
    const rows = await this.db
      .select()
      .from(sessionRewinds)
      .where(eq(sessionRewinds.sessionId, sessionId))
      .orderBy(desc(sessionRewinds.createdAt))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      action: row.action === "undo" ? "undo" : "rewind",
      eventId: row.rewindEventId ?? 0,
      anchorEventId: row.anchorEventId,
      occurredAt: row.createdAt,
    };
  }

  private isVisible(
    row: typeof sessionHistoryEvents.$inferSelect,
    input: {
      actor: ActorContext;
      claimedCharacterId: string | null;
      connectionId: string;
    }
  ): boolean {
    let visibility: VisibilityScope;
    try {
      visibility = JSON.parse(row.visibilityJson) as VisibilityScope;
    } catch {
      return false;
    }
    return checkVisibility(input.actor, input.claimedCharacterId, visibility, input.connectionId);
  }

  private async scanLiveBatch(
    input: {
      sessionId: string;
      actor: ActorContext;
      claimedCharacterId: string | null;
      connectionId: string;
    },
    beforeEventId: number | null,
    batchSize: number
  ): Promise<LiveCandidate[]> {
    const messageConditions = [
      eq(sessionMessages.sessionId, input.sessionId),
      eq(sessionMessages.status, "presented"),
      isNotNull(sessionMessages.eventId),
      isNull(sessionMessages.archivedAt),
    ];
    const eventConditions = [
      eq(sessionHistoryEvents.sessionId, input.sessionId),
      isNull(sessionHistoryEvents.archivedAt),
    ];
    if (input.actor.type !== "gm") {
      eventConditions.push(eq(sessionHistoryEvents.playerVisible, 1));
    }
    if (beforeEventId !== null) {
      messageConditions.push(lt(sessionMessages.eventId, beforeEventId));
      eventConditions.push(lt(sessionHistoryEvents.eventId, beforeEventId));
    }

    const [messageRows, eventRows] = await Promise.all([
      this.db
        .select()
        .from(sessionMessages)
        .where(and(...messageConditions))
        .orderBy(desc(sessionMessages.eventId))
        .limit(batchSize),
      this.db
        .select()
        .from(sessionHistoryEvents)
        .where(and(...eventConditions))
        .orderBy(desc(sessionHistoryEvents.eventId))
        .limit(batchSize),
    ]);

    const candidates: LiveCandidate[] = [
      ...messageRows.map((row) => ({ eventId: row.eventId as number, kind: "chat" as const, row })),
      ...eventRows.map((row) => ({ eventId: row.eventId, kind: "activity" as const, row })),
    ];
    candidates.sort((a, b) => b.eventId - a.eventId);
    return candidates.slice(0, batchSize);
  }

  private async scanArchiveBatch(
    sessionId: string,
    rewindId: string,
    beforeEventId: number | null,
    batchSize: number
  ): Promise<ArchiveCandidate[]> {
    const messageConditions = [
      eq(sessionMessages.sessionId, sessionId),
      eq(sessionMessages.archivedByRewindId, rewindId),
      isNotNull(sessionMessages.eventId),
    ];
    const eventConditions = [
      eq(sessionHistoryEvents.sessionId, sessionId),
      eq(sessionHistoryEvents.archivedByRewindId, rewindId),
    ];
    if (beforeEventId !== null) {
      messageConditions.push(lt(sessionMessages.eventId, beforeEventId));
      eventConditions.push(lt(sessionHistoryEvents.eventId, beforeEventId));
    }

    const [messageRows, eventRows] = await Promise.all([
      this.db
        .select()
        .from(sessionMessages)
        .where(and(...messageConditions))
        .orderBy(desc(sessionMessages.eventId))
        .limit(batchSize),
      this.db
        .select()
        .from(sessionHistoryEvents)
        .where(and(...eventConditions))
        .orderBy(desc(sessionHistoryEvents.eventId))
        .limit(batchSize),
    ]);

    const candidates: ArchiveCandidate[] = [
      ...messageRows.map((row) => ({ eventId: row.eventId as number, kind: "chat" as const, row })),
      ...eventRows.map((row) => ({ eventId: row.eventId, kind: "activity" as const, row })),
    ];
    candidates.sort((a, b) => b.eventId - a.eventId);
    return candidates.slice(0, batchSize);
  }

  private async toItems(db: DbClient, ascending: LiveCandidate[]): Promise<HistoryItem[]> {
    const chatRows = ascending
      .filter((candidate) => candidate.kind === "chat")
      .map((candidate) => candidate.row as typeof sessionMessages.$inferSelect);
    const nameMap = await loadCharacterNames(db, collectCharacterIds(chatRows));

    return ascending.map((candidate) => {
      if (candidate.kind === "chat") {
        return {
          kind: "chat" as const,
          eventId: candidate.eventId,
          occurredAt: candidate.row.presentedAt ?? candidate.row.createdAt,
          archivedAt: candidate.row.archivedAt ?? null,
          message: toMessageDto(candidate.row, nameMap),
        };
      }
      return {
        kind: "activity" as const,
        eventId: candidate.eventId,
        type: candidate.row.type,
        occurredAt: candidate.row.occurredAt,
        archivedAt: candidate.row.archivedAt ?? null,
        payload: JSON.parse(candidate.row.payloadJson),
      };
    });
  }
}
