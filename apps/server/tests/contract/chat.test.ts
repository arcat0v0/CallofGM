import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import {
  setupTestApp,
  setSessionPhase,
  connectWs,
  closeWs,
  sendCommand,
  listenTestApp,
  type TestContext,
  type TestWebSocket,
} from "../helpers/setup";
import { sessionMessages } from "@/platform/db/schema";
import { eq, and } from "drizzle-orm";

describe("Chat contract tests", () => {
  let ctx: TestContext;
  const wsUrl = () => {
    const port = server.server?.port;
    return `ws://localhost:${port}/api/v1/sessions/${ctx.sessionId}/ws`;
  };
  let server: ReturnType<TestContext["app"]["listen"]>;

  beforeAll(async () => {
    ctx = await setupTestApp({
      players: ["pc1", "ob1"],
      characters: [
        { id: "char-pc1", name: "调查员一号", kind: "pc", portraits: ["default", "angry"] },
        { id: "char-npc1", name: "神秘学者", kind: "npc", portraits: ["default"] },
      ],
      claims: [
        { player: "pc1", role: "pc", characterId: "char-pc1" },
        { player: "ob1", role: "ob" },
      ],
    });
    server = listenTestApp(ctx.app);
  });

  afterAll(async () => {
    await server.stop(true);
    ctx.container.dbContext.sqlite.close();
  });

  async function openAll() {
    const gm = await connectWs(wsUrl(), ctx.gmToken);
    const pc = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
    const ob = await connectWs(wsUrl(), ctx.playerTokens.get("ob1")!);
    // 等待三方快照到位
    await Promise.all([
      gm.waitFor((m) => m.type === "snapshot"),
      pc.waitFor((m) => m.type === "snapshot"),
      ob.waitFor((m) => m.type === "snapshot"),
    ]);
    return { gm, pc, ob };
  }

  async function closeAll(...sockets: TestWebSocket[]) {
    for (const ws of sockets) {
      await closeWs(ws);
    }
  }

  test("自由讨论：PC OOC 立即呈现且全员可见；RP 被强制记为 OOC", async () => {
    await setSessionPhase(ctx, "free_discussion");
    const { gm, pc, ob } = await openAll();

    sendCommand(pc, "chat:send", { channel: "ooc", content: "大家好" }, "c-ooc-1");
    const event = await gm.waitFor((m) => m.type === "chat:message" && m.payload.message.content === "大家好");
    expect(event.payload.message.channel).toBe("ooc");
    expect(event.payload.message.characterId).toBe("char-pc1");
    expect(event.eventId).toBeGreaterThan(0);

    await ob.waitFor((m) => m.type === "chat:message" && m.payload.message.content === "大家好");

    // 自由讨论阶段 RP 输入被强制记为 OOC 立即呈现
    sendCommand(pc, "chat:send", { channel: "roleplay", content: "我环顾四周" }, "c-rp-1");
    const forced = await gm.waitFor((m) => m.type === "chat:message" && m.payload.message.content === "我环顾四周");
    expect(forced.payload.message.channel).toBe("ooc");

    await closeAll(gm, pc, ob);
  });

  test("自由讨论：OB 发言一律入队，玩家零感知，GM 收到队列", async () => {
    await setSessionPhase(ctx, "free_discussion");
    const { gm, pc, ob } = await openAll();

    sendCommand(ob, "chat:send", { channel: "ooc", content: "我能看到吗" }, "c-ob-1");
    const reply = await ob.waitFor((m) => m.commandId === "c-ob-1");
    expect(reply.type).toBe("command:accepted");
    expect(reply.payload.presented).toBe(false);

    // GM 收到队列更新且包含该消息
    const queue = await gm.waitFor((m) => m.type === "chat:queue");
    expect(queue.payload.messages.some((msg: any) => msg.content === "我能看到吗")).toBe(true);

    // 玩家侧对队列零感知：不应收到 chat:message
    await new Promise((r) => setTimeout(r, 200));
    expect(pc.messages.some((m) => m.type === "chat:message" && m.payload.message.content === "我能看到吗")).toBe(false);

    await closeAll(gm, pc, ob);
  });

  test("演绎时间：PC 禁止 OOC、RP 入队；OB 禁言", async () => {
    await setSessionPhase(ctx, "performance_time");
    const { gm, pc, ob } = await openAll();

    sendCommand(pc, "chat:send", { channel: "ooc", content: "场外一下" }, "c-pt-ooc");
    const oocReply = await pc.waitFor((m) => m.commandId === "c-pt-ooc");
    expect(oocReply.type).toBe("command:rejected");
    expect(oocReply.payload.code).toBe("SESSION_PHASE_FORBIDS_ACTION");

    sendCommand(pc, "chat:send", { channel: "roleplay", content: "我举起火把", expressionKey: "angry" }, "c-pt-rp");
    const rpReply = await pc.waitFor((m) => m.commandId === "c-pt-rp");
    expect(rpReply.type).toBe("command:accepted");
    expect(rpReply.payload.presented).toBe(false);
    await gm.waitFor((m) => m.type === "chat:queue" && m.payload.messages.some((msg: any) => msg.content === "我举起火把"));

    sendCommand(ob, "chat:send", { channel: "ooc", content: "OB 说话" }, "c-pt-ob");
    const obReply = await ob.waitFor((m) => m.commandId === "c-pt-ob");
    expect(obReply.type).toBe("command:rejected");

    await closeAll(gm, pc, ob);
  });

  test("强制 CG：玩家全员禁言，GM 可发言", async () => {
    await setSessionPhase(ctx, "forced_cg");
    const { gm, pc, ob } = await openAll();

    sendCommand(pc, "chat:send", { channel: "ooc", content: "不行" }, "c-cg-pc");
    const pcReply = await pc.waitFor((m) => m.commandId === "c-cg-pc");
    expect(pcReply.type).toBe("command:rejected");

    sendCommand(gm, "chat:send", { channel: "ooc", content: "演出继续" }, "c-cg-gm");
    const gmEvent = await pc.waitFor((m) => m.type === "chat:message" && m.payload.message.content === "演出继续");
    expect(gmEvent.payload.message.senderType).toBe("gm");

    await closeAll(gm, pc, ob);
  });

  test("自由演绎：PC OOC 立即、RP 入队、OB 入队", async () => {
    await setSessionPhase(ctx, "free_performance");
    const { gm, pc, ob } = await openAll();

    sendCommand(pc, "chat:send", { channel: "ooc", content: "马上回来" }, "c-fp-ooc");
    await gm.waitFor((m) => m.type === "chat:message" && m.payload.message.content === "马上回来");

    sendCommand(pc, "chat:send", { channel: "roleplay", content: "我推开门" }, "c-fp-rp");
    const rpReply = await pc.waitFor((m) => m.commandId === "c-fp-rp");
    expect(rpReply.payload.presented).toBe(false);

    sendCommand(ob, "chat:send", { channel: "ooc", content: "OB 插话" }, "c-fp-ob");
    const obReply = await ob.waitFor((m) => m.commandId === "c-fp-ob");
    expect(obReply.payload.presented).toBe(false);

    await closeAll(gm, pc, ob);
  });

  test("放行：eventId 按放行顺序分配，表情随放行生效", async () => {
    await setSessionPhase(ctx, "performance_time");
    const { gm, pc, ob } = await openAll();

    sendCommand(pc, "chat:send", { channel: "roleplay", content: "第一条", expressionKey: "angry" }, "c-rel-1");
    sendCommand(pc, "chat:send", { channel: "roleplay", content: "第二条" }, "c-rel-2");
    const queueMsg = await gm.waitFor(
      (m) =>
        m.type === "chat:queue" &&
        m.payload.messages.some((msg: any) => msg.content === "第一条") &&
        m.payload.messages.some((msg: any) => msg.content === "第二条")
    );
    const queued = queueMsg.payload.messages as any[];
    const first = queued.find((msg) => msg.content === "第一条");
    const second = queued.find((msg) => msg.content === "第二条");

    // 逆序放行：第二条先放行
    sendCommand(gm, "chat:release", { messageId: second.id }, "c-rel-r2");
    const ev2 = await ob.waitFor((m) => m.type === "chat:message" && m.payload.message.content === "第二条");
    sendCommand(gm, "chat:release", { messageId: first.id }, "c-rel-r1");
    const ev1 = await ob.waitFor((m) => m.type === "chat:message" && m.payload.message.content === "第一条");

    expect(ev2.eventId).toBeLessThan(ev1.eventId);

    // 表情随第一条放行生效
    const exprEvent = await ob.waitFor(
      (m) => m.type === "expression:changed" && m.payload.characterId === "char-pc1"
    );
    expect(exprEvent.payload.expressionKey).toBe("angry");

    // 重复放行被拒绝
    sendCommand(gm, "chat:release", { messageId: first.id }, "c-rel-again");
    const againReply = await gm.waitFor((m) => m.commandId === "c-rel-again");
    expect(againReply.type).toBe("command:rejected");

    await closeAll(gm, pc, ob);
  });

  test("丢弃：玩家无通知，队列与数据库状态正确", async () => {
    await setSessionPhase(ctx, "performance_time");
    const { gm, pc, ob } = await openAll();

    sendCommand(pc, "chat:send", { channel: "roleplay", content: "将被丢弃" }, "c-dis-1");
    const queueMsg = await gm.waitFor(
      (m) => m.type === "chat:queue" && m.payload.messages.some((msg: any) => msg.content === "将被丢弃")
    );
    const target = queueMsg.payload.messages.find((msg: any) => msg.content === "将被丢弃");

    sendCommand(gm, "chat:discard", { messageId: target.id }, "c-dis-r");
    await gm.waitFor((m) => m.commandId === "c-dis-r" && m.type === "command:accepted");
    await gm.waitFor((m) => m.type === "chat:queue" && !m.payload.messages.some((msg: any) => msg.content === "将被丢弃"));

    await new Promise((r) => setTimeout(r, 200));
    expect(pc.messages.some((m) => m.type === "chat:message" && m.payload.message.content === "将被丢弃")).toBe(false);
    expect(ob.messages.some((m) => m.type === "chat:message" && m.payload.message.content === "将被丢弃")).toBe(false);

    const rows = await ctx.container.db
      .select()
      .from(sessionMessages)
      .where(and(eq(sessionMessages.id, target.id), eq(sessionMessages.status, "discarded")));
    expect(rows.length).toBe(1);

    await closeAll(gm, pc, ob);
  });

  test("快照：GM 可见待呈现队列，玩家快照不包含 pending 消息与队列字段", async () => {
    await setSessionPhase(ctx, "performance_time");
    const { gm, pc } = await openAll();

    sendCommand(pc, "chat:send", { channel: "roleplay", content: "快照中的pending" }, "c-snap-1");
    await gm.waitFor((m) => m.type === "chat:queue" && m.payload.messages.some((msg: any) => msg.content === "快照中的pending"));
    await closeAll(gm, pc);

    // 重新连接走快照路径
    const gm2 = await connectWs(wsUrl(), ctx.gmToken);
    const gmSnapshot = await gm2.waitFor((m) => m.type === "snapshot");
    expect(gmSnapshot.payload.pendingQueue.some((msg: any) => msg.content === "快照中的pending")).toBe(true);

    const pc2 = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
    const pcSnapshot = await pc2.waitFor((m) => m.type === "snapshot");
    expect(pcSnapshot.payload.pendingQueue).toBeUndefined();
    expect(pcSnapshot.payload.recentMessages.some((msg: any) => msg.content === "快照中的pending")).toBe(false);

    await closeAll(gm2, pc2);
  });

  test("非法表情引用被服务端拒绝", async () => {
    await setSessionPhase(ctx, "performance_time");
    const { pc } = await openAll();

    sendCommand(pc, "chat:send", { channel: "roleplay", content: "不存在的表情", expressionKey: "nonexistent" }, "c-expr-1");
    const reply = await pc.waitFor((m) => m.commandId === "c-expr-1");
    expect(reply.type).toBe("command:rejected");
    expect(reply.payload.code).toBe("EXPRESSION_NOT_FOUND");

    await closeAll(pc);
  });
});
