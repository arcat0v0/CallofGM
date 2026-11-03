import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import {
  setupTestApp,
  connectWs,
  closeWs,
  sendCommand,
  stopServer,
  listenTestApp,
  setSessionPhase,
  type TestContext,
  type TestWebSocket,
  gmUserIdRef,
} from "../helpers/setup";
import { handouts, mediaAssets } from "@/platform/db/schema";
import {
  HandoutGrantedEvent,
  SessionSnapshotPayload,
  type GrantedHandoutDto,
} from "@cogm/shared";
import { mkdir, writeFile, rm } from "fs/promises";

describe("Handouts & moderation contract tests", () => {
  let ctx: TestContext;
  let server: ReturnType<TestContext["app"]["listen"]>;
  const mediaDir = `data/test-media-${Date.now()}`;
  const wsUrl = () => `ws://localhost:${server.server?.port}/api/v1/sessions/${ctx.sessionId}/ws`;

  beforeAll(async () => {
    process.env.MEDIA_DIR = mediaDir;
    ctx = await setupTestApp({
      players: ["pc1", "pc2", "ob1"],
      characters: [
        { id: "char-pc1", name: "调查员一号", kind: "pc" },
        { id: "char-pc2", name: "调查员二号", kind: "pc" },
      ],
      claims: [
        { player: "pc1", role: "pc", characterId: "char-pc1" },
        { player: "pc2", role: "pc", characterId: "char-pc2" },
        { player: "ob1", role: "ob" },
      ],
    });
    server = listenTestApp(ctx.app);

    await mkdir(mediaDir, { recursive: true });
    await writeFile(`${mediaDir}/handout-img-key`, new Uint8Array([1, 2, 3, 4]));

    await ctx.container.db.insert(mediaAssets).values({
      id: "asset-handout-img",
      ownerId: gmUserIdRef(),
      purpose: "handout",
      storageKey: "handout-img-key",
      filename: "map.png",
      mimeType: "image/png",
      size: 4,
      sha256: "hash",
      metadataJson: "{}",
      deletedAt: null,
    }).onConflictDoNothing();

    const { modules } = await import("@/platform/db/schema");
    await ctx.container.db.insert(modules).values({
      id: "module-other-x",
      name: "Other",
      description: "",
      ruleId: "coc7e",
      createdAt: Date.now(),
      ownerId: gmUserIdRef(),
      deletedAt: null,
      updatedAt: Date.now(),
    }).onConflictDoNothing();

    await ctx.container.db.insert(handouts).values([
      { id: "handout-pub", moduleId: "module-test", title: "公开线索", content: "大家都能看", imageAssetId: null, createdAt: Date.now() },
      { id: "handout-secret", moduleId: "module-test", title: "秘密线索", content: "只有目标能看", imageAssetId: null, createdAt: Date.now() },
      { id: "handout-secret-img", moduleId: "module-test", title: "带图秘密线索", content: "只有目标能看", imageAssetId: "asset-handout-img", createdAt: Date.now() },
      { id: "handout-other", moduleId: "module-other-x", title: "别模组情报", content: "x", imageAssetId: null, createdAt: Date.now() },
    ]).onConflictDoNothing();
    await setSessionPhase(ctx, "free_discussion");
  });

  afterAll(async () => {
    await stopServer(server);
    ctx.container.dbContext.sqlite.close();
    await rm(mediaDir, { recursive: true, force: true });
    delete process.env.MEDIA_DIR;
  });

  async function openAll() {
    const gm = await connectWs(wsUrl(), ctx.gmToken);
    const pc1 = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
    const pc2 = await connectWs(wsUrl(), ctx.playerTokens.get("pc2")!);
    const ob = await connectWs(wsUrl(), ctx.playerTokens.get("ob1")!);
    await Promise.all([
      gm.waitFor((m) => m.type === "snapshot"),
      pc1.waitFor((m) => m.type === "snapshot"),
      pc2.waitFor((m) => m.type === "snapshot"),
      ob.waitFor((m) => m.type === "snapshot"),
    ]);
    return { gm, pc1, pc2, ob };
  }

  async function closeAll(...sockets: TestWebSocket[]) {
    for (const ws of sockets) {
      await closeWs(ws);
    }
  }

  test("公开情报：全员（含 OB）收到并广播", async () => {
    const { gm, pc1, pc2, ob } = await openAll();

    sendCommand(gm, "handout:grant", { handoutId: "handout-pub", recipientCharacterIds: [] }, "hg-1");
    const [e1, e2, e3] = await Promise.all([
      pc1.waitFor((m) => m.type === "handout:granted"),
      pc2.waitFor((m) => m.type === "handout:granted"),
      ob.waitFor((m) => m.type === "handout:granted"),
    ]);
    expect(e1.payload.grant.handout.title).toBe("公开线索");
    expect(e1.payload.grant.isPublic).toBe(true);
    expect(e2.payload.grant.grantId).toBe(e1.payload.grant.grantId);
    expect(e3.payload.grant.grantId).toBe(e1.payload.grant.grantId);

    // 玩家无权发放
    sendCommand(pc1, "handout:grant", { handoutId: "handout-pub", recipientCharacterIds: [] }, "hg-2");
    const reply = await pc1.waitFor((m) => m.commandId === "hg-2");
    expect(reply.type).toBe("command:rejected");

    await closeAll(gm, pc1, pc2, ob);
  });

  test("秘密情报：非目标完全无感知，快照按身份过滤", async () => {
    const { gm, pc1, pc2, ob } = await openAll();

    sendCommand(gm, "handout:grant", { handoutId: "handout-secret", recipientCharacterIds: ["char-pc1"] }, "hg-3");
    const granted = await pc1.waitFor((m) => m.type === "handout:granted");
    expect(granted.payload.grant.handout.title).toBe("秘密线索");
    expect(granted.payload.grant.isPublic).toBe(false);
    const grantId = granted.payload.grant.grantId;

    // pc2 / ob 完全无感知
    await new Promise((r) => setTimeout(r, 200));
    expect(pc2.messages.some((m) => m.type === "handout:granted" && m.payload.grant.grantId === grantId)).toBe(false);
    expect(ob.messages.some((m) => m.type === "handout:granted" && m.payload.grant.grantId === grantId)).toBe(false);

    // 快照：pc1 可见，pc2/ob 不可见
    const pc1Again = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
    const snap1 = await pc1Again.waitFor((m) => m.type === "snapshot");
    expect(snap1.payload.visibleHandouts.some((h: any) => h.grantId === grantId)).toBe(true);

    const pc2Again = await connectWs(wsUrl(), ctx.playerTokens.get("pc2")!);
    const snap2 = await pc2Again.waitFor((m) => m.type === "snapshot");
    expect(snap2.payload.visibleHandouts.some((h: any) => h.grantId === grantId)).toBe(false);

    await closeAll(gm, pc1, pc2, ob, pc1Again, pc2Again);
  });

  test("追加对象：仅新增 PC 收到，旧对象不重复通知", async () => {
    const { gm, pc1, pc2, ob } = await openAll();

    sendCommand(gm, "handout:grant", { handoutId: "handout-secret", recipientCharacterIds: ["char-pc1"] }, "hg-4");
    const granted = await pc1.waitFor((m) => m.type === "handout:granted" && m.payload.grant.handout.id === "handout-secret");
    const grantId = granted.payload.grant.grantId;
    await gm.waitFor((m) => m.type === "handout:granted" && m.payload.grant.grantId === grantId);

    // 追加 pc2（pc1 已在内）
    sendCommand(gm, "handout:append", { grantId, recipientCharacterIds: ["char-pc1", "char-pc2"] }, "hg-5");
    await pc2.waitFor((m) => m.type === "handout:granted" && m.payload.grant.grantId === grantId);

    // pc1 不应收到重复通知（此后无新事件）
    const before = pc1.messages.filter((m) => m.type === "handout:granted" && m.payload.grant.grantId === grantId).length;
    await new Promise((r) => setTimeout(r, 200));
    const after = pc1.messages.filter((m) => m.type === "handout:granted" && m.payload.grant.grantId === grantId).length;
    expect(after).toBe(before);

    await closeAll(gm, pc1, pc2, ob);
  });

  test("秘密情报图片：未授权玩家读取被拒，目标玩家可读", async () => {
    const { gm, pc1 } = await openAll();
    sendCommand(gm, "handout:grant", { handoutId: "handout-secret-img", recipientCharacterIds: ["char-pc1"] }, "hg-6");
    await pc1.waitFor((m) => m.type === "handout:granted" && m.payload.grant.handout.id === "handout-secret-img");
    await closeAll(gm, pc1);

    const base = `http://localhost:${server.server?.port}`;

    // 目标玩家可读
    const okRes = await fetch(`${base}/api/v1/media/asset-handout-img`, {
      headers: { Authorization: `Bearer ${ctx.playerTokens.get("pc1")}` },
    });
    expect(okRes.status).toBe(200);
    await okRes.arrayBuffer();

    // 非目标玩家 403
    const deniedRes = await fetch(`${base}/api/v1/media/asset-handout-img`, {
      headers: { Authorization: `Bearer ${ctx.playerTokens.get("pc2")}` },
    });
    expect(deniedRes.status).toBe(403);
    await deniedRes.arrayBuffer();

    // OB 403
    const obRes = await fetch(`${base}/api/v1/media/asset-handout-img`, {
      headers: { Authorization: `Bearer ${ctx.playerTokens.get("ob1")}` },
    });
    expect(obRes.status).toBe(403);
    await obRes.arrayBuffer();

    // 匿名 401
    const anonRes = await fetch(`${base}/api/v1/media/asset-handout-img`);
    expect(anonRes.status).toBe(401);
    await anonRes.arrayBuffer();
  });

  test("在线列表：GM 快照与 presence 推送", async () => {
    const { gm, pc1, pc2, ob } = await openAll();

    // GM 收到 presence:updated（连接建立后）
    const presence = await gm.waitFor(
      (m) => m.type === "presence:updated" && m.payload.online.length >= 3
    );
    const playerIds = presence.payload.online.map((o: any) => o.playerId);
    expect(playerIds).toContain(ctx.playerIds.get("pc1"));
    expect(playerIds).toContain(ctx.playerIds.get("pc2"));
    expect(playerIds).toContain(ctx.playerIds.get("ob1"));

    // GM 快照包含在线列表，玩家快照不包含
    const gm2 = await connectWs(wsUrl(), ctx.gmToken);
    const gmSnap = await gm2.waitFor((m) => m.type === "snapshot");
    expect(gmSnap.payload.online?.length).toBeGreaterThan(0);
    await closeAll(gm, pc1, pc2, ob, gm2);

    const pc3 = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
    const playerSnap = await pc3.waitFor((m) => m.type === "snapshot");
    expect(playerSnap.payload.online).toBeUndefined();
    await closeAll(pc3);
  });

  test("踢出：连接被关闭且团内禁入，GM 解除后可重连", async () => {
    const { gm, pc1 } = await openAll();

    sendCommand(gm, "player:kick", { playerId: ctx.playerIds.get("pc1") }, "kick-1");
    const kickReply = await gm.waitFor((m) => m.commandId === "kick-1" && m.type === "command:accepted");
    expect(kickReply.payload.kicked).toBe(ctx.playerIds.get("pc1"));
    expect(kickReply.payload.alreadyKicked).toBe(false);

    expect((await pc1.closed).code).toBe(4000);

    const rejected = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
    const kickedMessage = await rejected.waitFor((m) => m.type === "session:kicked");
    expect(kickedMessage.payload.code).toBe("SESSION_KICKED");
    expect(rejected.messages.some((m) => m.type === "snapshot")).toBe(false);
    await rejected.closed;

    sendCommand(gm, "player:unkick", { playerId: ctx.playerIds.get("pc1") }, "unkick-1");
    const unkickReply = await gm.waitFor((m) => m.commandId === "unkick-1" && m.type === "command:accepted");
    expect(unkickReply.payload.lifted).toBe(true);

    const reconnected = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
    await reconnected.waitFor((m) => m.type === "snapshot");

    await closeAll(gm, reconnected);
  });

  test("拉黑：立即断开且无法握手，解封后恢复", async () => {
    const { gm, pc1, pc2 } = await openAll();

    // 永久拉黑 pc1
    sendCommand(gm, "player:ban", { playerId: ctx.playerIds.get("pc1"), reason: "测试封禁" }, "ban-1");
    const banReply = await gm.waitFor((m) => m.commandId === "ban-1" && m.type === "command:accepted");
    expect(banReply.payload.permanent).toBe(true);

    await new Promise((r) => setTimeout(r, 300));
    expect(pc1.readyState).toBe(WebSocket.CLOSED);

    // pc1 无法再握手（指纹被拉黑）
    await expect(connectWs(wsUrl(), ctx.playerTokens.get("pc1")!, "fp-pc1")).rejects.toThrow();

    // pc2 不受影响
    expect(pc2.readyState).toBe(WebSocket.OPEN);

    // 解封后恢复
    const { anonymousPlayers } = await import("@/platform/db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await ctx.container.db
      .select({ fingerprintHash: anonymousPlayers.fingerprintHash })
      .from(anonymousPlayers)
      .where(eq(anonymousPlayers.id, ctx.playerIds.get("pc1")!));
    const fingerprintHash = rows[0]!.fingerprintHash;

    sendCommand(gm, "player:unban", { fingerprintHash }, "unban-1");
    await gm.waitFor((m) => m.commandId === "unban-1" && m.type === "command:accepted");

    const reconnected = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
    await reconnected.waitFor((m) => m.type === "snapshot");

    await closeAll(gm, pc2, reconnected);
  });
  test("情报已读：收下后按玩家持久化，重连快照与 REST 均保留已读", async () => {
    const { gm, pc1, pc2, ob } = await openAll();

    sendCommand(gm, "handout:grant", { handoutId: "handout-secret", recipientCharacterIds: ["char-pc1"] }, "hg-read-1");
    const granted = await pc1.waitFor(
      (m) => m.type === "handout:granted" && m.payload.grant.handout.id === "handout-secret"
    );
    const grant = HandoutGrantedEvent.parse(granted.payload).grant;
    const grantId = grant.grantId;
    expect(grant.read).toBe(false);

    const before = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
    const beforeSnap = SessionSnapshotPayload.parse((await before.waitFor((m) => m.type === "snapshot")).payload);
    expect(beforeSnap.visibleHandouts.find((item) => item.grantId === grantId)?.read).toBe(false);
    await closeWs(before);

    sendCommand(pc1, "handout:read", { grantId }, "read-1");
    const readReply = await pc1.waitFor((m) => m.commandId === "read-1");
    expect(readReply.type).toBe("command:accepted");

    const after = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
    const afterSnap = SessionSnapshotPayload.parse((await after.waitFor((m) => m.type === "snapshot")).payload);
    expect(afterSnap.visibleHandouts.find((item) => item.grantId === grantId)?.read).toBe(true);

    const restRes = await fetch(`http://localhost:${server.server?.port}/api/v1/sessions/${ctx.sessionId}/handouts`, {
      headers: { Authorization: `Bearer ${ctx.playerTokens.get("pc1")}` },
    });
    expect(restRes.status).toBe(200);
    const restBody = (await restRes.json()) as { items: GrantedHandoutDto[] };
    expect(restBody.items.find((item) => item.grantId === grantId)?.read).toBe(true);

    await closeAll(gm, pc1, pc2, ob, after);
  });

  test("情报已读：公开情报各玩家独立记录，重连不再提示未读", async () => {
    const { gm, pc1, ob } = await openAll();

    sendCommand(gm, "handout:grant", { handoutId: "handout-pub", recipientCharacterIds: [] }, "hg-read-2");
    const granted = await ob.waitFor(
      (m) => m.type === "handout:granted" && m.payload.grant.handout.id === "handout-pub"
    );
    const grantId = HandoutGrantedEvent.parse(granted.payload).grant.grantId;

    sendCommand(ob, "handout:read", { grantId }, "read-2");
    await ob.waitFor((m) => m.commandId === "read-2" && m.type === "command:accepted");

    const obAgain = await connectWs(wsUrl(), ctx.playerTokens.get("ob1")!);
    const obSnap = SessionSnapshotPayload.parse((await obAgain.waitFor((m) => m.type === "snapshot")).payload);
    expect(obSnap.visibleHandouts.find((item) => item.grantId === grantId)?.read).toBe(true);

    const pc1Again = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
    const pc1Snap = SessionSnapshotPayload.parse((await pc1Again.waitFor((m) => m.type === "snapshot")).payload);
    expect(pc1Snap.visibleHandouts.find((item) => item.grantId === grantId)?.read).toBe(false);

    await closeAll(gm, pc1, ob, obAgain, pc1Again);
  });

  test("情报已读：非目标玩家与 GM 不能代收", async () => {
    const { gm, pc1, pc2 } = await openAll();

    sendCommand(gm, "handout:grant", { handoutId: "handout-secret", recipientCharacterIds: ["char-pc1"] }, "hg-read-3");
    const granted = await pc1.waitFor(
      (m) => m.type === "handout:granted" && m.payload.grant.handout.id === "handout-secret"
    );
    const grantId = HandoutGrantedEvent.parse(granted.payload).grant.grantId;

    sendCommand(pc2, "handout:read", { grantId }, "read-3");
    const denied = await pc2.waitFor((m) => m.commandId === "read-3");
    expect(denied.type).toBe("command:rejected");
    expect(denied.payload.code).toBe("HANDOUT_GRANT_NOT_FOUND");

    sendCommand(gm, "handout:read", { grantId }, "read-4");
    const gmDenied = await gm.waitFor((m) => m.commandId === "read-4");
    expect(gmDenied.type).toBe("command:rejected");

    await closeAll(gm, pc1, pc2);
  });
});
