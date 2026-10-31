import { Elysia } from "elysia";
import type { Container } from "@/bootstrap/container";
import { DrizzleIdentityRepository } from "../infrastructure/drizzle-identity-repository";
import { GmLoginUseCase } from "../application/gm-login";
import { GmLogoutUseCase } from "../application/gm-logout";
import { PlayerIdentityUseCase } from "../application/player-identity";
import { createAuthPlugin } from "./auth-middleware";
import { BanPlayerRequest, GmLoginRequest, UnbanFingerprintRequest, BlacklistEntryDto } from "@cogm/shared";
import { z } from "zod";
import { AppError } from "@/platform/errors/app-error";
import { validationFailed } from "@/platform/errors/validation";
import { AuthRequiredError } from "../domain/errors";
import { identityRateLimiter, loginRateLimiter } from "@/platform/security/http-limits";
import { clientIp } from "@/platform/security/request-ip";
import { assertTrustedOrigin } from "@/platform/security/origin";
import { corsOriginsFor } from "@/config/env";
import { logger } from "@/platform/logging/logger";
import { DrizzleModerationRepository, PlayerNotFoundError } from "@/modules/moderation";

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
  const moderationRepo = new DrizzleModerationRepository(container.db);
  const gmLoginUseCase = new GmLoginUseCase(
    container.idGenerator,
    container.clock,
    repo
  );
  const gmLogoutUseCase = new GmLogoutUseCase(container.clock, repo);
  const playerIdentityUseCase = new PlayerIdentityUseCase(
    container.idGenerator,
    container.clock,
    repo
  );

  const authPlugin = createAuthPlugin(repo);
  const allowedOrigins = corsOriginsFor(container.env);

  return new Elysia()
    .use(authPlugin)
    .post("/api/v1/gm/auth/login", async ({ body, cookie, request, server }) => {
      assertTrustedOrigin(request, allowedOrigins);
      loginRateLimiter.assert(clientIp(request, server, container.env.TRUST_PROXY));

      const parsed = GmLoginRequest.safeParse(body);
      if (!parsed.success) {
        throw validationFailed(parsed.error);
      }

      let result;
      try {
        result = await gmLoginUseCase.execute(parsed.data.password);
      } catch (err) {
        logger.audit("gm.login.failed", { ip: clientIp(request, server, container.env.TRUST_PROXY) });
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

      logger.audit("gm.login.ok");
      return {
        ...(container.env.NODE_ENV === "production" ? {} : { sessionToken: result.sessionToken }),
        expiresAt: result.expiresAt,
      };
    })
    .post("/api/v1/gm/auth/logout", async ({ actor, request, cookie }) => {
      assertTrustedOrigin(request, allowedOrigins);
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
      logger.audit("gm.logout");
      return { success: true };
    })
    .get("/api/v1/gm/auth/me", ({ actor }) => {
      if (!actor || actor.type !== "gm") {
        throw new AuthRequiredError();
      }
      return { type: "gm" as const };
    })
    .get("/api/v1/gm/blacklist", async ({ actor }) => {
      if (!actor || actor.type !== "gm") {
        throw new AuthRequiredError();
      }
      return z.array(BlacklistEntryDto).parse(await repo.listBlacklistEntries());
    })
    .post("/api/v1/gm/blacklist", async ({ actor, body, request }) => {
      assertTrustedOrigin(request, allowedOrigins);
      if (!actor || actor.type !== "gm") {
        throw new AuthRequiredError();
      }
      const parsed = BanPlayerRequest.safeParse(body);
      if (!parsed.success) {
        throw validationFailed(parsed.error);
      }
      const fingerprintHash = await moderationRepo.findPlayerFingerprintHash(parsed.data.playerId);
      if (!fingerprintHash) {
        throw new PlayerNotFoundError();
      }
      const now = container.clock.nowEpochMs();
      const expiresAt = parsed.data.durationSeconds ? now + parsed.data.durationSeconds * 1000 : null;
      await moderationRepo.upsertBlacklistEntry({
        id: container.idGenerator.nextId(),
        fingerprintHash,
        reason: parsed.data.reason,
        expiresAt,
        createdAt: now,
      });
      container.connectionRegistry.closePlayerConnections(parsed.data.playerId);
      logger.audit("gm.blacklist.ban", { playerId: parsed.data.playerId });
      return { banned: parsed.data.playerId, permanent: expiresAt === null, fingerprintHash };
    })
    .post("/api/v1/gm/blacklist/unban", async ({ actor, body, request }) => {
      assertTrustedOrigin(request, allowedOrigins);
      if (!actor || actor.type !== "gm") {
        throw new AuthRequiredError();
      }
      const parsed = UnbanFingerprintRequest.safeParse(body);
      if (!parsed.success) {
        throw validationFailed(parsed.error);
      }
      const removed = await moderationRepo.deleteBlacklistEntry(parsed.data.fingerprintHash);
      logger.audit("gm.blacklist.unban", { fingerprintHash: parsed.data.fingerprintHash, removed });
      return { removed };
    })
    .post("/api/v1/player/identity", async ({ body, cookie, request, server }) => {
      assertTrustedOrigin(request, allowedOrigins);
      identityRateLimiter.assert(clientIp(request, server, container.env.TRUST_PROXY));

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
        ...(container.env.NODE_ENV === "production" ? {} : { token: result.token }),
      };
    });
}
