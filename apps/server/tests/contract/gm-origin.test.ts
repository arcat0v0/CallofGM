import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { Elysia } from "elysia";
import { Container } from "@/bootstrap/container";
import { createIdentityRoutes } from "@/modules/identity/transport/routes";
import { createCatalogRoutes } from "@/modules/catalog/transport/routes";
import { createMediaRoutes } from "@/modules/media";
import { AppError } from "@/platform/errors/app-error";
import { seedGmPassword } from "../helpers/setup";

type TestApp = { handle(request: Request): Promise<Response> };

describe("GM write endpoints reject untrusted origins", () => {
  let container: Container;
  let app: TestApp;
  const gmPassword = "origin-guard-password";
  const trusted = "http://localhost:15632";
  const evil = "http://evil.example";

  beforeAll(async () => {
    process.env.DATABASE_URL = ":memory:";
    container = new Container();
    await container.startupService.startup();
    await seedGmPassword(container.db, gmPassword);

    app = new Elysia()
      .onError(({ error, set }) => {
        if (error instanceof AppError) {
          set.status = error.statusCode;
          return { code: error.code, message: error.message };
        }
      })
      .use(createIdentityRoutes(container))
      .use(createCatalogRoutes(container))
      .use(createMediaRoutes(container));
  });

  afterAll(() => {
    container.dbContext.sqlite.close();
  });

  function createModule(origin: string | null, referer?: string) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${gmToken}`,
    };
    if (origin) {
      headers.origin = origin;
    }
    if (referer) {
      headers.referer = referer;
    }
    return app.handle(
      new Request("http://localhost/api/v1/gm/modules", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "Origin Probe", description: "", ruleId: "coc7e" }),
      })
    );
  }

  let gmToken = "";

  beforeAll(async () => {
    const login = await app.handle(
      new Request("http://localhost/api/v1/gm/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "gm", password: gmPassword }),
      })
    );
    const body = (await login.json()) as { sessionToken: string };
    gmToken = body.sessionToken;
  });

  test("cross-origin GM write is rejected", async () => {
    const response = await createModule(evil);
    expect(response.status).toBe(403);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("FORBIDDEN");
  });

  test("same-origin GM write is accepted", async () => {
    const response = await createModule(trusted);
    expect(response.status).toBe(200);
  });

  test("cross-site Referer without Origin is rejected", async () => {
    const response = await createModule(null, `${evil}/attack.html`);
    expect(response.status).toBe(403);
  });

  test("GET is unaffected by origin checks", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/v1/gm/modules", {
        headers: { origin: evil, Authorization: `Bearer ${gmToken}` },
      })
    );
    expect(response.status).toBe(200);
  });

  test("cross-origin blacklist write is rejected", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/v1/gm/blacklist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmToken}`,
          origin: evil,
        },
        body: JSON.stringify({ playerId: "someone" }),
      })
    );
    expect(response.status).toBe(403);
  });

  test("cross-origin media upload is rejected", async () => {
    const form = new FormData();
    form.set("file", new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }), "x.png");
    form.set("purpose", "portrait");
    const response = await app.handle(
      new Request("http://localhost/api/v1/media/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${gmToken}`, origin: evil },
        body: form,
      })
    );
    expect(response.status).toBe(403);
  });

  test("non-browser writes without Origin or Referer still work", async () => {
    const response = await createModule(null);
    expect(response.status).toBe(200);
  });
});
