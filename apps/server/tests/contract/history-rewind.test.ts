import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import {
  HistoryArchiveItemsReply,
  HistoryArchiveReply,
  HistoryAuditReply,
  HistoryPageReply,
  RewindPreview,
  SessionSnapshotPayload,
  type ClientCommandType,
  type CommandReply,
  type HistoryItem,
  type HistoryPage,
} from "@cogm/shared";
import {
  ScriptedRandomSource,
  closeWs,
  connectWs,
  listenTestApp,
  setSessionPhase,
  setupTestApp,
  stopServer,
  type TestContext,
  type TestServer,
  type TestWebSocket,
} from "../helpers/setup";
import type { ActorContext } from "@/modules/identity";
import {
  checkRequests,
  handouts,
  scenes,
  sessionMessages,
  sessionRuntimeCheckpoints,
} from "@/platform/db/schema";

const PENDING_REJECTION_REASON = "因回溯未呈现";

async function execute(
  ctx: TestContext,
  type: ClientCommandType,
  payload: unknown,
  actor: ActorContext = { type: "gm" }
): Promise<CommandReply> {
  return ctx.container.sessionCommandExecutor.execute(
    ctx.sessionId,
    actor,
    {
      protocolVersion: 1,
      commandId: `cmd-${crypto.randomUUID()}`,
      type,
      payload,
    },
    "test-connection"
  );
}

function accepted(reply: CommandReply): Record<string, unknown> {
  if (reply.type !== "command:accepted") {
    throw new Error(`command rejected: ${JSON.stringify(reply.payload)}`);
  }
  return reply.payload as Record<string, unknown>;
}

function rejectedCode(reply: CommandReply): string | null {
  if (reply.type !== "command:rejected") {
    return null;
  }
  return (reply.payload as { code?: string }).code ?? null;
}

function playerActor(ctx: TestContext, name: string): ActorContext {
  return { type: "player", playerId: ctx.playerIds.get(name)! };
}

async function fetchHistory(ctx: TestContext): Promise<HistoryPage> {
  return HistoryPageReply.parse((await execute(ctx, "history:page", { limit: 100 })).payload).history;
}

function chatContents(items: HistoryItem[]): string[] {
  return items
    .filter((item) => item.kind === "chat")
    .map((item) => (item.kind === "chat" ? item.message.content : ""));
}

function snapshotCharacter(payload: SessionSnapshotPayload, characterId: string) {
  return payload.characters.find((character) => character.characterId === characterId);
}

async function updatePhase(ctx: TestContext, phase: string): Promise<void> {
  const res = await ctx.app.handle(
    new Request(`http://localhost/api/v1/gm/sessions/${ctx.sessionId}/phase`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.gmToken}` },
      body: JSON.stringify({ phase }),
    })
  );
  expect(res.status).toBe(200);
}

async function endSession(ctx: TestContext): Promise<void> {
  const res = await ctx.app.handle(
    new Request(`http://localhost/api/v1/gm/sessions/${ctx.sessionId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.gmToken}` },
      body: JSON.stringify({ status: "ended" }),
    })
  );
  expect(res.status).toBe(200);
}

interface TimelineScenario {
  ctx: TestContext;
  server: TestServer;
  wsUrl: () => string;
  anchorEventId: number;
  anchorMessageId: string;
  futureMessageId: string;
  pendingMessageId: string;
  requestId: string;
  request2Id: string;
}

async function buildTimeline(): Promise<TimelineScenario> {
  const ctx = await setupTestApp({
    players: ["pc1", "ob1"],
    characters: [
      { id: "char-pc1", name: "调查员一号", kind: "pc", portraits: ["default", "smile"] },
    ],
    claims: [
      { player: "pc1", role: "pc", characterId: "char-pc1" },
      { player: "ob1", role: "ob" },
    ],
    randomSource: new ScriptedRandomSource([9, 9]),
  });
  const server = listenTestApp(ctx.app);
  const wsUrl = () => `ws://localhost:${server.server.port}/api/v1/sessions/${ctx.sessionId}/ws`;

  await setSessionPhase(ctx, "free_discussion");
  const now = Date.now();
  await ctx.container.db.insert(scenes).values([
    { id: "scene-a", moduleId: "module-test", name: "甲场景", sortOrder: 1, bgAssetId: null, createdAt: now },
    { id: "scene-b", moduleId: "module-test", name: "乙场景", sortOrder: 2, bgAssetId: null, createdAt: now },
  ]);
  await ctx.container.db.insert(handouts).values([
    { id: "handout-1", moduleId: "module-test", title: "旧情报", content: "旧内容", imageAssetId: null, createdAt: now },
    { id: "handout-2", moduleId: "module-test", title: "新情报", content: "新内容", imageAssetId: null, createdAt: now },
  ]);

  accepted(await execute(ctx, "scene:switch", { sceneId: "scene-a" }));
  accepted(await execute(ctx, "expression:set", { characterId: "char-pc1", expressionKey: "smile" }));
  accepted(await execute(ctx, "handout:grant", { handoutId: "handout-1", recipientCharacterIds: [] }));
  accepted(await execute(ctx, "state:edit", { characterId: "char-pc1", san: 30 }));
  const requestId = String(
    accepted(await execute(ctx, "check:request", { characterId: "char-pc1", skillKey: "侦查" })).requestId
  );
  const anchorMessageId = String(
    accepted(await execute(ctx, "chat:send", { channel: "roleplay", content: "锚点消息" })).messageId
  );

  const anchorRows = await ctx.container.db
    .select({ eventId: sessionMessages.eventId })
    .from(sessionMessages)
    .where(eq(sessionMessages.id, anchorMessageId));
  const anchorEventId = anchorRows[0]?.eventId;
  if (anchorEventId === undefined || anchorEventId === null) {
    throw new Error("anchor message has no event id");
  }

  await updatePhase(ctx, "free_performance");
  accepted(await execute(ctx, "scene:switch", { sceneId: "scene-b" }));
  accepted(await execute(ctx, "expression:set", { characterId: "char-pc1", expressionKey: "default" }));
  accepted(await execute(ctx, "handout:grant", { handoutId: "handout-2", recipientCharacterIds: [] }));
  accepted(await execute(ctx, "state:edit", { characterId: "char-pc1", san: 40 }));
  accepted(await execute(ctx, "check:respond", { requestId }));
  const request2Id = String(
    accepted(await execute(ctx, "check:request", { characterId: "char-pc1", skillKey: "聆听" })).requestId
  );
  const futureMessageId = String(
    accepted(await execute(ctx, "chat:send", { channel: "roleplay", content: "未来消息" })).messageId
  );
  const pendingMessageId = String(
    accepted(
      await execute(
        ctx,
        "chat:send",
        { channel: "ooc", content: "待呈现" },
        playerActor(ctx, "ob1")
      )
    ).messageId
  );

  return {
    ctx,
    server,
    wsUrl,
    anchorEventId,
    anchorMessageId,
    futureMessageId,
    pendingMessageId,
    requestId,
    request2Id,
  };
}

async function connectAndSnapshot(wsUrl: string, token: string): Promise<{
  ws: TestWebSocket;
  snapshot: SessionSnapshotPayload;
}> {
  const ws = await connectWs(wsUrl, token);
  const message = await ws.waitFor((m) => m.type === "snapshot");
  return { ws, snapshot: SessionSnapshotPayload.parse(message.payload) };
}

describe("History rewind and undo contract tests", () => {
  let scenario: TimelineScenario;
  let rewindId: string;
  let rewindEventId: number;
  let rewindEventPayload: Record<string, unknown>;

  beforeAll(async () => {
    scenario = await buildTimeline();
  });

  afterAll(async () => {
    await stopServer(scenario.server);
    scenario.ctx.container.dbContext.sqlite.close();
  });

  test("预览统计将归档内容、被撤回情报、鉴定回退与运行态变化", async () => {
    const reply = await execute(scenario.ctx, "history:preview-rewind", {
      anchorEventId: scenario.anchorEventId,
    });
    const preview = RewindPreview.parse(accepted(reply).preview);

    expect(preview.anchorEventId).toBe(scenario.anchorEventId);
    expect(preview.anchorOccurredAt).toBeGreaterThan(0);
    expect(preview.messageCount).toBe(2);
    expect(preview.activityCount).toBe(6);
    expect(preview.pendingCount).toBe(1);
    expect(preview.revokedHandoutTitles).toEqual(["新情报"]);
    expect(preview.revertedCheckCount).toBe(2);
    expect(preview.characterChanges).toEqual([
      { characterId: "char-pc1", name: "调查员一号" },
    ]);
    expect(preview.phaseChange).toEqual({ from: "free_performance", to: "free_discussion" });
    expect(preview.sceneChange).toEqual({ fromName: "乙场景", toName: "甲场景" });
    expect(preview.hasCheckpoint).toBe(true);

    const playerReply = await execute(
      scenario.ctx,
      "history:preview-rewind",
      { anchorEventId: scenario.anchorEventId },
      playerActor(scenario.ctx, "pc1")
    );
    expect(rejectedCode(playerReply)).toBe("FORBIDDEN");

    const missingReply = await execute(scenario.ctx, "history:preview-rewind", {
      anchorEventId: 999999,
    });
    expect(rejectedCode(missingReply)).toBe("REWIND_ANCHOR_NOT_FOUND");
  });

  test("GM 回溯：归档未来内容、恢复运行态、清空待呈现并广播", async () => {
    const gm = await connectWs(scenario.wsUrl(), scenario.ctx.gmToken);
    const ob = await connectWs(scenario.wsUrl(), scenario.ctx.playerTokens.get("ob1")!);
    await gm.waitFor((m) => m.type === "snapshot");
    await ob.waitFor((m) => m.type === "snapshot");

    const reply = await execute(scenario.ctx, "history:rewind", {
      anchorEventId: scenario.anchorEventId,
      reason: "时间线出错",
    });
    const payload = accepted(reply);
    rewindId = String(payload.rewindId);
    expect(payload.action).toBe("rewind");

    const rewindEvent = await gm.waitFor(
      (m) => m.type === "session:rewound" && m.payload?.action === "rewind"
    );
    rewindEventId = rewindEvent.eventId;
    rewindEventPayload = rewindEvent.payload;
    expect(rewindEvent.payload).toMatchObject({
      action: "rewind",
      rewindId,
      anchorEventId: scenario.anchorEventId,
      archivedMessageCount: 2,
      archivedEventCount: 6,
      discardedPendingCount: 1,
      reason: null,
    });
    await gm.waitFor((m) => m.type === "session:refresh");

    const rejection = await ob.waitFor((m) => m.type === "chat:rejected");
    expect(rejection.payload).toEqual({
      messageId: scenario.pendingMessageId,
      reason: PENDING_REJECTION_REASON,
    });

    const anchorRows = await scenario.ctx.container.db
      .select({
        archivedAt: sessionMessages.archivedAt,
        archivedByRewindId: sessionMessages.archivedByRewindId,
      })
      .from(sessionMessages)
      .where(eq(sessionMessages.id, scenario.anchorMessageId));
    expect(anchorRows[0]?.archivedAt).not.toBeNull();
    expect(anchorRows[0]?.archivedByRewindId).toBe(rewindId);

    const futureRows = await scenario.ctx.container.db
      .select({ archivedAt: sessionMessages.archivedAt })
      .from(sessionMessages)
      .where(eq(sessionMessages.id, scenario.futureMessageId));
    expect(futureRows[0]?.archivedAt).not.toBeNull();

    const history = await fetchHistory(scenario.ctx);
    const contents = chatContents(history.items);
    expect(contents).not.toContain("锚点消息");
    expect(contents).not.toContain("未来消息");
    expect(history.items.some((item) => item.eventId === rewindEventId)).toBe(true);

    const { ws: gmAfter, snapshot } = await connectAndSnapshot(
      scenario.wsUrl(),
      scenario.ctx.gmToken
    );
    expect(snapshot.lastRewind).toEqual({
      id: rewindId,
      action: "rewind",
      eventId: rewindEventId,
      anchorEventId: scenario.anchorEventId,
      occurredAt: expect.any(Number),
    });
    expect(snapshot.session.phase).toBe("free_discussion");
    expect(snapshot.currentScene?.name).toBe("甲场景");
    const pc = snapshotCharacter(snapshot, "char-pc1");
    expect(pc?.currentExpressionKey).toBe("smile");
    expect((pc?.state as { san: number }).san).toBe(30);
    expect(snapshot.visibleHandouts.map((item) => item.handout.title)).toEqual(["旧情报"]);
    expect(snapshot.pendingCheckRequests.map((item) => item.id)).toEqual([scenario.requestId]);
    expect(snapshot.pendingCheckRequests[0]?.status).toBe("pending");
    expect(snapshot.pendingQueue).toEqual([]);
    const snapshotContents = chatContents(snapshot.recentHistory);
    expect(snapshotContents).not.toContain("锚点消息");
    expect(snapshotContents).not.toContain("未来消息");

    const groupsReply = await execute(scenario.ctx, "history:archive", {});
    const groups = HistoryArchiveReply.parse(groupsReply.payload).groups;
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      id: rewindId,
      action: "rewind",
      anchorEventId: scenario.anchorEventId,
      reason: "时间线出错",
      undoneAt: null,
      targetRewindId: null,
      archivedMessageCount: 2,
      archivedEventCount: 6,
    });

    const itemsReply = await execute(scenario.ctx, "history:archive-items", { rewindId });
    const archiveItems = HistoryArchiveItemsReply.parse(itemsReply.payload);
    expect(archiveItems.items).toHaveLength(8);
    expect(chatContents(archiveItems.items).sort()).toEqual(["未来消息", "锚点消息"].sort());
    expect(archiveItems.items.filter((item) => item.kind === "activity")).toHaveLength(6);
    expect(archiveItems.items.every((item) => item.archivedAt !== null)).toBe(true);

    const auditReply = await execute(scenario.ctx, "history:audit", {});
    const audit = HistoryAuditReply.parse(auditReply.payload);
    expect(audit.items.map((item) => item.content)).toContain("待呈现");
    expect(audit.items[0]?.rejectionReason).toBe(PENDING_REJECTION_REASON);

    await closeWs(gm);
    await closeWs(ob);
    await closeWs(gmAfter);
  });

  test("撤销回溯：恢复旧未来、归档回溯后新内容并更新归档组", async () => {
    const gm = await connectWs(scenario.wsUrl(), scenario.ctx.gmToken);
    const ob = await connectWs(scenario.wsUrl(), scenario.ctx.playerTokens.get("ob1")!);
    await gm.waitFor((m) => m.type === "snapshot");
    await ob.waitFor((m) => m.type === "snapshot");

    const newMessageId = String(
      accepted(await execute(scenario.ctx, "chat:send", { channel: "ooc", content: "回溯后消息" }))
        .messageId
    );
    const newPendingId = String(
      accepted(
        await execute(
          scenario.ctx,
          "chat:send",
          { channel: "ooc", content: "撤回前待呈现" },
          playerActor(scenario.ctx, "ob1")
        )
      ).messageId
    );

    const reply = await execute(scenario.ctx, "history:undo-rewind", {
      rewindId,
      reason: "恢复未来",
    });
    const payload = accepted(reply);
    const undoId = String(payload.rewindId);
    expect(payload.action).toBe("undo");

    const undoEvent = await gm.waitFor(
      (m) => m.type === "session:rewound" && m.payload?.action === "undo"
    );
    expect(undoEvent.payload).toEqual({
      action: "undo",
      rewindId: undoId,
      anchorEventId: scenario.anchorEventId,
      anchorOccurredAt: rewindEventPayload.anchorOccurredAt,
      archivedMessageCount: 1,
      archivedEventCount: 1,
      discardedPendingCount: 1,
      reason: null,
      undoneRewindId: rewindId,
    });
    await gm.waitFor((m) => m.type === "session:refresh");
    const rejection = await ob.waitFor((m) => m.type === "chat:rejected");
    expect(rejection.payload).toEqual({
      messageId: newPendingId,
      reason: PENDING_REJECTION_REASON,
    });

    const history = await fetchHistory(scenario.ctx);
    const contents = chatContents(history.items);
    expect(contents).toContain("锚点消息");
    expect(contents).toContain("未来消息");
    expect(contents).not.toContain("回溯后消息");

    const { ws: gmAfter, snapshot } = await connectAndSnapshot(
      scenario.wsUrl(),
      scenario.ctx.gmToken
    );
    expect(snapshot.session.phase).toBe("free_performance");
    expect(snapshot.currentScene?.name).toBe("乙场景");
    const pc = snapshotCharacter(snapshot, "char-pc1");
    expect(pc?.currentExpressionKey).toBe("default");
    expect((pc?.state as { san: number }).san).toBe(40);
    expect(snapshot.visibleHandouts.map((item) => item.handout.title).sort()).toEqual([
      "旧情报",
      "新情报",
    ].sort());
    expect(snapshot.pendingCheckRequests.map((item) => item.id)).toEqual([scenario.request2Id]);
    expect(snapshot.pendingQueue).toEqual([]);
    expect(snapshot.lastRewind?.action).toBe("undo");

    const checkRows = await scenario.ctx.container.db.select().from(checkRequests);
    const request1 = checkRows.find((row) => row.id === scenario.requestId);
    const request2 = checkRows.find((row) => row.id === scenario.request2Id);
    expect(request1?.status).toBe("resolved");
    expect(request1?.resolvedCheckResultJson).not.toBeNull();
    expect(request2?.status).toBe("pending");

    const groupsReply = await execute(scenario.ctx, "history:archive", {});
    const groups = HistoryArchiveReply.parse(groupsReply.payload).groups;
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      id: undoId,
      action: "undo",
      anchorEventId: scenario.anchorEventId,
      targetRewindId: rewindId,
      undoneAt: null,
      archivedMessageCount: 1,
      archivedEventCount: 1,
    });
    expect(groups[1]).toMatchObject({ id: rewindId, action: "rewind" });
    expect(groups[1]?.undoneAt).not.toBeNull();

    const undoItems = HistoryArchiveItemsReply.parse(
      (await execute(scenario.ctx, "history:archive-items", { rewindId: undoId })).payload
    );
    expect(undoItems.items).toHaveLength(2);
    expect(chatContents(undoItems.items)).toEqual(["回溯后消息"]);
    expect(undoItems.items.some((item) => item.kind === "activity" && item.eventId === rewindEventId)).toBe(true);

    const restoredMessageRows = await scenario.ctx.container.db
      .select({
        archivedAt: sessionMessages.archivedAt,
        archivedByRewindId: sessionMessages.archivedByRewindId,
      })
      .from(sessionMessages)
      .where(eq(sessionMessages.id, scenario.anchorMessageId));
    expect(restoredMessageRows[0]?.archivedAt).toBeNull();
    expect(restoredMessageRows[0]?.archivedByRewindId).toBeNull();

    const newMessageRows = await scenario.ctx.container.db
      .select({ archivedAt: sessionMessages.archivedAt })
      .from(sessionMessages)
      .where(eq(sessionMessages.id, newMessageId));
    expect(newMessageRows[0]?.archivedAt).not.toBeNull();

    const outOfOrder = await execute(scenario.ctx, "history:undo-rewind", { rewindId });
    expect(rejectedCode(outOfOrder)).toBe("REWIND_UNDO_OUT_OF_ORDER");
    const undoOfUndo = await execute(scenario.ctx, "history:undo-rewind", { rewindId: undoId });
    expect(rejectedCode(undoOfUndo)).toBe("REWIND_UNDO_OUT_OF_ORDER");

    await closeWs(gm);
    await closeWs(ob);
    await closeWs(gmAfter);
  });

  test("玩家不能回溯，且不能访问归档与审计", async () => {
    const ctx = scenario.ctx;
    const pc = playerActor(ctx, "pc1");
    expect(
      rejectedCode(await execute(ctx, "history:rewind", { anchorEventId: scenario.anchorEventId }, pc))
    ).toBe("FORBIDDEN");
    expect(
      rejectedCode(await execute(ctx, "history:undo-rewind", { rewindId }, pc))
    ).toBe("FORBIDDEN");
    expect(rejectedCode(await execute(ctx, "history:archive", {}, pc))).toBe("FORBIDDEN");
    expect(
      rejectedCode(await execute(ctx, "history:archive-items", { rewindId }, pc))
    ).toBe("FORBIDDEN");
    expect(rejectedCode(await execute(ctx, "history:audit", {}, pc))).toBe("FORBIDDEN");

    const missingAnchor = await execute(ctx, "history:rewind", { anchorEventId: 999999 });
    expect(rejectedCode(missingAnchor)).toBe("REWIND_ANCHOR_NOT_FOUND");
  });
});

describe("History rewind结束后可读性", () => {
  let ctx: TestContext;
  let server: TestServer;

  beforeAll(async () => {
    ctx = await setupTestApp({ players: ["pc1"], claims: [{ player: "pc1", role: "ob" }] });
    server = listenTestApp(ctx.app);
    await setSessionPhase(ctx, "free_discussion");
    accepted(await execute(ctx, "chat:send", { channel: "ooc", content: "结团前消息" }));
    await endSession(ctx);
  });

  afterAll(async () => {
    await stopServer(server);
    ctx.container.dbContext.sqlite.close();
  });

  test("已结团拒绝回溯与预览，但允许归档与审计", async () => {
    expect(
      rejectedCode(await execute(ctx, "history:rewind", { anchorEventId: 1 }))
    ).toBe("SESSION_STATE_INVALID");
    expect(
      rejectedCode(await execute(ctx, "history:preview-rewind", { anchorEventId: 1 }))
    ).toBe("SESSION_STATE_INVALID");

    const groupsReply = await execute(ctx, "history:archive", {});
    expect(accepted(groupsReply).groups).toEqual([]);

    const auditReply = await execute(ctx, "history:audit", {});
    const audit = HistoryAuditReply.parse(auditReply.payload);
    expect(audit.items).toEqual([]);

    const itemsReply = await execute(ctx, "history:archive-items", { rewindId: "missing" });
    const items = HistoryArchiveItemsReply.parse(itemsReply.payload);
    expect(items.items).toEqual([]);
    expect(items.hasMore).toBe(false);
  });
});

describe("History rewind缺少检查点", () => {
  let ctx: TestContext;
  let server: TestServer;
  let anchorEventId = 0;

  beforeAll(async () => {
    ctx = await setupTestApp({ players: ["ob1"], claims: [{ player: "ob1", role: "ob" }] });
    server = listenTestApp(ctx.app);
    await setSessionPhase(ctx, "free_discussion");
    const messageId = String(
      accepted(await execute(ctx, "chat:send", { channel: "ooc", content: "无检查点锚点" })).messageId
    );
    const rows = await ctx.container.db
      .select({ eventId: sessionMessages.eventId })
      .from(sessionMessages)
      .where(eq(sessionMessages.id, messageId));
    anchorEventId = rows[0]?.eventId ?? 0;
    await ctx.container.db.delete(sessionRuntimeCheckpoints);
  });

  afterAll(async () => {
    await stopServer(server);
    ctx.container.dbContext.sqlite.close();
  });

  test("预览标记 hasCheckpoint=false，回溯报 REWIND_CHECKPOINT_MISSING", async () => {
    const preview = RewindPreview.parse(
      accepted(await execute(ctx, "history:preview-rewind", { anchorEventId })).preview
    );
    expect(preview.hasCheckpoint).toBe(false);
    expect(preview.messageCount).toBe(1);

    const reply = await execute(ctx, "history:rewind", { anchorEventId });
    expect(rejectedCode(reply)).toBe("REWIND_CHECKPOINT_MISSING");
  });
});
