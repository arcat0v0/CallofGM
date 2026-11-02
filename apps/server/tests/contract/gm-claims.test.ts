import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  closeWs,
  connectWs,
  listenTestApp,
  setupTestApp,
  stopServer,
  type TestContext,
  type TestServer,
  type TestWebSocket,
} from "../helpers/setup";
import { MyClaimResponse, JoinInfoResponse, SessionCloseCode } from "@cogm/shared";

describe("GM claim management contract", () => {
  let ctx: TestContext;
  let server: TestServer;
  const wsUrl = () => `ws://localhost:${server.server?.port}/api/v1/sessions/${ctx.sessionId}/ws`;
  const requests: TestWebSocket[] = [];

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
      ],
    });
    server = listenTestApp(ctx.app);
  });

  afterAll(async () => {
    for (const ws of requests) {
      await closeWs(ws);
    }
    await stopServer(server);
    ctx.container.dbContext.sqlite.close();
  });

  async function gmPost(path: string, body: unknown) {
    return ctx.app.handle(
      new Request(`http://localhost/api/v1/gm/sessions/${ctx.sessionId}/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ctx.gmToken}`,
        },
        body: JSON.stringify(body),
      })
    );
  }

  async function playerPost(token: string, path: string, body: unknown) {
    return ctx.app.handle(
      new Request(`http://localhost/api/v1/gm/sessions/${ctx.sessionId}/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
    );
  }

  async function myClaim(token: string) {
    const res = await ctx.app.handle(
      new Request(`http://localhost/api/v1/sessions/${ctx.sessionId}/my-claim`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    return MyClaimResponse.parse(await res.json());
  }

  async function joinInfo() {
    const res = await ctx.app.handle(
      new Request(`http://localhost/api/v1/public/sessions/${ctx.sessionId}/join-info`)
    );
    return JoinInfoResponse.parse(await res.json());
  }

  async function openPlayer(name: string) {
    const ws = await connectWs(wsUrl(), ctx.playerTokens.get(name)!);
    requests.push(ws);
    await ws.waitFor((message) => message.type === "snapshot");
    return ws;
  }

  test("GM 指派会替换角色原认领人并通知其离开", async () => {
    const gm = await connectWs(wsUrl(), ctx.gmToken);
    requests.push(gm);
    await gm.waitFor((message) => message.type === "snapshot");

    const pc2 = await openPlayer("pc2");

    const res = await gmPost("claims/assign", {
      playerId: ctx.playerIds.get("pc1")!,
      characterId: "char-pc2",
    });
    expect(res.status).toBe(200);

    expect(await pc2.closed).toMatchObject({ code: SessionCloseCode.seatReleased, reason: "seat released" });
    const refresh = await gm.waitFor((message) => message.type === "session:refresh");
    expect(refresh.type).toBe("session:refresh");

    expect((await myClaim(ctx.playerTokens.get("pc1")!)).claim?.characterId).toBe("char-pc2");
    expect((await myClaim(ctx.playerTokens.get("pc2")!)).claim).toBeNull();

    const seats = (await joinInfo()).characters;
    expect(seats.find((seat) => seat.id === "char-pc1")?.claimed).toBe(false);
    expect(seats.find((seat) => seat.id === "char-pc2")?.claimed).toBe(true);
  });

  test("GM 解除认领会收回席位并关闭该玩家连接", async () => {
    const pc1 = await openPlayer("pc1");

    const res = await gmPost("claims/release", { playerId: ctx.playerIds.get("pc1")! });
    expect(res.status).toBe(200);

    expect(await pc1.closed).toMatchObject({ code: SessionCloseCode.seatReleased, reason: "seat released" });
    expect((await myClaim(ctx.playerTokens.get("pc1")!)).claim).toBeNull();
    expect((await joinInfo()).characters.every((seat) => !seat.claimed)).toBe(true);
  });

  test("玩家令牌与非法请求无法调用指派与解除接口", async () => {
    const forbidden = await playerPost(ctx.playerTokens.get("ob1")!, "claims/assign", {
      playerId: ctx.playerIds.get("pc2")!,
      characterId: "char-pc1",
    });
    expect(forbidden.status).toBe(401);

    const invalid = await gmPost("claims/assign", { characterId: "char-pc1" });
    expect(invalid.status).toBe(400);

    const unknownCharacter = await gmPost("claims/assign", {
      playerId: ctx.playerIds.get("pc2")!,
      characterId: "missing-character",
    });
    expect(unknownCharacter.status).toBe(404);

    const invalidRelease = await gmPost("claims/release", {});
    expect(invalidRelease.status).toBe(400);
  });

  test("GM 指派后玩家重新连接获得新角色席位", async () => {
    const assign = await gmPost("claims/assign", {
      playerId: ctx.playerIds.get("pc2")!,
      characterId: "char-pc1",
    });
    expect(assign.status).toBe(200);

    const pc2 = await openPlayer("pc2");
    const snapshot = await pc2.waitFor((message) => message.type === "snapshot");
    expect(snapshot.payload.viewer.seatRole).toBe("pc");
    expect(
      snapshot.payload.characters.find((character: { characterId: string }) => character.characterId === "char-pc1")?.claim
    ).toMatchObject({ playerId: ctx.playerIds.get("pc2"), role: "pc" });
  });
});
