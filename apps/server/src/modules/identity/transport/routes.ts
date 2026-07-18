import { Elysia } from "elysia";
import type { Container } from "@/bootstrap/container";
import { DrizzleIdentityRepository } from "../infrastructure/drizzle-identity-repository";
import { HmacTokenSigner } from "../application/player-identity";
import { GmLoginUseCase } from "../application/gm-login";
import { GmLogoutUseCase } from "../application/gm-logout";
import { PlayerIdentityUseCase } from "../application/player-identity";
import { createAuthPlugin } from "./auth-middleware";
import { GmLoginRequest } from "@cogm/shared";
import { AppError } from "@/platform/errors/app-error";
import { RateLimiter } from "@/platform/security/rate-limiter";
import { AuthRequiredError } from "../domain/errors";

function parseCookie(cookieHeader: string, name: string): string | null {
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const splitIndex = pair.indexOf("=");
    if (splitIndex === -1) {
      continue;
    }
    const key = pair.substring(0, splitIndex).trim();
    const val = pair.substring(splitIndex + 1).trim();
    if (key === name) {
      return decodeURIComponent(val);
    }
  }
  return null;
}

export function createIdentityRoutes(container: Container) {
  const repo = new DrizzleIdentityRepository(container.db);
  const tokenSigner = container.playerTokenSigner;
  const gmLoginUseCase = new GmLoginUseCase(
    container.idGenerator,
    container.clock,
    repo,
    container.env.GM_PASSWORD_HASH
  );
  const gmLogoutUseCase = new GmLogoutUseCase(container.clock, repo);
  const playerIdentityUseCase = new PlayerIdentityUseCase(
    container.idGenerator,
    container.clock,
    repo,
    tokenSigner
  );

  const authPlugin = createAuthPlugin(repo, tokenSigner);
  // 登录限速：每 IP 每分钟最多 10 次尝试，失败计入审计日志
  const loginRateLimiter = new RateLimiter(10, 60_000);

  return new Elysia()
    .use(authPlugin)
    .post("/api/v1/gm/auth/login", async ({ body, cookie, request, server }) => {
      const clientIp =
        server?.requestIP(request)?.address ??
        request.headers.get("x-forwarded-for") ??
        "unknown";
      loginRateLimiter.assert(clientIp);

      let parsed;
      try {
        parsed = GmLoginRequest.parse(body);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Validation failed";
        throw new AppError("VALIDATION_FAILED", message, 400);
      }

      let result;
      try {
        result = await gmLoginUseCase.execute(parsed.password);
      } catch (err) {
        // 登录失败审计：不泄露密码是否正确等内部信息，仅记录来源
        console.log(`[Audit] GM login failed from ${clientIp}`);
        throw err;
      }

      const gmSessionCookie = cookie?.gm_session;
      if (gmSessionCookie) {
        gmSessionCookie.set({
          value: result.sessionToken,
          httpOnly: true,
          secure: container.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/",
          expires: new Date(result.expiresAt),
        });
      }

      return {
        ...(container.env.NODE_ENV === "production" ? {} : { sessionToken: result.sessionToken }),
        expiresAt: result.expiresAt,
      };
    })
    .post("/api/v1/gm/auth/logout", async ({ actor, request, cookie }) => {
      if (!actor || actor.type !== "gm") {
        throw new AuthRequiredError();
      }

      let token: string | null = null;
      const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      } else {
        const cookieHeader = request.headers.get("cookie") || "";
        const gmCookieVal = cookie?.gm_session?.value;
        token = typeof gmCookieVal === "string" ? gmCookieVal : parseCookie(cookieHeader, "gm_session");
      }

      if (!token) {
        throw new AuthRequiredError();
      }

      await gmLogoutUseCase.execute(token);

      cookie?.gm_session?.remove();

      return { success: true };
    })
    .get("/api/v1/gm/blacklist", async ({ actor }) => {
      if (!actor || actor.type !== "gm") {
        throw new AuthRequiredError();
      }
      return await repo.listBlacklistEntries();
    })
    .post("/api/v1/player/identity", async ({ body, cookie }) => {
      const payload = body as Record<string, unknown> | null;
      const fingerprint = payload?.fingerprint;
      const token = payload?.token;

      if (typeof fingerprint !== "string" || fingerprint.trim() === "") {
        throw new AppError("VALIDATION_FAILED", "Fingerprint is required", 400);
      }
      if (token !== undefined && typeof token !== "string") {
        throw new AppError("VALIDATION_FAILED", "Token must be a string", 400);
      }

      const result = await playerIdentityUseCase.execute(fingerprint, token);

      const playerTokenCookie = cookie?.player_token;
      if (playerTokenCookie) {
        playerTokenCookie.set({
          value: result.token,
          httpOnly: true,
          secure: container.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/",
          expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
      }

      return {
        playerId: result.playerId,
        token: result.token,
      };
    });
}
