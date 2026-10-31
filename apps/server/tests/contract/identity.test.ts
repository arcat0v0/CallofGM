import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { Elysia } from "elysia";
import { Container } from "@/bootstrap/container";
import { createIdentityRoutes } from "@/modules/identity/transport/routes";
import { AppError } from "@/platform/errors/app-error";
import { blacklistEntries } from "@/platform/db/schema";
import { createHash } from "crypto";
import { seedGmPassword } from "../helpers/setup";

describe("Identity and Auth contract tests", () => {
  let container: Container;
  let app: any;
  const gmPassword = "test-gm-password";

  beforeAll(async () => {
    process.env.DATABASE_URL = ":memory:";
    container = new Container();
    await container.startupService.startup();
    await seedGmPassword(container.db, gmPassword);

    app = new Elysia()
      .onError(({ error, code, set }) => {
        if (error instanceof AppError) {
          set.status = error.statusCode;
          return {
            code: error.code,
            message: error.message,
            metadata: error.metadata,
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
      .use(createIdentityRoutes(container));
  });

  afterAll(() => {
    container.dbContext.sqlite.close();
  });

  test("GM Login - Success", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/v1/gm/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "gm", password: gmPassword }),
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.sessionToken).toBeDefined();
    expect(body.expiresAt).toBeDefined();

    const cookie = response.headers.get("Set-Cookie");
    expect(cookie).toContain("gm_session=");
  });

  test("GM Login - Wrong Password", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/v1/gm/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "gm", password: "wrong-password" }),
      })
    );
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe("INVALID_CREDENTIALS");
  });

  test("GM Login - Validation Failure", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/v1/gm/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "", password: "" }),
      })
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_FAILED");
  });

  test("GM Logout - Revoke Session", async () => {
    const loginRes = await app.handle(
      new Request("http://localhost/api/v1/gm/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "gm", password: gmPassword }),
      })
    );
    const { sessionToken } = await loginRes.json();

    const logoutRes = await app.handle(
      new Request("http://localhost/api/v1/gm/auth/logout", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${sessionToken}`,
        },
      })
    );
    expect(logoutRes.status).toBe(200);
    const logoutBody = await logoutRes.json();
    expect(logoutBody.success).toBe(true);

    const logoutRes2 = await app.handle(
      new Request("http://localhost/api/v1/gm/auth/logout", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${sessionToken}`,
        },
      })
    );
    expect(logoutRes2.status).toBe(401);
    const logoutBody2 = await logoutRes2.json();
    expect(logoutBody2.code).toBe("AUTH_REQUIRED");
  });

  test("Player Identity - Create and Recover", async () => {
    const fingerprint = "fingerprint-xyz";
    const response = await app.handle(
      new Request("http://localhost/api/v1/player/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint }),
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.playerId).toBeDefined();
    expect(body.token).toBeDefined();

    const playerId = body.playerId;
    const token = body.token;

    const response2 = await app.handle(
      new Request("http://localhost/api/v1/player/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint }),
      })
    );
    expect(response2.status).toBe(200);
    const body2 = await response2.json();
    expect(body2.playerId).toBe(playerId);

    const response3 = await app.handle(
      new Request("http://localhost/api/v1/player/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint, token }),
      })
    );
    expect(response3.status).toBe(200);
    const body3 = await response3.json();
    expect(body3.playerId).toBe(playerId);
  });

  test("Player Identity - Blacklist Rejection", async () => {
    const blacklistedFingerprint = "banned-device";
    const bHash = createHash("sha256").update(blacklistedFingerprint).digest("hex");

    await container.db.insert(blacklistEntries).values({
      id: "ban-1",
      fingerprintHash: bHash,
      reason: "Malicious activity",
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      createdAt: Date.now(),
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/player/identity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Fingerprint": blacklistedFingerprint,
        },
        body: JSON.stringify({ fingerprint: blacklistedFingerprint }),
      })
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("BLACKLISTED_FINGERPRINT");
  });

  test("clientIp prefers forwarded header only when trustProxy is true", async () => {
    const { clientIp } = await import("@/platform/security/request-ip");
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.195, 10.0.0.1" },
    });
    const fakeServer = {
      requestIP: () => ({ address: "172.18.0.2" }),
    };

    expect(clientIp(req, fakeServer, true)).toBe("203.0.113.195");
    expect(clientIp(req, fakeServer, false)).toBe("172.18.0.2");
  });
});
