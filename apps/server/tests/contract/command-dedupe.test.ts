import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import {
  setupTestApp,
  setSessionPhase,
  connectWs,
  closeWs,
  sendCommand,
  listenTestApp,
  type TestContext,
  type TestServer,
} from "../helpers/setup";
import { sessionMessages, tracks, mediaAssets } from "@/platform/db/schema";
import { and, eq } from "drizzle-orm";

describe("Command dedupe by actor contract", () => {
  let ctx: TestContext;
  let server: TestServer;
  const wsUrl = () => `ws://localhost:${server.server?.port}/api/v1/sessions/${ctx.sessionId}/ws`;

  beforeAll(async () => {
    ctx = await setupTestApp({
      players: ["pc1"],
      characters: [{ id: "char-pc1", name: "调查员一号", kind: "pc" }],
      claims: [{ player: "pc1", role: "pc", characterId: "char-pc1" }],
    });
    server = listenTestApp(ctx.app);
    await setSessionPhase(ctx, "free_discussion");

    await ctx.container.db.insert(mediaAssets).values({
      id: "asset-dedupe-audio",
      purpose: "audio",
      storageKey: "dedupe-audio",
      filename: "se.mp3",
      mimeType: "audio/mpeg",
      size: 100,
      sha256: "dedupe-audio-hash",
      metadataJson: "{}",
      createdAt: Date.now(),
    }).onConflictDoNothing();
    await ctx.container.db.insert(tracks).values({
      id: "track-dedupe-se",
      moduleId: "module-test",
      name: "提示音",
      audioAssetId: "asset-dedupe-audio",
      type: "se",
      duration: 500,
      createdAt: Date.now(),
      deletedAt: null,
    });
  });

  afterAll(async () => {
    await server.stop(true);
    ctx.container.dbContext.sqlite.close();
  });

  test("不同身份复用同一 commandId：两边都执行；同身份重放保持幂等", async () => {
    const gm = await connectWs(wsUrl(), ctx.gmToken);
    const pc = await connectWs(wsUrl(), ctx.playerTokens.get("pc1")!);
    await Promise.all([
      gm.waitFor((m) => m.type === "snapshot"),
      pc.waitFor((m) => m.type === "snapshot"),
    ]);

    const sharedCommandId = "shared-dedupe-0001";

    sendCommand(pc, "chat:send", { channel: "ooc", content: "玩家发言" }, sharedCommandId);
    const pcReply = await pc.waitFor((m) => m.commandId === sharedCommandId);
    expect(pcReply.type).toBe("command:accepted");
    const playerMessageId = pcReply.payload.messageId as string;

    sendCommand(gm, "audio:se", { trackId: "track-dedupe-se" }, sharedCommandId);
    const gmReply = await gm.waitFor((m) => m.commandId === sharedCommandId);
    expect(gmReply.type).toBe("command:accepted");
    expect(gmReply.payload).toMatchObject({ ok: true });

    await pc.waitFor(
      (m) => m.type === "audio:se" && m.payload.trackId === "track-dedupe-se",
    );

    sendCommand(pc, "chat:send", { channel: "ooc", content: "玩家发言" }, sharedCommandId);
    const replay = await pc.waitFor((m) => m.commandId === sharedCommandId);
    expect(replay.payload.messageId).toBe(playerMessageId);

    const rows = await ctx.container.db
      .select({ id: sessionMessages.id })
      .from(sessionMessages)
      .where(
        and(
          eq(sessionMessages.sessionId, ctx.sessionId),
          eq(sessionMessages.content, "玩家发言"),
        ),
      );
    expect(rows).toHaveLength(1);

    await closeWs(gm);
    await closeWs(pc);
  });
});
