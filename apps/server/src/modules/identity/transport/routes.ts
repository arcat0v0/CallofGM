import { Elysia } from "elysia";
import type { Container } from "@/bootstrap/container";
import { DrizzleIdentityRepository } from "../infrastructure/drizzle-identity-repository";
import { PlayerIdentityUseCase } from "../application/player-identity";
import { LoginUseCase, LogoutUseCase, ChangeOwnPasswordUseCase } from "../application/user-accounts";
import { createAuthPlugin, SESSION_COOKIE, PLAYER_COOKIE, readBearer, readCookie } from "./auth-middleware";
import { ChangePasswordRequest, LoginRequest } from "@cogm/shared";
import { AppError } from "@/platform/errors/app-error";
import { validationFailed } from "@/platform/errors/validation";
import { AuthRequiredError } from "../domain/errors";
import { clientIp } from "@/platform/security/request-ip";
import { assertTrustedOrigin } from "@/platform/security/origin";
import { corsOriginsFor } from "@/config/env";
import { logger } from "@/platform/logging/logger";

export function createIdentityRoutes(container: Container) {
  const repo = new DrizzleIdentityRepository(container.db);
  const loginUseCase = new LoginUseCase(container.idGenerator, container.clock, repo);
  const logoutUseCase = new LogoutUseCase(container.clock, repo);
  const changePasswordUseCase = new ChangeOwnPasswordUseCase(container.clock, repo);
  const playerIdentityUseCase = new PlayerIdentityUseCase(container.idGenerator, container.clock, repo);

  const authPlugin = createAuthPlugin(repo);
  const allowedOrigins = corsOriginsFor(container.env);

  return new Elysia()
    .use(authPlugin)
    .post("/api/v1/auth/login", async ({ body, cookie, request, server }) => {
      assertTrustedOrigin(request, allowedOrigins);
      container.httpLimits.loginRateLimiter.assert(clientIp(request, server, container.env.TRUST_PROXY));

      const parsed = LoginRequest.safeParse(body);
      if (!parsed.success) {
        throw validationFailed(parsed.error);
      }

      let result;
      try {
        result = await loginUseCase.execute(parsed.data.username, parsed.data.password);
      } catch (err) {
        logger.audit("auth.login.failed", { ip: clientIp(request, server, container.env.TRUST_PROXY) });
        throw err;
      }

      for (const replacedId of result.replacedSessionIds) {
        container.connectionRegistry.closeLoginSessionConnections(replacedId);
      }
      container.connectionRegistry.closeUserConnections(result.user.id, undefined, 401, "session replaced");

      cookie?.[SESSION_COOKIE]?.set({
        value: result.sessionToken,
        httpOnly: true,
        secure: container.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        expires: new Date(result.expiresAt),
      });

      logger.audit("auth.login.ok", { role: result.user.role });
      return {
        ...(container.env.NODE_ENV === "production" ? {} : { sessionToken: result.sessionToken }),
        userId: result.user.id,
        username: result.user.username,
        role: result.user.role,
        expiresAt: result.expiresAt,
      };
    })
    .post("/api/v1/auth/logout", async ({ actor, request, cookie }) => {
      assertTrustedOrigin(request, allowedOrigins);
      if (!actor || actor.type !== "user") {
        throw new AuthRequiredError();
      }
      await logoutUseCase.execute(actor.loginSessionId);
      cookie?.[SESSION_COOKIE]?.remove();
      logger.audit("auth.logout");
      return { success: true };
    })
    .get("/api/v1/auth/me", ({ actor }) => {
      if (!actor || actor.type !== "user") {
        throw new AuthRequiredError();
      }
      return { type: "user" as const, userId: actor.userId, username: actor.username, role: actor.role };
    })
    .put("/api/v1/auth/password", async ({ actor, body, request, cookie }) => {
      assertTrustedOrigin(request, allowedOrigins);
      if (!actor || actor.type !== "user") {
        throw new AuthRequiredError();
      }
      const parsed = ChangePasswordRequest.safeParse(body);
      if (!parsed.success) {
        throw validationFailed(parsed.error);
      }
      await changePasswordUseCase.execute({
        userId: actor.userId,
        currentSessionId: actor.loginSessionId,
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      });
      logger.audit("auth.password.changed", { userId: actor.userId });
      void cookie;
      return { success: true };
    })
    .get("/api/v1/player/me", ({ actor }) => {
      if (!actor || actor.type !== "player") {
        throw new AuthRequiredError();
      }
      return { playerId: actor.playerId };
    })
    .post("/api/v1/player/identity", async ({ body, cookie, request, server }) => {
      assertTrustedOrigin(request, allowedOrigins);
      container.httpLimits.identityRateLimiter.assert(clientIp(request, server, container.env.TRUST_PROXY));

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

      cookie?.[PLAYER_COOKIE]?.set({
        value: result.token,
        httpOnly: true,
        secure: container.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      return {
        playerId: result.playerId,
        ...(container.env.NODE_ENV === "production" ? {} : { token: result.token }),
      };
    });
}

export { readBearer, readCookie };
