import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { Elysia } from "elysia";
import { Container } from "@/bootstrap/container";
import { createApp } from "@/app";
import { createIdentityRoutes } from "@/modules/identity/transport/routes";
import { RateLimiter } from "@/platform/security/rate-limiter";
import { HttpLimits } from "@/platform/security/http-limits";
import { AppError } from "@/platform/errors/app-error";
import { seedGmPassword } from "../helpers/setup";

function buildApp(container: Container) {
  return new Elysia()
    .onError(({ error, set }) => {
      if (error instanceof AppError) {
        set.status = error.statusCode;
        return { code: error.code, message: error.message };
      }
    })
    .use(createIdentityRoutes(container));
}

function login(app: { handle(request: Request): Promise<Response> }, password: string) {
  return app.handle(
    new Request("http://localhost/api/v1/gm/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "gm", password }),
    })
  );
}

describe("HTTP rate limits", () => {
  let limitedContainer: Container;
  let isolatedContainer: Container;
  const gmPassword = "rate-limit-password";

  beforeAll(async () => {
    process.env.DATABASE_URL = ":memory:";
    limitedContainer = new Container();
    isolatedContainer = new Container();
    await limitedContainer.startupService.startup();
    await isolatedContainer.startupService.startup();
    await seedGmPassword(limitedContainer.db, gmPassword);
    await seedGmPassword(isolatedContainer.db, gmPassword);
  });

  afterAll(() => {
    limitedContainer.dbContext.sqlite.close();
    isolatedContainer.dbContext.sqlite.close();
  });

  test("login limiter rejects the 11th request with 429 RATE_LIMITED", async () => {
    const app = buildApp(limitedContainer);
    for (let i = 0; i < 10; i++) {
      const response = await login(app, gmPassword);
      expect(response.status).toBe(200);
    }
    const blocked = await login(app, gmPassword);
    expect(blocked.status).toBe(429);
    const body = (await blocked.json()) as { code: string };
    expect(body.code).toBe("RATE_LIMITED");
  });

  test("a separate container keeps its own limiter budget", async () => {
    const app = buildApp(isolatedContainer);
    const response = await login(app, gmPassword);
    expect(response.status).toBe(200);
  });

  test("identity 429 responses carry Retry-After and stay Chinese-copy friendly", async () => {
    process.env.DATABASE_URL = ":memory:";
    const bounded = new Container([], {
      httpLimits: new HttpLimits({ identity: new RateLimiter(1, 60_000) }),
    });
    await bounded.startupService.startup();
    try {
      const app = createApp(bounded);
      const identify = () =>
        app.handle(
          new Request("http://localhost/api/v1/player/identity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fingerprint: "retry-after-fp" }),
          })
        );
      expect((await identify()).status).toBe(200);
      const blocked = await identify();
      expect(blocked.status).toBe(429);
      const retryAfter = Number(blocked.headers.get("Retry-After"));
      expect(Number.isInteger(retryAfter)).toBe(true);
      expect(retryAfter).toBeGreaterThanOrEqual(1);
      expect(retryAfter).toBeLessThanOrEqual(60);
      const body = (await blocked.json()) as { code: string; metadata: { retryAfterSeconds: number } };
      expect(body.code).toBe("RATE_LIMITED");
      expect(body.metadata.retryAfterSeconds).toBe(retryAfter);
    } finally {
      bounded.dbContext.sqlite.close();
    }
  });

  test("the default identity budget is 60 requests per minute per IP", () => {
    const limiter = new HttpLimits().identityRateLimiter;
    for (let i = 0; i < 60; i++) {
      expect(limiter.check("198.51.100.7")).toBe(true);
    }
    expect(limiter.check("198.51.100.7")).toBe(false);
    expect(limiter.check("198.51.100.8")).toBe(true);
  });
});
