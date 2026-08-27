import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import {
  setupTestApp,
  connectWs,
  closeWs,
  sendCommand,
  listenTestApp,
  setSessionPhase,
  type TestContext,
  type TestWebSocket,
} from "../helpers/setup";
import { scenes, tracks, mediaAssets, modules } from "@/platform/db/schema";

describe("Stage control contract tests", () => {
  let ctx: TestContext;
  let server: ReturnType<TestContext["app"]["listen"]>;
  const wsUrl = () => `ws://localhost:${server.server?.port}/api/v1/sessions/${ctx.sessionId}/ws`;

  beforeAll(async () => {
    ctx = await setupTestApp({
      players: ["pc1"],
      characters: [{ id: "char-pc1", name: "调查员一号", kind: "pc", portraits: ["default", "angry"] }],
      claims: [{ player: "pc1", role: "pc", characterId: "char-pc1" }],
    });
    server = listenTestApp(ctx.app);

    const db = ctx.container.db;
    await db.insert(modules).values({
      id: "module-other",
      name: "Other Module",
      description: "",
      ruleId: "coc7e",
      createdAt: Date.now(),
    });
    await db.insert(scenes).values([
      { id: "scene-1", moduleId: "module-test", name: "图书馆", sortOrder: 1, bgAssetId: null, createdAt: Date.now() },
      { id: "scene-2", moduleId: "module-test", name: "地下室", sortOrder: 2, bgAssetId: null, createdAt: Date.now() },
      { id: "scene-other", moduleId: "module-other", name: "别的模组场景", sortOrder: 1, bgAssetId: null, createdAt: Date.now() },
    ]);
    await db.insert(mediaAssets).values({
      id: "asset-audio",
      purpose: "audio",
      storageKey: "test-audio",
      filename: "bgm.mp3",
      mimeType: "audio/mpeg",
      size: 1000,
      sha256: "audio-hash",
      metadataJson: "{}",
      createdAt: Date.now(),
    }).onConflictDoNothing();
    await db.insert(tracks).values([
      { id: "track-bgm-1", moduleId: "module-test", name: "主题BGM", audioAssetId: "asset-audio", type: "bgm", duration: 180000, createdAt: Date.now() },
      { id: "track-bgm-other", moduleId: "module-other", name: "别模组BGM", audioAssetId: "asset-audio", type: "bgm", duration: 60000, createdAt: Date.now() },
      { id: "track-se-1", moduleId: "module-test", name: "开门声", audioAssetId: "asset-audio", type: "se", duration: 2000, createdAt: Date.now() },
    ]);
    await setSessionPhase(ctx, "free_discussion");
  });

  afterAll(async () => {
    await server.stop(true);
    ctx.container.dbContext.sqlite.close();
  });

  async function openAll() {
    const gm = await connectWs(wsUrl(), ctx.gmToken);
    const pc = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
    await Promise.all([
      gm.waitFor((m) => m.type === "snapshot"),
      pc.waitFor((m) => m.type === "snapshot"),
    ]);
    return { gm, pc };
  }

  async function closeAll(...sockets: TestWebSocket[]) {
    for (const ws of sockets) {
      await closeWs(ws);
    }
  }

  test("场景切换：仅限本模组场景，广播全员", async () => {
    const { gm, pc } = await openAll();

    sendCommand(gm, "scene:switch", { sceneId: "scene-1" }, "sc-1");
    const event = await pc.waitFor((m) => m.type === "scene:changed");
    expect(event.payload.sceneId).toBe("scene-1");
    expect(event.payload.name).toBe("图书馆");

    // 跨模组场景被拒绝
    sendCommand(gm, "scene:switch", { sceneId: "scene-other" }, "sc-2");
    const reply = await gm.waitFor((m) => m.commandId === "sc-2");
    expect(reply.type).toBe("command:rejected");

    // 玩家无权限
    sendCommand(pc, "scene:switch", { sceneId: "scene-2" }, "sc-3");
    const pcReply = await pc.waitFor((m) => m.commandId === "sc-3");
    expect(pcReply.type).toBe("command:rejected");

    await closeAll(gm, pc);
  });

  test("GM 表情控制：立绘存在性校验与广播", async () => {
    const { gm, pc } = await openAll();

    sendCommand(gm, "expression:set", { characterId: "char-pc1", expressionKey: "angry" }, "ex-1");
    const event = await pc.waitFor((m) => m.type === "expression:changed");
    expect(event.payload.characterId).toBe("char-pc1");
    expect(event.payload.expressionKey).toBe("angry");

    sendCommand(gm, "expression:set", { characterId: "char-pc1", expressionKey: "nonexistent" }, "ex-2");
    const reply = await gm.waitFor((m) => m.commandId === "ex-2");
    expect(reply.type).toBe("command:rejected");
    expect(reply.payload.code).toBe("EXPRESSION_NOT_FOUND");

    sendCommand(pc, "expression:set", { characterId: "char-pc1", expressionKey: "default" }, "ex-3");
    const pcReply = await pc.waitFor((m) => m.commandId === "ex-3");
    expect(pcReply.type).toBe("command:rejected");

    await closeAll(gm, pc);
  });

  test("BGM 权威状态：版本递增、暂停固化进度、陈旧指令被拒", async () => {
    const { gm, pc } = await openAll();

    // 初始版本 0，播放
    sendCommand(gm, "audio:bgm", { action: "play", trackId: "track-bgm-1", expectedVersion: 0 }, "bgm-1");
    const playEvent = await pc.waitFor((m) => m.type === "audio:bgm");
    expect(playEvent.payload.bgm.trackId).toBe("track-bgm-1");
    expect(playEvent.payload.bgm.playing).toBe(true);
    expect(playEvent.payload.bgm.version).toBe(1);

    // 陈旧版本被拒绝
    sendCommand(gm, "audio:bgm", { action: "volume", volume: 30, expectedVersion: 0 }, "bgm-stale");
    const staleReply = await gm.waitFor((m) => m.commandId === "bgm-stale");
    expect(staleReply.type).toBe("command:rejected");
    expect(staleReply.payload.code).toBe("AUDIO_VERSION_CONFLICT");

    // 暂停：固化进度
    sendCommand(gm, "audio:bgm", { action: "pause", expectedVersion: 1 }, "bgm-2");
    const pauseEvent = await gm.waitFor((m) => m.type === "audio:bgm" && m.payload.bgm.playing === false);
    expect(pauseEvent.payload.bgm.version).toBe(2);
    expect(pauseEvent.payload.bgm.seekOffsetMs).toBeGreaterThanOrEqual(0);

    // 音量与循环
    sendCommand(gm, "audio:bgm", { action: "volume", volume: 40, expectedVersion: 2 }, "bgm-3");
    const volEvent = await gm.waitFor((m) => m.type === "audio:bgm" && m.payload.bgm.volume === 40);
    expect(volEvent.payload.bgm.version).toBe(3);

    sendCommand(gm, "audio:bgm", { action: "loop", loop: false, expectedVersion: 3 }, "bgm-4");
    const loopEvent = await gm.waitFor((m) => m.type === "audio:bgm" && m.payload.bgm.loop === false);
    expect(loopEvent.payload.bgm.version).toBe(4);

    // 跨模组音轨被拒绝
    sendCommand(gm, "audio:bgm", { action: "play", trackId: "track-bgm-other", expectedVersion: 4 }, "bgm-5");
    const otherReply = await gm.waitFor((m) => m.commandId === "bgm-5");
    expect(otherReply.type).toBe("command:rejected");

    // SE 音轨不能作为 BGM 播放
    sendCommand(gm, "audio:bgm", { action: "play", trackId: "track-se-1", expectedVersion: 4 }, "bgm-6");
    const seReply = await gm.waitFor((m) => m.commandId === "bgm-6");
    expect(seReply.type).toBe("command:rejected");

    await closeAll(gm, pc);
  });

  test("SE 音效：广播即播，类型校验", async () => {
    const { gm, pc } = await openAll();

    sendCommand(gm, "audio:se", { trackId: "track-se-1", volume: 80 }, "se-1");
    const event = await pc.waitFor((m) => m.type === "audio:se");
    expect(event.payload.trackId).toBe("track-se-1");
    expect(event.payload.volume).toBe(80);

    sendCommand(gm, "audio:se", { trackId: "track-bgm-1" }, "se-2");
    const reply = await gm.waitFor((m) => m.commandId === "se-2");
    expect(reply.type).toBe("command:rejected");

    sendCommand(pc, "audio:se", { trackId: "track-se-1" }, "se-3");
    const pcReply = await pc.waitFor((m) => m.commandId === "se-3");
    expect(pcReply.type).toBe("command:rejected");

    await closeAll(gm, pc);
  });

  test("快照恢复：当前场景与权威 BGM 状态", async () => {
    const { gm, pc } = await openAll();
    sendCommand(gm, "scene:switch", { sceneId: "scene-2" }, "snap-sc");
    sendCommand(gm, "audio:bgm", { action: "play", trackId: "track-bgm-1", expectedVersion: 4 }, "snap-bgm");
    await gm.waitFor((m) => m.type === "audio:bgm" && m.payload.bgm.version === 5);
    await closeAll(gm, pc);

    const pc2 = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
    const snapshot = await pc2.waitFor((m) => m.type === "snapshot");
    expect(snapshot.payload.currentScene?.id).toBe("scene-2");
    expect(snapshot.payload.bgm?.trackId).toBe("track-bgm-1");
    expect(snapshot.payload.bgm?.playing).toBe(true);
    expect(snapshot.payload.bgm?.version).toBe(5);

    await closeAll(pc2);
  });
});
