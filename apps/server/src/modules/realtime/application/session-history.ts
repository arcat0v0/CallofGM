import { and, desc, eq, inArray, isNotNull, lt } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import { sessionMessages, sessionOutbox } from "@/platform/db/schema";
import type { ActorContext } from "@/modules/identity";
import type { HistoryItem, HistoryPage } from "@cogm/shared";
import { checkVisibility, type VisibilityScope } from "../domain/visibility";
import { collectCharacterIds, loadCharacterNames, toMessageDto } from "./chat-message-mapper";

const ACTIVITY_EVENT_TYPES = ["dice:rolled", "check:resolved"] as const;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const SCAN_BATCH = 100;
const MAX_SCAN = 2000;

type Candidate =
  | { eventId: number; kind: "chat"; row: typeof sessionMessages.$inferSelect }
  | { eventId: number; kind: "activity"; row: typeof sessionOutbox.$inferSelect };

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
    const collected: Candidate[] = [];
    let scanCursor = input.beforeEventId ?? null;
    let exhausted = false;
    let scanned = 0;

    while (collected.length < limit + 1 && scanned < MAX_SCAN) {
      const batch = await this.scanBatch(input.sessionId, scanCursor, SCAN_BATCH);
      if (batch.length === 0) {
        exhausted = true;
        break;
      }
      scanned += batch.length;
      scanCursor = batch[batch.length - 1]!.eventId;
      for (const candidate of batch) {
        if (candidate.kind === "activity" && !this.isVisible(candidate.row, input)) {
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

  private isVisible(row: typeof sessionOutbox.$inferSelect, input: {
    actor: ActorContext;
    claimedCharacterId: string | null;
    connectionId: string;
  }): boolean {
    let visibility: VisibilityScope;
    try {
      visibility = JSON.parse(row.visibilityJson) as VisibilityScope;
    } catch {
      return false;
    }
    return checkVisibility(input.actor, input.claimedCharacterId, visibility, input.connectionId);
  }

  private async scanBatch(sessionId: string, beforeEventId: number | null, batchSize: number): Promise<Candidate[]> {
    const messageConditions = [
      eq(sessionMessages.sessionId, sessionId),
      eq(sessionMessages.status, "presented"),
      isNotNull(sessionMessages.eventId),
    ];
    const eventConditions = [
      eq(sessionOutbox.sessionId, sessionId),
      inArray(sessionOutbox.type, [...ACTIVITY_EVENT_TYPES]),
    ];
    if (beforeEventId !== null) {
      messageConditions.push(lt(sessionMessages.eventId, beforeEventId));
      eventConditions.push(lt(sessionOutbox.eventId, beforeEventId));
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
        .from(sessionOutbox)
        .where(and(...eventConditions))
        .orderBy(desc(sessionOutbox.eventId))
        .limit(batchSize),
    ]);

    const candidates: Candidate[] = [
      ...messageRows.map((row) => ({ eventId: row.eventId as number, kind: "chat" as const, row })),
      ...eventRows.map((row) => ({ eventId: row.eventId, kind: "activity" as const, row })),
    ];
    candidates.sort((a, b) => b.eventId - a.eventId);
    return candidates.slice(0, batchSize);
  }

  private async toItems(db: DbClient, ascending: Candidate[]): Promise<HistoryItem[]> {
    const chatRows = ascending.filter((c) => c.kind === "chat").map((c) => c.row as typeof sessionMessages.$inferSelect);
    const nameMap = await loadCharacterNames(db, collectCharacterIds(chatRows));

    return ascending.map((candidate) => {
      if (candidate.kind === "chat") {
        return {
          kind: "chat" as const,
          eventId: candidate.eventId,
          message: toMessageDto(candidate.row, nameMap),
        };
      }
      return {
        kind: "activity" as const,
        eventId: candidate.eventId,
        type: candidate.row.type,
        occurredAt: candidate.row.createdAt,
        payload: JSON.parse(candidate.row.payloadJson),
      };
    });
  }
}