import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { setupTestApp, listenTestApp, closeWs, type TestContext, type TestServer } from "../helpers/setup";

function cookieOf(response: Response): string {
  const raw = response.headers.get("set-cookie") ?? "";
  return raw.split(";")[0] ?? "";
}

function connectWithCookie(url: string, cookie: string): Promise<WebSocket> {
  const { promise, resolve, reject } = Promise.withResolvers<WebSocket>();
  const ws = new WebSocket(url, { headers: cookie ? { Cookie: cookie } : {} });
  ws.onopen = () => resolve(ws);
  ws.onerror = (err) => reject(err);
  return promise;
}

describe("cookie-only player identity and WS handshake", () => {
  let ctx: TestContext;
  let server: TestServer;
  let cookie = "";

  beforeAll(async () => {
    ctx = await setupTestApp({
      players: [],
      characters: [{ id: "char-cookie", name: "曲奇调查员", kind: "pc" }],
    });
    server = listenTestApp(ctx.app);
  });

  afterAll(() => {
    server.stop(true);
    ctx.container.dbContext.sqlite.close();
  });

  test("identity issues an httpOnly player cookie without exposing it in local storage", async () => {
    const identity = await ctx.app.handle(
      new Request("http://localhost/api/v1/player/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: "fp-cookie-only" }),
      })
    );
    expect(identity.status).toBe(200);
    const setCookie = identity.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("player_token=");
    expect(setCookie.toLowerCase()).toContain("httponly");
    cookie = cookieOf(identity);
  });

  test("claim and WS handshake succeed using only the cookie", async () => {
    const claim = await ctx.app.handle(
      new Request(`http://localhost/api/v1/sessions/${ctx.sessionId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ role: "pc", characterId: "char-cookie" }),
      })
    );
    expect(claim.status).toBe(200);

    const ws = await connectWithCookie(
      `ws://localhost:${server.server.port}/api/v1/sessions/${ctx.sessionId}/ws`,
      cookie
    );
    const { promise, resolve } = Promise.withResolvers<string>();
    ws.onmessage = (event) => resolve(JSON.parse(event.data as string).type);
    expect(await promise).toBe("snapshot");
    await closeWs(ws);
  });

  test("WS handshake without cookie or bearer is rejected", async () => {
    const accepted = await connectWithCookie(
      `ws://localhost:${server.server.port}/api/v1/sessions/${ctx.sessionId}/ws`,
      ""
    ).then(
      (ws) => {
        ws.close();
        return true;
      },
      () => false
    );
    expect(accepted).toBe(false);
  });
});
