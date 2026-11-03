import { and, count, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import {
  HistoryArchiveItemsQuery,
  HistoryAuditQuery,
  RewindCommand,
  RewindPreviewQuery,
  UndoRewindCommand,
  type RewindPreview,
  type SessionPhase,
} from "@cogm/shared";
import type { DbClient } from "@/platform/db/client";
import type { IdGenerator } from "@/platform/ports";
import { AppError } from "@/platform/errors/app-error";
import { ForbiddenError } from "@/modules/identity";
import {
  characters,
  checkRequests,
  handoutGrantRecipients,
  handoutGrants,
  handoutReads,
  handouts,
  scenes,
  sessionCharacters,
  sessionHistoryEvents,
  sessionMessages,
  sessionRewinds,
  sessionRuntimeCheckpoints,
  sessions,
} from "@/platform/db/schema";
import type {
  CommandHandler,
  CommandHandlerContext,
  CommandHandlerResult,
  ProducedEvent,
} from "./command-handler";
import { SessionHistoryPager } from "./session-history";
import { loadCharacterNames } from "./chat-message-mapper";
import type { RuntimeSnapshot } from "./runtime-snapshot";

const PENDING_REJECTION_REASON = "因回溯未呈现";

interface ResolvedAnchor {
  eventId: number;
  occurredAt: number;
}

interface ResolvedCheckpoint {
  eventId: number;
  snapshot: RuntimeSnapshot;
}

async function resolveAnchor(tx: DbClient, sessionId: string, eventId: number): Promise<ResolvedAnchor> {
  const messageRows = await tx
    .select({ presentedAt: sessionMessages.presentedAt, createdAt: sessionMessages.createdAt })
    .from(sessionMessages)
    .where(
      and(
        eq(sessionMessages.sessionId, sessionId),
        eq(sessionMessages.eventId, eventId),
        eq(sessionMessages.status, "presented"),
        isNull(sessionMessages.archivedAt)
      )
    )
    .limit(1);
  const message = messageRows[0];
  if (message) {
    return { eventId, occurredAt: message.presentedAt ?? message.createdAt };
  }

  const eventRows = await tx
    .select({ occurredAt: sessionHistoryEvents.occurredAt })
    .from(sessionHistoryEvents)
    .where(
      and(
        eq(sessionHistoryEvents.sessionId, sessionId),
        eq(sessionHistoryEvents.eventId, eventId),
        eq(sessionHistoryEvents.anchorable, 1),
        isNull(sessionHistoryEvents.archivedAt)
      )
    )
    .limit(1);
  const event = eventRows[0];
  if (event) {
    return { eventId, occurredAt: event.occurredAt };
  }

  throw new AppError("REWIND_ANCHOR_NOT_FOUND", "Rewind anchor not found in the active timeline", 404);
}

async function findCheckpointBefore(
  tx: DbClient,
  sessionId: string,
  beforeEventId: number
): Promise<ResolvedCheckpoint | null> {
  const rows = await tx
    .select()
    .from(sessionRuntimeCheckpoints)
    .where(
      and(
        eq(sessionRuntimeCheckpoints.sessionId, sessionId),
        lt(sessionRuntimeCheckpoints.eventId, beforeEventId)
      )
    )
    .orderBy(desc(sessionRuntimeCheckpoints.eventId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return { eventId: row.eventId, snapshot: JSON.parse(row.stateJson) as RuntimeSnapshot };
}

async function archiveLiveTimeline(
  tx: DbClient,
  sessionId: string,
  fromEventId: number,
  rewindId: string,
  now: number
): Promise<{ archivedMessageCount: number; archivedEventCount: number }> {
  const archivedMessages = await tx
    .update(sessionMessages)
    .set({ archivedAt: now, archivedByRewindId: rewindId })
    .where(
      and(
        eq(sessionMessages.sessionId, sessionId),
        eq(sessionMessages.status, "presented"),
        gte(sessionMessages.eventId, fromEventId),
        isNull(sessionMessages.archivedAt)
      )
    )
    .returning({ id: sessionMessages.id });
  const archivedEvents = await tx
    .update(sessionHistoryEvents)
    .set({ archivedAt: now, archivedByRewindId: rewindId })
    .where(
      and(
        eq(sessionHistoryEvents.sessionId, sessionId),
        gte(sessionHistoryEvents.eventId, fromEventId),
        isNull(sessionHistoryEvents.archivedAt)
      )
    )
    .returning({ id: sessionHistoryEvents.id });
  return {
    archivedMessageCount: archivedMessages.length,
    archivedEventCount: archivedEvents.length,
  };
}

async function restoreArchivedTimeline(
  tx: DbClient,
  sessionId: string,
  rewindId: string
): Promise<void> {
  await tx
    .update(sessionMessages)
    .set({ archivedAt: null, archivedByRewindId: null })
    .where(
      and(
        eq(sessionMessages.sessionId, sessionId),
        eq(sessionMessages.archivedByRewindId, rewindId)
      )
    );
  await tx
    .update(sessionHistoryEvents)
    .set({ archivedAt: null, archivedByRewindId: null })
    .where(
      and(
        eq(sessionHistoryEvents.sessionId, sessionId),
        eq(sessionHistoryEvents.archivedByRewindId, rewindId)
      )
    );
}

async function discardPendingMessages(
  tx: DbClient,
  sessionId: string
): Promise<Array<{ messageId: string; senderId: string }>> {
  const rows = await tx
    .update(sessionMessages)
    .set({ status: "discarded", rejectionReason: PENDING_REJECTION_REASON })
    .where(
      and(eq(sessionMessages.sessionId, sessionId), eq(sessionMessages.status, "pending"))
    )
    .returning({ id: sessionMessages.id, senderId: sessionMessages.senderId });
  return rows
    .filter((row): row is { id: string; senderId: string } => row.senderId !== null)
    .map((row) => ({ messageId: row.id, senderId: row.senderId }));
}

async function applyRuntimeSnapshot(
  tx: DbClient,
  sessionId: string,
  snapshot: RuntimeSnapshot,
  idGenerator: IdGenerator
): Promise<void> {
  await tx
    .update(sessions)
    .set({
      phase: snapshot.phase,
      currentSceneId: snapshot.currentSceneId,
    })
    .where(eq(sessions.id, sessionId));

  for (const character of snapshot.characters) {
    await tx
      .update(sessionCharacters)
      .set({
        currentExpressionKey: character.currentExpressionKey,
        stateJson: character.stateJson,
      })
      .where(
        and(
          eq(sessionCharacters.sessionId, sessionId),
          eq(sessionCharacters.characterId, character.characterId)
        )
      );
  }

  await tx.delete(checkRequests).where(eq(checkRequests.sessionId, sessionId));
  if (snapshot.checkRequests.length > 0) {
    await tx.insert(checkRequests).values(
      snapshot.checkRequests.map((request) => ({
        ...request,
        sessionId,
      }))
    );
  }

  const currentGrants = await tx
    .select({ id: handoutGrants.id })
    .from(handoutGrants)
    .where(eq(handoutGrants.sessionId, sessionId));
  const currentGrantIds = currentGrants.map((grant) => grant.id);
  if (currentGrantIds.length > 0) {
    await tx.delete(handoutReads).where(inArray(handoutReads.grantId, currentGrantIds));
    await tx
      .delete(handoutGrantRecipients)
      .where(inArray(handoutGrantRecipients.grantId, currentGrantIds));
    await tx.delete(handoutGrants).where(inArray(handoutGrants.id, currentGrantIds));
  }

  for (const grant of snapshot.handoutGrants) {
    await tx.insert(handoutGrants).values({
      id: grant.id,
      sessionId,
      handoutId: grant.handoutId,
      isPublic: grant.isPublic,
      createdAt: grant.createdAt,
    });
    if (grant.recipients.length > 0) {
      await tx.insert(handoutGrantRecipients).values(
        grant.recipients.map((characterId) => ({
          id: idGenerator.nextId(),
          grantId: grant.id,
          characterId,
          createdAt: grant.createdAt,
        }))
      );
    }
    if (grant.reads.length > 0) {
      await tx.insert(handoutReads).values(
        grant.reads.map((read) => ({
          id: idGenerator.nextId(),
          grantId: grant.id,
          playerId: read.playerId,
          readAt: read.readAt,
        }))
      );
    }
  }
}

async function buildPreview(ctx: CommandHandlerContext, anchorEventId: number): Promise<RewindPreview> {
  const anchor = await resolveAnchor(ctx.tx, ctx.sessionId, anchorEventId);
  const checkpoint = await findCheckpointBefore(ctx.tx, ctx.sessionId, anchorEventId);

  const [messageCountRow, activityCountRow, pendingCountRow, currentChecks, currentCharacters, currentGrants] =
    await Promise.all([
      ctx.tx
        .select({ value: count() })
        .from(sessionMessages)
        .where(
          and(
            eq(sessionMessages.sessionId, ctx.sessionId),
            eq(sessionMessages.status, "presented"),
            gte(sessionMessages.eventId, anchorEventId),
            isNull(sessionMessages.archivedAt)
          )
        ),
      ctx.tx
        .select({ value: count() })
        .from(sessionHistoryEvents)
        .where(
          and(
            eq(sessionHistoryEvents.sessionId, ctx.sessionId),
            gte(sessionHistoryEvents.eventId, anchorEventId),
            isNull(sessionHistoryEvents.archivedAt)
          )
        ),
      ctx.tx
        .select({ value: count() })
        .from(sessionMessages)
        .where(
          and(
            eq(sessionMessages.sessionId, ctx.sessionId),
            eq(sessionMessages.status, "pending")
          )
        ),
      ctx.tx
        .select({
          id: checkRequests.id,
          status: checkRequests.status,
          resolvedCheckResultJson: checkRequests.resolvedCheckResultJson,
        })
        .from(checkRequests)
        .where(eq(checkRequests.sessionId, ctx.sessionId)),
      ctx.tx
        .select({
          characterId: sessionCharacters.characterId,
          currentExpressionKey: sessionCharacters.currentExpressionKey,
          stateJson: sessionCharacters.stateJson,
        })
        .from(sessionCharacters)
        .where(eq(sessionCharacters.sessionId, ctx.sessionId)),
      ctx.tx
        .select({ id: handoutGrants.id, title: handouts.title })
        .from(handoutGrants)
        .innerJoin(handouts, eq(handoutGrants.handoutId, handouts.id))
        .where(eq(handoutGrants.sessionId, ctx.sessionId)),
    ]);

  let revokedHandoutTitles: string[] = [];
  let revertedCheckCount = 0;
  let characterChanges: Array<{ characterId: string; name: string }> = [];
  let phaseChange: RewindPreview["phaseChange"] = null;
  let sceneChange: RewindPreview["sceneChange"] = null;

  if (checkpoint) {
    const checkpointGrantIds = new Set(checkpoint.snapshot.handoutGrants.map((grant) => grant.id));
    for (const grant of currentGrants) {
      if (!checkpointGrantIds.has(grant.id) && !revokedHandoutTitles.includes(grant.title)) {
        revokedHandoutTitles.push(grant.title);
      }
    }

    const targetChecks = new Map(checkpoint.snapshot.checkRequests.map((request) => [request.id, request]));
    const currentCheckIds = new Set(currentChecks.map((request) => request.id));
    for (const current of currentChecks) {
      const target = targetChecks.get(current.id);
      if (
        !target ||
        target.status !== current.status ||
        target.resolvedCheckResultJson !== current.resolvedCheckResultJson
      ) {
        revertedCheckCount += 1;
      }
    }
    for (const target of checkpoint.snapshot.checkRequests) {
      if (!currentCheckIds.has(target.id)) {
        revertedCheckCount += 1;
      }
    }

    const currentCharactersById = new Map(
      currentCharacters.map((character) => [character.characterId, character])
    );
    const checkpointCharacterIds = new Set<string>();
    const changedCharacterIds: string[] = [];
    for (const target of checkpoint.snapshot.characters) {
      checkpointCharacterIds.add(target.characterId);
      const current = currentCharactersById.get(target.characterId);
      if (
        !current ||
        current.currentExpressionKey !== target.currentExpressionKey ||
        current.stateJson !== target.stateJson
      ) {
        changedCharacterIds.push(target.characterId);
      }
    }
    for (const current of currentCharacters) {
      if (!checkpointCharacterIds.has(current.characterId)) {
        changedCharacterIds.push(current.characterId);
      }
    }
    const nameMap = await loadCharacterNames(ctx.tx, changedCharacterIds);
    characterChanges = changedCharacterIds.map((characterId) => ({
      characterId,
      name: nameMap.get(characterId) ?? "Unknown",
    }));

    const currentPhase = ctx.session.phase as SessionPhase;
    const targetPhase = checkpoint.snapshot.phase as SessionPhase;
    if (currentPhase !== targetPhase) {
      phaseChange = { from: currentPhase, to: targetPhase };
    }

    const currentSceneId = ctx.session.currentSceneId ?? null;
    const targetSceneId = checkpoint.snapshot.currentSceneId ?? null;
    if (currentSceneId !== targetSceneId) {
      const sceneIds = [currentSceneId, targetSceneId].filter((id): id is string => id !== null);
      const sceneRows = sceneIds.length
        ? await ctx.tx.select({ id: scenes.id, name: scenes.name }).from(scenes).where(inArray(scenes.id, sceneIds))
        : [];
      const sceneNameById = new Map(sceneRows.map((scene) => [scene.id, scene.name]));
      sceneChange = {
        fromName: currentSceneId ? (sceneNameById.get(currentSceneId) ?? null) : null,
        toName: targetSceneId ? (sceneNameById.get(targetSceneId) ?? null) : null,
      };
    }
  }

  return {
    anchorEventId: anchor.eventId,
    anchorOccurredAt: anchor.occurredAt,
    messageCount: messageCountRow[0]?.value ?? 0,
    activityCount: activityCountRow[0]?.value ?? 0,
    pendingCount: pendingCountRow[0]?.value ?? 0,
    revokedHandoutTitles,
    revertedCheckCount,
    characterChanges,
    phaseChange,
    sceneChange,
    hasCheckpoint: checkpoint !== null,
  };
}

function rejectedPlayerMessages(
  discarded: Array<{ messageId: string; senderId: string }>
): NonNullable<CommandHandlerResult["directToPlayers"]> {
  return discarded.map((entry) => ({
    playerId: entry.senderId,
    message: {
      type: "chat:rejected",
      payload: { messageId: entry.messageId, reason: PENDING_REJECTION_REASON },
    },
  }));
}

class HistoryPreviewRewindHandler implements CommandHandler {
  readonly type = "history:preview-rewind" as const;
  readonly allowedStatuses = ["active"] as const;
  readonly transientReply = true;
  readonly skipHistoryCheckpoint = true;

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    if (ctx.actor.type !== "gm") {
      throw new ForbiddenError("Only the GM can preview a rewind");
    }
    const parsed = RewindPreviewQuery.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }
    const preview = await buildPreview(ctx, parsed.data.anchorEventId);
    return { replyPayload: { preview } };
  }
}

class HistoryRewindHandler implements CommandHandler {
  readonly type = "history:rewind" as const;
  readonly allowedStatuses = ["active"] as const;

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    if (ctx.actor.type !== "gm") {
      throw new ForbiddenError("Only the GM can rewind history");
    }
    const parsed = RewindCommand.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }
    const anchor = await resolveAnchor(ctx.tx, ctx.sessionId, parsed.data.anchorEventId);
    const checkpoint = await findCheckpointBefore(ctx.tx, ctx.sessionId, parsed.data.anchorEventId);
    if (!checkpoint) {
      throw new AppError("REWIND_CHECKPOINT_MISSING", "No runtime checkpoint before the rewind anchor", 409);
    }

    const now = ctx.clock.nowEpochMs();
    const rewindId = ctx.idGenerator.nextId();
    const { archivedMessageCount, archivedEventCount } = await archiveLiveTimeline(
      ctx.tx,
      ctx.sessionId,
      anchor.eventId,
      rewindId,
      now
    );
    const discarded = await discardPendingMessages(ctx.tx, ctx.sessionId);
    await applyRuntimeSnapshot(ctx.tx, ctx.sessionId, checkpoint.snapshot, ctx.idGenerator);

    const reason = parsed.data.reason && parsed.data.reason.length > 0 ? parsed.data.reason : null;
    await ctx.tx.insert(sessionRewinds).values({
      id: rewindId,
      sessionId: ctx.sessionId,
      action: "rewind",
      anchorEventId: anchor.eventId,
      anchorOccurredAt: anchor.occurredAt,
      headEventIdBefore: ctx.session.lastEventId,
      rewindEventId: null,
      targetRewindId: null,
      reason,
      archivedMessageCount,
      archivedEventCount,
      discardedPendingCount: discarded.length,
      undoneAt: null,
      createdAt: now,
    });

    const event: ProducedEvent = {
      type: "session:rewound",
      payload: {
        action: "rewind",
        rewindId,
        anchorEventId: anchor.eventId,
        anchorOccurredAt: anchor.occurredAt,
        archivedMessageCount,
        archivedEventCount,
        discardedPendingCount: discarded.length,
        reason: null,
      },
      visibility: { type: "public" },
    };

    return {
      events: [event],
      resetEventBuffer: true,
      directToSession: [{ type: "session:refresh", payload: { reason: "rewind" } }],
      directToPlayers: rejectedPlayerMessages(discarded),
      finalizeAfterStaged: async (tx, staged) => {
        const rewindEventId = staged.entries[staged.entries.length - 1]?.event.eventId;
        if (rewindEventId === undefined) {
          return;
        }
        await tx
          .update(sessionRewinds)
          .set({ rewindEventId })
          .where(eq(sessionRewinds.id, rewindId));
      },
      replyPayload: { rewindId, action: "rewind" },
    };
  }
}

class HistoryUndoRewindHandler implements CommandHandler {
  readonly type = "history:undo-rewind" as const;
  readonly allowedStatuses = ["active"] as const;

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    if (ctx.actor.type !== "gm") {
      throw new ForbiddenError("Only the GM can undo a rewind");
    }
    const parsed = UndoRewindCommand.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }

    const originalRows = await ctx.tx
      .select()
      .from(sessionRewinds)
      .where(
        and(
          eq(sessionRewinds.id, parsed.data.rewindId),
          eq(sessionRewinds.sessionId, ctx.sessionId)
        )
      )
      .limit(1);
    const original = originalRows[0];
    if (!original || original.action !== "rewind" || original.undoneAt !== null) {
      throw new AppError("REWIND_UNDO_OUT_OF_ORDER", "Only the latest active rewind can be undone", 409);
    }

    const latestRows = await ctx.tx
      .select({ id: sessionRewinds.id })
      .from(sessionRewinds)
      .where(
        and(
          eq(sessionRewinds.sessionId, ctx.sessionId),
          eq(sessionRewinds.action, "rewind"),
          isNull(sessionRewinds.undoneAt)
        )
      )
      .orderBy(desc(sessionRewinds.createdAt), sql`rowid desc`)
      .limit(1);
    if (latestRows[0]?.id !== original.id) {
      throw new AppError("REWIND_UNDO_OUT_OF_ORDER", "Only the latest active rewind can be undone", 409);
    }

    if (original.rewindEventId === null) {
      throw new AppError("REWIND_CHECKPOINT_MISSING", "No runtime checkpoint to undo the rewind", 409);
    }
    const checkpoint = await findCheckpointBefore(ctx.tx, ctx.sessionId, original.rewindEventId);
    if (!checkpoint) {
      throw new AppError("REWIND_CHECKPOINT_MISSING", "No runtime checkpoint to undo the rewind", 409);
    }

    const now = ctx.clock.nowEpochMs();
    const undoId = ctx.idGenerator.nextId();
    const { archivedMessageCount, archivedEventCount } = await archiveLiveTimeline(
      ctx.tx,
      ctx.sessionId,
      original.anchorEventId,
      undoId,
      now
    );
    await restoreArchivedTimeline(ctx.tx, ctx.sessionId, original.id);
    const discarded = await discardPendingMessages(ctx.tx, ctx.sessionId);
    await applyRuntimeSnapshot(ctx.tx, ctx.sessionId, checkpoint.snapshot, ctx.idGenerator);

    const reason = parsed.data.reason && parsed.data.reason.length > 0 ? parsed.data.reason : null;
    await ctx.tx.insert(sessionRewinds).values({
      id: undoId,
      sessionId: ctx.sessionId,
      action: "undo",
      anchorEventId: original.anchorEventId,
      anchorOccurredAt: original.anchorOccurredAt,
      headEventIdBefore: ctx.session.lastEventId,
      rewindEventId: null,
      targetRewindId: original.id,
      reason,
      archivedMessageCount,
      archivedEventCount,
      discardedPendingCount: discarded.length,
      undoneAt: null,
      createdAt: now,
    });
    await ctx.tx
      .update(sessionRewinds)
      .set({ undoneAt: now })
      .where(eq(sessionRewinds.id, original.id));

    const event: ProducedEvent = {
      type: "session:rewound",
      payload: {
        action: "undo",
        rewindId: undoId,
        anchorEventId: original.anchorEventId,
        anchorOccurredAt: original.anchorOccurredAt,
        archivedMessageCount,
        archivedEventCount,
        discardedPendingCount: discarded.length,
        reason: null,
        undoneRewindId: original.id,
      },
      visibility: { type: "public" },
    };

    return {
      events: [event],
      resetEventBuffer: true,
      directToSession: [{ type: "session:refresh", payload: { reason: "undo" } }],
      directToPlayers: rejectedPlayerMessages(discarded),
      finalizeAfterStaged: async (tx, staged) => {
        const rewindEventId = staged.entries[staged.entries.length - 1]?.event.eventId;
        if (rewindEventId === undefined) {
          return;
        }
        await tx.update(sessionRewinds).set({ rewindEventId }).where(eq(sessionRewinds.id, undoId));
      },
      replyPayload: { rewindId: undoId, action: "undo" },
    };
  }
}

class HistoryArchiveHandler implements CommandHandler {
  readonly type = "history:archive" as const;
  readonly allowedStatuses = ["waiting", "preparing", "active"] as const;
  readonly allowWhenEnded = true;
  readonly transientReply = true;
  readonly skipHistoryCheckpoint = true;

  async execute(ctx: CommandHandlerContext): Promise<CommandHandlerResult> {
    if (ctx.actor.type !== "gm") {
      throw new ForbiddenError("Only the GM can view archived history");
    }
    const pager = new SessionHistoryPager(ctx.tx);
    return { replyPayload: { groups: await pager.archiveGroups(ctx.sessionId) } };
  }
}

class HistoryArchiveItemsHandler implements CommandHandler {
  readonly type = "history:archive-items" as const;
  readonly allowedStatuses = ["waiting", "preparing", "active"] as const;
  readonly allowWhenEnded = true;
  readonly transientReply = true;
  readonly skipHistoryCheckpoint = true;

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    if (ctx.actor.type !== "gm") {
      throw new ForbiddenError("Only the GM can view archived history");
    }
    const parsed = HistoryArchiveItemsQuery.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }
    const pager = new SessionHistoryPager(ctx.tx);
    return {
      replyPayload: await pager.archivePage({
        sessionId: ctx.sessionId,
        rewindId: parsed.data.rewindId,
        beforeEventId: parsed.data.beforeEventId ?? null,
        limit: parsed.data.limit,
      }),
    };
  }
}

class HistoryAuditHandler implements CommandHandler {
  readonly type = "history:audit" as const;
  readonly allowedStatuses = ["waiting", "preparing", "active"] as const;
  readonly allowWhenEnded = true;
  readonly transientReply = true;
  readonly skipHistoryCheckpoint = true;

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    if (ctx.actor.type !== "gm") {
      throw new ForbiddenError("Only the GM can view the audit log");
    }
    const parsed = HistoryAuditQuery.safeParse(payload ?? {});
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }
    const pager = new SessionHistoryPager(ctx.tx);
    return {
      replyPayload: await pager.auditPage({
        sessionId: ctx.sessionId,
        beforeCreatedAt: parsed.data.beforeCreatedAt ?? null,
        limit: parsed.data.limit,
      }),
    };
  }
}

export function createHistoryRewindCommandHandlers(): CommandHandler[] {
  return [
    new HistoryPreviewRewindHandler(),
    new HistoryRewindHandler(),
    new HistoryUndoRewindHandler(),
    new HistoryArchiveHandler(),
    new HistoryArchiveItemsHandler(),
    new HistoryAuditHandler(),
  ];
}
