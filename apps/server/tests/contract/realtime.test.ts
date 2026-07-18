import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { Elysia } from "elysia";
import { Container } from "@/bootstrap/container";
import { createIdentityRoutes } from "@/modules/identity/transport/routes";
import { createSessionsRoutes } from "@/modules/sessions/transport/routes";
import { createCharactersRoutes } from "@/modules/characters/transport/routes";
import { AppError } from "@/platform/errors/app-error";
import { modules, characters, sessionOutbox } from "@/platform/db/schema";
import { routes as realtimeRoutes } from "@/modules/realtime";
import type { CommandHandler, CommandHandlerContext, CommandHandlerResult } from "@/modules/realtime";
import type { VisibilityScope } from "@/modules/realtime";
import { CreateSessionUseCase, ClaimSeatUseCase } from "@/modules/sessions/application/use-cases";
import { DrizzleSessionsRepository } from "@/modules/sessions/infrastructure/drizzle-sessions-repository";
import { eq } from "drizzle-orm";
import { listenTestApp } from "../helpers/setup";

interface TestWebSocket extends WebSocket {
  messages: any[];
  waitForMessages(count: number): Promise<any[]>;
}

function connectWs(url: string, token: string, fingerprint?: string): Promise<TestWebSocket> {
  const { promise, resolve, reject } = Promise.withResolvers<TestWebSocket>();
  const ws = new WebSocket(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(fingerprint ? { "x-fingerprint": fingerprint } : {}),
    },
  }) as TestWebSocket;

  ws.messages = [];
  const resolvers = new Set<{ count: number; resolve: (msgs: any[]) => void }>();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data as string);
    ws.messages.push(data);
    for (const r of resolvers) {
      if (ws.messages.length >= r.count) {
        resolvers.delete(r);
        r.resolve(ws.messages);
      }
    }
  };

  ws.waitForMessages = (count: number) => {
    const { promise: p, resolve: res } = Promise.withResolvers<any[]>();
    if (ws.messages.length >= count) {
      res(ws.messages);
    } else {
      resolvers.add({ count, resolve: res });
    }
    return p;
  };

  if (ws.readyState === WebSocket.OPEN) {
    resolve(ws);
  } else if (ws.readyState === WebSocket.CLOSED) {
    reject(new Error("WebSocket is already closed"));
  } else {
    ws.onopen = () => {
      resolve(ws);
    };
    ws.onerror = (err) => {
      reject(err);
    };
  }
  return promise;
}

function closeWs(ws: WebSocket): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  if (ws.readyState === WebSocket.CLOSED) {
    resolve();
  } else {
    ws.onclose = () => {
      resolve();
    };
    ws.close();
  }
  return promise;
}

/** 测试用事件探针：生产环境不注册此处理器 */
class TestEventProbeHandler implements CommandHandler {
  readonly type = "test:command" as const;

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    const p = (payload ?? {}) as {
      eventType?: string;
      eventPayload?: unknown;
      visibility?: VisibilityScope;
    };
    return {
      events: [
        {
          type: p.eventType ?? "test:event",
          payload: p.eventPayload ?? {},
          visibility: p.visibility ?? { type: "public" },
        },
      ],
    };
  }
}

describe("Realtime contract tests", () => {
  let container: Container;
  let app: any;
  const gmPassword = "realtime-test-password";
  let gmToken = "";
  let player1Token = "";
  let player2Token = "";
  let player3Token = "";
  let player1Id = "";
  let player2Id = "";
  let player3Id = "";
  let sessionId = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = ":memory:";
    const hash = await Bun.password.hash(gmPassword);
    process.env.GM_PASSWORD_HASH = hash;

    container = new Container([new TestEventProbeHandler()]);
    await container.startupService.startup();

    app = new Elysia()
      .onError(({ error, code, set }) => {
        if (error instanceof AppError) {
          set.status = error.statusCode;
          return {
            code: error.code,
            message: error.message,
          };
        }
        if (code === "VALIDATION") {
          set.status = 400;
          return {
            code: "VALIDATION_FAILED",
            message: error.message,
          };
        }
        set.status = 500;
        return {
          code: "INTERNAL_SERVER_ERROR",
          message: (error as Error).message,
        };
      })
      .use(createIdentityRoutes(container))
      .use(createSessionsRoutes(container))
      .use(createCharactersRoutes(container))
      .use(realtimeRoutes(container));

    const loginRes = await app.handle(
      new Request("http://localhost/api/v1/gm/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "gm", password: gmPassword }),
      })
    );
    const loginBody = (await loginRes.json()) as { sessionToken: string };
    gmToken = loginBody.sessionToken;

    await container.db.insert(modules).values({
      id: "module-rt",
      name: "Realtime Module",
      description: "Realtime Description",
      ruleId: "coc7e",
      createdAt: Date.now(),
    });

    await container.db.insert(characters).values({
      id: "char-rt-1",
      name: "Character rt 1",
      kind: "pc",
      ruleId: "coc7e",
      sheetJson: JSON.stringify({
        attributes: { str: 50, con: 50, siz: 50, dex: 50, app: 50, int: 50, pow: 70, edu: 50, luck: 50 },
        skills: {},
      }),
      createdAt: Date.now(),
    });

    await container.db.insert(characters).values({
      id: "char-rt-2",
      name: "Character rt 2",
      kind: "pc",
      ruleId: "coc7e",
      sheetJson: JSON.stringify({
        attributes: { str: 50, con: 50, siz: 50, dex: 50, app: 50, int: 50, pow: 60, edu: 50, luck: 50 },
        skills: {},
      }),
      createdAt: Date.now(),
    });

    const p1Res = await app.handle(
      new Request("http://localhost/api/v1/player/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: "p1-rt" }),
      })
    );
    const p1Body = (await p1Res.json()) as { playerId: string; token: string };
    player1Id = p1Body.playerId;
    player1Token = p1Body.token;

    const p2Res = await app.handle(
      new Request("http://localhost/api/v1/player/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: "p2-rt" }),
      })
    );
    const p2Body = (await p2Res.json()) as { playerId: string; token: string };
    player2Id = p2Body.playerId;
    player2Token = p2Body.token;

    const p3Res = await app.handle(
      new Request("http://localhost/api/v1/player/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: "p3-rt" }),
      })
    );
    const p3Body = (await p3Res.json()) as { playerId: string; token: string };
    player3Id = p3Body.playerId;
    player3Token = p3Body.token;

    const sessionsRepo = new DrizzleSessionsRepository(container.db);
    const createSession = new CreateSessionUseCase(
      sessionsRepo,
      container.ruleRegistry,
      container.idGenerator,
      container.clock
    );
    const sessionRes = await createSession.execute({
      moduleId: "module-rt",
      characterIds: ["char-rt-1", "char-rt-2"],
    });
    sessionId = sessionRes.session.id;

    const claimSeat = new ClaimSeatUseCase(
      sessionsRepo,
      container.idGenerator,
      container.clock
    );

    await claimSeat.execute({
      sessionId,
      playerId: player1Id,
      role: "pc",
      characterId: "char-rt-1",
    });

    await claimSeat.execute({
      sessionId,
      playerId: player2Id,
      role: "pc",
      characterId: "char-rt-2",
    });
  });

  afterAll(() => {
    container.dbContext.sqlite.close();
  });

  test("Upgrade checks and authorization", async () => {
    const server = listenTestApp(app);
    const port = server.server?.port;
    const wsUrl = `ws://localhost:${port}/api/v1/sessions/${sessionId}/ws`;

    await expect(connectWs(wsUrl, "")).rejects.toThrow();

    await expect(connectWs(wsUrl, player3Token)).rejects.toThrow();

    const p1Ws = await connectWs(wsUrl, player1Token);
    expect(p1Ws).toBeDefined();
    await closeWs(p1Ws);

    const gmWs = await connectWs(wsUrl, gmToken);
    expect(gmWs).toBeDefined();
    await closeWs(gmWs);

    await server.stop(true);
  });

  test("Real-time message broadcasting and visibility filtering", async () => {
    const server = listenTestApp(app);
    const port = server.server?.port;
    const wsUrl = `ws://localhost:${port}/api/v1/sessions/${sessionId}/ws`;

    const gmWs = await connectWs(wsUrl, gmToken);
    const p1Ws = await connectWs(wsUrl, player1Token);
    const p2Ws = await connectWs(wsUrl, player2Token);

    const gmMsgsPromise = gmWs.waitForMessages(9);
    const p1MsgsPromise = p1Ws.waitForMessages(4);
    const p2MsgsPromise = p2Ws.waitForMessages(3);

    p1Ws.send(
      JSON.stringify({
        protocolVersion: 1,
        commandId: "cmd-p1-pub",
        type: "test:command",
        payload: {
          eventType: "test:event:public",
          eventPayload: { data: "hello public" },
          visibility: { type: "public" },
        },
      })
    );

    gmWs.send(
      JSON.stringify({
        protocolVersion: 1,
        commandId: "cmd-gm-sec",
        type: "test:command",
        payload: {
          eventType: "test:event:secret",
          eventPayload: { data: "hello secret" },
          visibility: { type: "gmOnly" },
        },
      })
    );

    gmWs.send(
      JSON.stringify({
        protocolVersion: 1,
        commandId: "cmd-gm-sel-1",
        type: "test:command",
        payload: {
          eventType: "test:event:whisper1",
          eventPayload: { data: "hello p1" },
          visibility: { type: "selectedPcIds", pcIds: ["char-rt-1"] },
        },
      })
    );

    gmWs.send(
      JSON.stringify({
        protocolVersion: 1,
        commandId: "cmd-gm-sel-2",
        type: "test:command",
        payload: {
          eventType: "test:event:whisper2",
          eventPayload: { data: "hello p2" },
          visibility: { type: "selectedPcIds", pcIds: ["char-rt-2"] },
        },
      })
    );

    const gmMsgs = await gmMsgsPromise;
    const p1Msgs = await p1MsgsPromise;
    const p2Msgs = await p2MsgsPromise;

    expect(gmMsgs.some((m) => m.type === "test:event:public")).toBe(true);
    expect(gmMsgs.some((m) => m.type === "test:event:secret")).toBe(true);
    expect(gmMsgs.some((m) => m.type === "test:event:whisper1")).toBe(true);
    expect(gmMsgs.some((m) => m.type === "test:event:whisper2")).toBe(true);

    expect(p1Msgs.some((m) => m.type === "test:event:public")).toBe(true);
    expect(p1Msgs.some((m) => m.type === "test:event:secret")).toBe(false);
    expect(p1Msgs.some((m) => m.type === "test:event:whisper1")).toBe(true);
    expect(p1Msgs.some((m) => m.type === "test:event:whisper2")).toBe(false);

    expect(p2Msgs.some((m) => m.type === "test:event:public")).toBe(true);
    expect(p2Msgs.some((m) => m.type === "test:event:secret")).toBe(false);
    expect(p2Msgs.some((m) => m.type === "test:event:whisper1")).toBe(false);
    expect(p2Msgs.some((m) => m.type === "test:event:whisper2")).toBe(true);

    await closeWs(gmWs);
    await closeWs(p1Ws);
    await closeWs(p2Ws);
    await server.stop(true);
  });

  test("Command dedup by commandId", async () => {
    const server = listenTestApp(app);
    const port = server.server?.port;
    const wsUrl = `ws://localhost:${port}/api/v1/sessions/${sessionId}/ws`;

    const gmWs = await connectWs(wsUrl, gmToken);
    await gmWs.waitForMessages(1);

    const command = JSON.stringify({
      protocolVersion: 1,
      commandId: "cmd-dedup-1",
      type: "test:command",
      payload: { eventType: "test:event:dedup", eventPayload: { n: 1 } },
    });
    gmWs.send(command);
    gmWs.send(command);

    // snapshot + presence + reply×2（第二条为去重后的缓存回执）+ event×1
    await gmWs.waitForMessages(5);

    const replies = gmWs.messages.filter(
      (m) => m.type === "command:accepted" && m.commandId === "cmd-dedup-1"
    );
    expect(replies.length).toBe(2);
    const events = gmWs.messages.filter((m) => m.type === "test:event:dedup");
    expect(events.length).toBe(1);

    await closeWs(gmWs);
    await server.stop(true);
  });

  test("Outbox delivery status update", async () => {
    await container.sessionCommandExecutor.execute(
      sessionId,
      { type: "gm" },
      {
        protocolVersion: 1,
        commandId: crypto.randomUUID(),
        type: "test:command",
        payload: { eventType: "test:event:outbox", eventPayload: { ok: true } },
      },
      "test-outbox-connection"
    );
    const records = await container.db
      .select()
      .from(sessionOutbox)
      .where(eq(sessionOutbox.sessionId, sessionId))
      .execute();

    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(record.status).toBe("delivered");
      expect(JSON.parse(record.visibilityJson)).toHaveProperty("type");
    }
  });

  test("Reconnection recovery - ring buffer catch-up", async () => {
    const server = listenTestApp(app);
    const port = server.server?.port;
    const wsUrl = `ws://localhost:${port}/api/v1/sessions/${sessionId}/ws`;

    const gmWs = await connectWs(wsUrl, gmToken);
    const p1Ws = await connectWs(wsUrl, player1Token);

    const firstMessages = await p1Ws.waitForMessages(1);
    expect(firstMessages.length).toBe(1);
    expect(firstMessages[0].type).toBe("snapshot");

    const lastEventId = firstMessages[0].watermark;

    await closeWs(p1Ws);

    const gmCatchMsgsPromise = gmWs.waitForMessages(7);
    gmWs.send(
      JSON.stringify({
        protocolVersion: 1,
        commandId: "cmd-catch-1",
        type: "test:command",
        payload: {
          eventType: "event:missed:1",
          eventPayload: { seq: 1 },
          visibility: { type: "public" },
        },
      })
    );
    gmWs.send(
      JSON.stringify({
        protocolVersion: 1,
        commandId: "cmd-catch-2",
        type: "test:command",
        payload: {
          eventType: "event:missed:2",
          eventPayload: { seq: 2 },
          visibility: { type: "public" },
        },
      })
    );
    await gmCatchMsgsPromise;

    const reconnectedWs = await connectWs(`${wsUrl}?lastEventId=${lastEventId}`, player1Token);
    const recoveredMessages = await reconnectedWs.waitForMessages(2);

    expect(recoveredMessages.length).toBe(2);
    expect(recoveredMessages[0].type).toBe("event:missed:1");
    expect(recoveredMessages[1].type).toBe("event:missed:2");

    await closeWs(reconnectedWs);
    await closeWs(gmWs);
    await server.stop(true);
  });

  test("Reconnection recovery - full snapshot fallback", async () => {
    const server = listenTestApp(app);
    const port = server.server?.port;
    const wsUrl = `ws://localhost:${port}/api/v1/sessions/${sessionId}/ws`;

    const reconnectedWs = await connectWs(`${wsUrl}?lastEventId=999999`, player1Token);
    const recoveredMessages = await reconnectedWs.waitForMessages(1);
    expect(recoveredMessages.length).toBe(1);
    expect(recoveredMessages[0].type).toBe("snapshot");
    expect(recoveredMessages[0].watermark).toBeDefined();

    await closeWs(reconnectedWs);
    await server.stop(true);
  });
});
