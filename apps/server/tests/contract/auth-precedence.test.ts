import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { Elysia } from "elysia";
import { createHash } from "crypto";
import { Container } from "@/bootstrap/container";
import { createIdentityRoutes } from "@/modules/identity/transport/routes";
import { createCatalogRoutes } from "@/modules/catalog/transport/routes";
import { AppError } from "@/platform/errors/app-error";
import { blacklistEntries } from "@/platform/db/schema";
import { seedGmPassword } from "../helpers/setup";

describe("GM session takes precedence over fingerprint blacklist", () => {
  let container: Container;
  let app: { handle(request: Request): Promise<Response> };
  const gmPassword = "gm-precedence-password";
  const bannedFingerprint = "banned-device-fp";
  let gmCookie = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = ":memory:";
    container = new Container();
    await container.startupService.startup();
    await seedGmPassword(container.db, gmPassword);

    await container.db.insert(blacklistEntries).values({
      id: "ban-gm-device",
      fingerprintHash: createHash("sha256").update(bannedFingerprint).digest("hex"),
      reason: "banned player device",
      expiresAt: null,
      createdAt: Date.now(),
    });

    app = new Elysia()
      .onError(({ error, set }) => {
        if (error instanceof AppError) {
          set.status = error.statusCode;
          return { code: error.code, message: error.message };
        }
      })
      .use(createIdentityRoutes(container))
      .use(createCatalogRoutes(container));

    const login = await app.handle(
      new Request("http://localhost/api/v1/gm/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "gm", password: gmPassword }),
      })
    );
    expect(login.status).toBe(200);
    const setCookie = login.headers.get("set-cookie") ?? "";
    gmCookie = setCookie.split(";")[0] ?? "";
  });

  afterAll(() => {
    container.dbContext.sqlite.close();
  });

  test("GM cookie plus banned fingerprint is allowed on /gm routes", async () => {
    const me = await app.handle(
      new Request("http://localhost/api/v1/gm/auth/me", {
        headers: { cookie: gmCookie, "x-fingerprint": bannedFingerprint },
      })
    );
    expect(me.status).toBe(200);

    const modules = await app.handle(
      new Request("http://localhost/api/v1/gm/modules", {
        headers: { cookie: gmCookie, "x-fingerprint": bannedFingerprint },
      })
    );
    expect(modules.status).toBe(200);
  });

  test("player identity path still enforces the fingerprint blacklist", async () => {
    const identity = await app.handle(
      new Request("http://localhost/api/v1/player/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-fingerprint": bannedFingerprint },
        body: JSON.stringify({ fingerprint: bannedFingerprint }),
      })
    );
    expect(identity.status).toBe(403);
    const body = (await identity.json()) as { code: string };
    expect(body.code).toBe("BLACKLISTED_FINGERPRINT");
  });

  test("banned fingerprint without a GM cookie is still rejected", async () => {
    const me = await app.handle(
      new Request("http://localhost/api/v1/gm/auth/me", {
        headers: { "x-fingerprint": bannedFingerprint },
      })
    );
    expect(me.status).toBe(403);
  });
});
