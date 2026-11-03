import { expect, test, describe, beforeAll, afterAll } from "bun:test";
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
import { sessionKicks, sessions } from "@/platform/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { CreateSessionUseCase } from "@/modules/sessions/application/use-cases";
import { DrizzleSessionsRepository } from "@/modules/sessions/infrastructure/drizzle-sessions-repository";

describe("Session kick exclusion contract", () => {
  let ctx: TestContext;
  let server: TestServer;
  const wsUrl = () => `ws://localhost:${server.server?.port}/api/v1/sessions/${ctx.sessionId}/ws`;

  beforeAll(async () => {
    ctx = await setupTestApp({
      players: ["pc1", "pc2", "ob1"],
      characters: [
        { id: "char-pc1", name: "调查员甲", kind: "pc" },
        { id: "char-pc2", name: "调查员乙", kind: "pc" },
      ],
      claims: [
        { player: "pc1", role: "pc", characterId: "char-pc1" },
        { player: "pc2", role: "pc", characterId: "char-pc2" },
        { player: "ob1", role: "ob" },
      ],
    });
    await setSessionPhase(ctx, "free_discussion");
    server = listenTestApp(ctx.app);
  });

  afterAll(async () => {
    await stopServer(server);
    ctx.container.dbContext.sqlite.close();
  });

  /** 席位持有者：PC 席位由 PL 账号持有，OB 席位由匿名玩家持有 */
  function userId(name: string): string {
    return ctx.plIds.get(name) ?? ctx.playerIds.get(name)!;
  }

  function holderOf(name: string): { holderKind: "user" | "anonymous"; holderId: string } {
    return ctx.plIds.has(name)
      ? { holderKind: "user", holderId: ctx.plIds.get(name)! }
      : { holderKind: "anonymous", holderId: ctx.playerIds.get(name)! };
  }

  function playerId(name: string): string {
    return ctx.playerIds.get(name)!;
  }

  async function claim(token: string, payload: unknown) {
    return ctx.app.handle(
      new Request(`http://localhost/api/v1/sessions/${ctx.sessionId}/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Fingerprint": `fp-${token.slice(0, 8)}`,
        },
        body: JSON.stringify(payload),
      })
    );
  }

  async function openGm(): Promise<TestWebSocket> {
    const gm = await connectWs(wsUrl(), ctx.gmToken);
    await gm.waitFor((m) => m.type === "snapshot");
    return gm;
  }

  async function command<T extends TestWebSocket>(
    ws: T,
    type: string,
    payload: unknown
  ): Promise<{ type: string; payload?: unknown }> {
    const commandId = crypto.randomUUID();
    sendCommand(ws, type, payload, commandId);
    return ws.waitFor((m) => m.commandId === commandId && m.type.startsWith("command:"));
  }

  async function waitForClose(ws: TestWebSocket): Promise<{ code: number; reason: string }> {
    return ws.closeInfo ?? (await ws.closed);
  }

  let gm: TestWebSocket;

  test("GM 踢出：记录禁入并关闭该玩家连接", async () => {
    gm = await openGm();
    const pc1 = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
    await pc1.waitFor((m) => m.type === "snapshot");

    const reply = await command(gm, "player:kick", { ...holderOf("pc1"), reason: "干扰他人发言" });
    expect(reply.type).toBe("command:accepted");
    expect(reply.payload).toMatchObject({ kicked: ctx.plIds.get("pc1")!, alreadyKicked: false });

    expect(await waitForClose(pc1)).toMatchObject({ code: 4000, reason: "kicked" });

    const rows = await ctx.container.db
      .select()
      .from(sessionKicks)
      .where(
        and(
          eq(sessionKicks.sessionId, ctx.sessionId),
          eq(sessionKicks.userId, ctx.plIds.get("pc1")!),
          isNull(sessionKicks.liftedAt)
        )
      );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.reason).toBe("干扰他人发言");
  });

  test("被踢出玩家重连：握手直接下发 SESSION_KICKED 并关闭，不下发快照", async () => {
    const retry = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
    const kickedMessage = await retry.waitFor((m) => m.type === "session:kicked");
    expect(kickedMessage.payload).toMatchObject({ code: "SESSION_KICKED", reason: "干扰他人发言" });
    expect(retry.messages.some((m) => m.type === "snapshot")).toBe(false);
    expect(await waitForClose(retry)).toMatchObject({ code: 4000, reason: "kicked" });
  });

  test("被踢出玩家认领 PC 与 OB 席位均返回 SESSION_KICKED", async () => {
    const pcRes = await claim(ctx.playerTokens.get("pc1")!, { role: "pc", characterId: "char-pc1" });
    expect(pcRes.status).toBe(403);
    expect(await pcRes.json()).toMatchObject({ code: "SESSION_KICKED" });

    const obRes = await claim(ctx.playerTokens.get("pc1")!, { role: "ob" });
    expect(obRes.status).toBe(403);
    expect(await obRes.json()).toMatchObject({ code: "SESSION_KICKED" });
  });

  test("GM 快照与 presence 推送包含禁入名单，玩家快照不含", async () => {
    const gm2 = await openGm();
    const gmSnapshot = gm2.messages.find((m) => m.type === "snapshot");
    expect(gmSnapshot.payload.kickedPlayers).toHaveLength(1);
    expect(gmSnapshot.payload.kickedPlayers[0]).toMatchObject({
      holderKind: "user",
      holderId: ctx.plIds.get("pc1")!,
      displayName: "调查员甲",
      reason: "干扰他人发言",
    });
    expect(typeof gmSnapshot.payload.kickedPlayers[0].createdAt).toBe("number");

    const presence = await gm2.waitFor(
      (m) => m.type === "presence:updated" && Array.isArray(m.payload.kickedPlayers)
    );
    expect(presence.payload.kickedPlayers.map((k: { holderId: string }) => k.holderId)).toContain(ctx.plIds.get("pc1")!);

    const pc2 = await connectWs(wsUrl(), ctx.playerTokens.get("pc2")!);
    const playerSnapshot = await pc2.waitFor((m) => m.type === "snapshot");
    expect(playerSnapshot.payload.kickedPlayers).toBeUndefined();

    await closeWs(gm2);
    await closeWs(pc2);
  });

  test("重复踢出幂等：仍只有一条生效中的禁入记录", async () => {
    const reply = await command(gm, "player:kick", { ...holderOf("pc1") });
    expect(reply.type).toBe("command:accepted");
    expect(reply.payload).toMatchObject({ kicked: ctx.plIds.get("pc1")!, alreadyKicked: true });

    const rows = await ctx.container.db
      .select()
      .from(sessionKicks)
      .where(and(eq(sessionKicks.sessionId, ctx.sessionId), eq(sessionKicks.userId, ctx.plIds.get("pc1")!)));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.reason).toBe("干扰他人发言");
  });

  test("踢出按玩家与按团隔离：其他玩家与其他团不受影响", async () => {
    const pc2 = await connectWs(wsUrl(), ctx.playerTokens.get("pc2")!);
    await pc2.waitFor((m) => m.type === "snapshot");
    expect(pc2.readyState).toBe(WebSocket.OPEN);
    await closeWs(pc2);

    const sessionsRepo = new DrizzleSessionsRepository(ctx.container.db);
    const createSession = new CreateSessionUseCase(
      sessionsRepo,
      ctx.container.ruleRegistry,
      ctx.container.idGenerator,
      ctx.container.clock
    );
    const other = await createSession.execute({ ownerId: ctx.gmUserId, moduleId: "module-test", characterIds: ["char-pc1"],
    });
    const otherRes = await ctx.app.handle(
      new Request(`http://localhost/api/v1/sessions/${other.session.id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.playerTokens.get("pc1")!}` },
        body: JSON.stringify({ role: "pc", characterId: "char-pc1" }),
      })
    );
    expect(otherRes.status).toBe(200);
  });

  test("非 GM 无法踢出或解除禁入", async () => {
    const pc2 = await connectWs(wsUrl(), ctx.playerTokens.get("pc2")!);
    await pc2.waitFor((m) => m.type === "snapshot");

    const kickReply = await command(pc2, "player:kick", { ...holderOf("pc1") });
    expect(kickReply).toMatchObject({ type: "command:rejected", payload: { code: "FORBIDDEN" } });

    const unkickReply = await command(pc2, "player:unkick", { ...holderOf("pc1") });
    expect(unkickReply).toMatchObject({ type: "command:rejected", payload: { code: "FORBIDDEN" } });

    await closeWs(pc2);
  });

  test("GM 解除禁入后玩家恢复进入，重复解除返回 lifted=false", async () => {
    const reply = await command(gm, "player:unkick", { ...holderOf("pc1") });
    expect(reply.type).toBe("command:accepted");
    expect(reply.payload).toMatchObject({ holderId: ctx.plIds.get("pc1")!, lifted: true });

    const again = await command(gm, "player:unkick", { ...holderOf("pc1") });
    expect(again.payload).toMatchObject({ holderId: ctx.plIds.get("pc1")!, lifted: false });

    const obRes = await claim(ctx.playerTokens.get("pc1")!, { role: "ob" });
    expect(obRes.status).toBe(200);

    const pc1 = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
    await pc1.waitFor((m) => m.type === "snapshot");
    expect(pc1.closeInfo).toBeNull();
    await closeWs(pc1);
  });

  test("结团后仍可踢出与解除禁入", async () => {
    const sessionsRepo = new DrizzleSessionsRepository(ctx.container.db);
    const statusUrl = `http://localhost/api/v1/gm/sessions/${ctx.sessionId}/status`;
    const res = await ctx.app.handle(
      new Request(statusUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.gmToken}` },
        body: JSON.stringify({ status: "ended" }),
      })
    );
    expect(res.status).toBe(200);
    const ended = await ctx.container.db.select().from(sessions).where(eq(sessions.id, ctx.sessionId));
    expect(ended[0]!.status).toBe("ended");

    const gmEnded = await openGm();
    const kickReply = await command(gmEnded, "player:kick", { ...holderOf("pc2") });
    expect(kickReply.type).toBe("command:accepted");

    const unkickReply = await command(gmEnded, "player:unkick", { ...holderOf("pc2") });
    expect(unkickReply.type).toBe("command:accepted");
    expect(unkickReply.payload).toMatchObject({ lifted: true });

    const obClaim = await claim(ctx.playerTokens.get("ob1")!, { role: "ob" });
    expect(obClaim.status).toBe(200);

    const session = await sessionsRepo.findSessionById(ctx.sessionId);
    expect(session?.status).toBe("ended");
    await closeWs(gmEnded);
  });
});
