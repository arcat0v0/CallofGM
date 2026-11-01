import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { eq } from "drizzle-orm";
import { setupTestApp, stopServer, type TestContext } from "../helpers/setup";
import type { CreateSessionResponse, JoinInfoResponse, SessionDto } from "@cogm/shared";
import { sessions } from "@/platform/db/schema";

describe("Session naming contract tests", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestApp({ players: ["p1"] });
  });

  afterAll(() => {
    ctx.container.dbContext.sqlite.close();
  });

  function request(path: string, init: { method?: string; token?: string; body?: unknown } = {}) {
    const headers: Record<string, string> = {};
    if (init.token) headers.Authorization = `Bearer ${init.token}`;
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    return ctx.app.handle(
      new Request(`http://localhost${path}`, {
        method: init.method ?? "GET",
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      })
    );
  }

  async function createSession(body: unknown) {
    const response = await request("/api/v1/gm/sessions", {
      method: "POST",
      token: ctx.gmToken,
      body,
    });
    return { status: response.status, body: (await response.json()) as CreateSessionResponse };
  }

  test("创建团时可命名，列表与入团信息回传团名", async () => {
    const created = await createSession({ moduleId: "module-test", characterIds: [], name: "灯塔之夜" });
    expect(created.status).toBe(200);
    expect(created.body.session.name).toBe("灯塔之夜");
    const sessionId = created.body.session.id as string;

    const listRes = await request("/api/v1/gm/sessions", { token: ctx.gmToken });
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as { items: SessionDto[] };
    expect(list.items.find((item) => item.id === sessionId)?.name).toBe("灯塔之夜");
    expect(list.items.find((item) => item.id === ctx.sessionId)?.name).toBeNull();

    const joinRes = await request(`/api/v1/public/sessions/${sessionId}/join-info`);
    expect(joinRes.status).toBe(200);
    const join = (await joinRes.json()) as JoinInfoResponse;
    expect(join.session.name).toBe("灯塔之夜");
  });

  test("未命名的团回退为 null，GM 可重命名与清空", async () => {
    const created = await createSession({ moduleId: "module-test", characterIds: [] });
    expect(created.body.session.name).toBeNull();
    const sessionId = created.body.session.id as string;

    const renamed = await request(`/api/v1/gm/sessions/${sessionId}/name`, {
      method: "POST",
      token: ctx.gmToken,
      body: { name: "  第二场  " },
    });
    expect(renamed.status).toBe(200);
    expect(((await renamed.json()) as SessionDto).name).toBe("第二场");

    const joinRes = await request(`/api/v1/public/sessions/${sessionId}/join-info`);
    expect(((await joinRes.json()) as JoinInfoResponse).session.name).toBe("第二场");

    const cleared = await request(`/api/v1/gm/sessions/${sessionId}/name`, {
      method: "POST",
      token: ctx.gmToken,
      body: { name: null },
    });
    expect(cleared.status).toBe(200);
    expect(((await cleared.json()) as SessionDto).name).toBeNull();

    const rows = await ctx.container.db.select().from(sessions).where(eq(sessions.id, sessionId));
    expect(rows[0]?.name).toBeNull();
  });

  test("重命名权限与校验：玩家不可改名，超长名与未知团被拒", async () => {
    const created = await createSession({ moduleId: "module-test", characterIds: [] });
    const sessionId = created.body.session.id as string;

    const playerRes = await request(`/api/v1/gm/sessions/${sessionId}/name`, {
      method: "POST",
      token: ctx.playerTokens.get("p1")!,
      body: { name: "玩家改名" },
    });
    expect(playerRes.status).toBe(401);

    const tooLong = await request(`/api/v1/gm/sessions/${sessionId}/name`, {
      method: "POST",
      token: ctx.gmToken,
      body: { name: "名".repeat(61) },
    });
    expect(tooLong.status).toBe(400);

    const missing = await request("/api/v1/gm/sessions/session-does-not-exist/name", {
      method: "POST",
      token: ctx.gmToken,
      body: { name: "幽灵团" },
    });
    expect(missing.status).toBe(404);
  });
});