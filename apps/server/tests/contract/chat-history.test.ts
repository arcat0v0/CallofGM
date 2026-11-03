import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { HistoryPage, HistoryPageReply, type HistoryItem } from "@cogm/shared";
import {
  setupTestApp,
  setSessionPhase,
  connectWs,
  closeWs,
  sendCommand,
  listenTestApp,
  stopServer,
  type TestContext,
  type TestServer,
  type TestWebSocket,
} from "../helpers/setup";

function historyOf(reply: { type: string; payload: unknown }): HistoryPage {
  const parsed = HistoryPageReply.safeParse(reply.payload);
  if (!parsed.success) {
    throw new Error(`not a history reply: ${JSON.stringify(reply.payload)}`);
  }
  return parsed.data.history;
}

describe("Chat history pagination contract tests", () => {
  let ctx: TestContext;
  let server: TestServer;
  const wsUrl = () => `ws://localhost:${server.server.port}/api/v1/sessions/${ctx.sessionId}/ws`;

  beforeAll(async () => {
    ctx = await setupTestApp({
      players: ["pc1", "ob1"],
      characters: [{ id: "char-pc1", name: "调查员一号", kind: "pc" }],
      claims: [
        { player: "pc1", role: "pc", characterId: "char-pc1" },
        { player: "ob1", role: "ob" },
      ],
    });
    server = listenTestApp(ctx.app);
  });

  afterAll(async () => {
    await stopServer(server);
    ctx.container.dbContext.sqlite.close();
  });

  async function seedPresentedMessage(content: string): Promise<string> {
    const reply = await ctx.container.sessionCommandExecutor.execute(
      ctx.sessionId,
      { type: "user", userId: "test-gm", role: "gm", loginSessionId: "s", username: "gm" },
      {
        protocolVersion: 1,
        commandId: `seed-${crypto.randomUUID()}`,
        type: "chat:send",
        payload: { channel: "ooc", content },
      },
      "seed-connection"
    );
    if (reply.type !== "command:accepted") {
      throw new Error(`seed failed: ${JSON.stringify(reply)}`);
    }
    return String((reply.payload as { messageId: string }).messageId);
  }

  async function requestPage(
    ws: TestWebSocket,
    options: { beforeEventId?: number; limit?: number } = {}
  ): Promise<HistoryPage> {
    const commandId = crypto.randomUUID();
    sendCommand(ws, "history:page", options, commandId);
    const reply = await ws.waitFor((m) => m.commandId === commandId && m.type !== "snapshot" && m.type !== "chat:queue");
    expect(reply.type).toBe("command:accepted");
    return historyOf(reply);
  }

  async function pageAll(ws: TestWebSocket, beforeEventId: number | null, limit: number): Promise<HistoryItem[]> {
    const items: HistoryItem[] = [];
    let before = beforeEventId;
    for (let guard = 0; before !== null && guard < 40; guard += 1) {
      const page = await requestPage(ws, { beforeEventId: before, limit });
      items.push(...page.items);
      if (!page.hasMore) {
        expect(page.beforeEventId).toBeNull();
        before = null;
      } else {
        expect(typeof page.beforeEventId).toBe("number");
        before = page.beforeEventId;
      }
    }
    return items;
  }

  test("空团的快照与分页：无条目、hasMore=false、游标为 null", async () => {
    const pc = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
    const snapshot = await pc.waitFor((m) => m.type === "snapshot");
    expect(snapshot.payload.recentHistory).toEqual([]);
    expect(snapshot.payload.history).toEqual({ beforeEventId: null, hasMore: false });

    const page = await requestPage(pc);
    expect(page).toEqual({ items: [], hasMore: false, beforeEventId: null });
    await closeWs(pc);
  });

  test("超过快照窗口后：首屏仍有界、hasMore 为真且游标指向最旧条目", async () => {
    for (let i = 1; i <= 120; i++) {
      await seedPresentedMessage(`历史消息 ${i}`);
    }
    await ctx.container.sessionEventBus.emit(ctx.sessionId, [
      {
        type: "dice:rolled",
        payload: { rollerType: "gm", result: { total: 42, expression: "1d100", detail: "42" }, hidden: false },
        visibility: { type: "public" },
      },
      {
        type: "dice:rolled",
        payload: { rollerType: "gm", result: { total: 7, expression: "1d100", detail: "7" }, hidden: true },
        visibility: { type: "gmOnly" },
      },
    ]);

    const pc = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
    const snapshot = await pc.waitFor((m) => m.type === "snapshot");
    const recent: HistoryItem[] = snapshot.payload.recentHistory;
    expect(recent).toHaveLength(50);
    const eventIds = recent.map((item) => item.eventId);
    expect(eventIds).toEqual([...eventIds].sort((a, b) => a - b));
    expect(snapshot.payload.history.hasMore).toBe(true);
    expect(snapshot.payload.history.beforeEventId).toBe(eventIds[0]);

    await closeWs(pc);
  });

  test("逐页回看：快照 + 历史页覆盖全量、不重复、跨页衔接连续，最后一页 hasMore=false", async () => {
    const pc = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
    const snapshot = await pc.waitFor((m) => m.type === "snapshot");
    const snapshotItems: HistoryItem[] = snapshot.payload.recentHistory;
    const pages: HistoryItem[][] = [];
    let before = snapshot.payload.history.beforeEventId;
    for (let guard = 0; before !== null && guard < 40; guard += 1) {
      const page = await requestPage(pc, { beforeEventId: before, limit: 40 });
      pages.push(page.items);
      const eventIds = page.items.map((item) => item.eventId);
      expect(eventIds).toEqual([...eventIds].sort((a, b) => a - b));
      before = page.hasMore ? page.beforeEventId : null;
    }

    const timeline = [...pages.reverse().flat(), ...snapshotItems];
    expect(timeline).toHaveLength(121);
    const eventIds = timeline.map((item) => item.eventId);
    expect(eventIds).toEqual([...eventIds].sort((a, b) => a - b));
    expect(new Set(eventIds).size).toBe(eventIds.length);

    const contents = timeline.filter((item) => item.kind === "chat").map((item) => item.message.content);
    expect(contents).toHaveLength(120);
    for (let i = 1; i <= 120; i++) {
      expect(contents).toContain(`历史消息 ${i}`);
    }

    const activities = timeline.filter((item) => item.kind === "activity");
    expect(activities).toHaveLength(1);

    await closeWs(pc);
  });

  test("viewer 过滤：暗骰记录只对 GM 可见，OB 看不到", async () => {
    const gm = await connectWs(wsUrl(), ctx.gmToken);
    const ob = await connectWs(wsUrl(), ctx.playerTokens.get("ob1")!);
    const gmSnapshot = await gm.waitFor((m) => m.type === "snapshot");
    const obSnapshot = await ob.waitFor((m) => m.type === "snapshot");

    const gmItems = [...(await pageAll(gm, gmSnapshot.payload.history.beforeEventId, 50)), ...gmSnapshot.payload.recentHistory];
    const obItems = [...(await pageAll(ob, obSnapshot.payload.history.beforeEventId, 50)), ...obSnapshot.payload.recentHistory];

    const gmActivities = gmItems.filter((item) => item.kind === "activity");
    const obActivities = obItems.filter((item) => item.kind === "activity");
    expect(gmActivities).toHaveLength(2);
    expect(obActivities).toHaveLength(1);

    await closeWs(gm);
    await closeWs(ob);
  });

  test("pending 与 discarded 消息永不出现在历史页，放行后才按呈现顺序出现", async () => {
    await setSessionPhase(ctx, "performance_time");
    const gm = await connectWs(wsUrl(), ctx.gmToken);
    const pc = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
    const snapshot = await pc.waitFor((m) => m.type === "snapshot");

    sendCommand(pc, "chat:send", { channel: "roleplay", content: "将被丢弃的秘密" }, "h-q1");
    await pc.waitFor((m) => m.commandId === "h-q1");
    const queue = await gm.waitFor((m) =>
      Array.isArray(m.payload?.messages) && m.payload.messages.some((msg: { content: string }) => msg.content === "将被丢弃的秘密")
    );
    const queueMessages: { id: string; content: string }[] = queue.payload.messages;
    const discardedId = queueMessages.find((msg) => msg.content === "将被丢弃的秘密")?.id ?? "";

    sendCommand(pc, "chat:send", { channel: "roleplay", content: "即将放行" }, "h-q2");
    await pc.waitFor((m) => m.commandId === "h-q2");

    const before = [...(await pageAll(pc, snapshot.payload.history.beforeEventId, 50)), ...snapshot.payload.recentHistory];
    const beforeContents = before.map((item) => (item.kind === "chat" ? item.message.content : ""));
    expect(beforeContents).not.toContain("将被丢弃的秘密");
    expect(beforeContents).not.toContain("即将放行");

    sendCommand(gm, "chat:discard", { messageId: discardedId }, "h-d1");
    await gm.waitFor((m) => m.commandId === "h-d1" && m.type === "command:accepted");

    const queueAfter = await gm.waitFor((m) =>
      Array.isArray(m.payload?.messages) && m.payload.messages.some((msg: { content: string }) => msg.content === "即将放行")
    );
    const releasedQueue: { id: string; content: string }[] = queueAfter.payload.messages;
    const releasedId = releasedQueue.find((msg) => msg.content === "即将放行")?.id ?? "";
    sendCommand(gm, "chat:release", { messageId: releasedId }, "h-r1");
    const released = await gm.waitFor((m) => m.type === "chat:message" && m.payload.message.content === "即将放行");

    const pcAfter = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
    const snapshotAfter = await pcAfter.waitFor((m) => m.type === "snapshot");
    const after = [...(await pageAll(pcAfter, snapshotAfter.payload.history.beforeEventId, 50)), ...snapshotAfter.payload.recentHistory];
    const afterContents = after.map((item) => (item.kind === "chat" ? item.message.content : ""));
    expect(afterContents).not.toContain("将被丢弃的秘密");
    expect(afterContents).toContain("即将放行");
    const newest = after[after.length - 1];
    expect(newest?.kind).toBe("chat");
    expect(released.type).toBe("chat:message");

    await closeWs(gm);
    await closeWs(pc);
    await closeWs(pcAfter);
  });

  test("结团后仍可分页回看", async () => {
    const endRes = await ctx.app.handle(
      new Request(`http://localhost/api/v1/gm/sessions/${ctx.sessionId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.gmToken}` },
        body: JSON.stringify({ status: "ended" }),
      })
    );
    expect(endRes.status).toBe(200);

    const ob = await connectWs(wsUrl(), ctx.playerTokens.get("ob1")!);
    const snapshot = await ob.waitFor((m) => m.type === "snapshot");
    expect(snapshot.payload.session.status).toBe("ended");
    expect(snapshot.payload.history.hasMore).toBe(true);
    const items = [...(await pageAll(ob, snapshot.payload.history.beforeEventId, 100)), ...snapshot.payload.recentHistory];
    expect(items.length).toBeGreaterThanOrEqual(121);
    await closeWs(ob);
  });
});