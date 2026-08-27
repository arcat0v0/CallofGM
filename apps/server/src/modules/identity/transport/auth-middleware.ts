import { Elysia } from "elysia";
import { createHash } from "crypto";
import type { ActorContext } from "../domain/actor";
import type { IdentityRepository } from "../application/ports";
import { hashToken } from "../application/token";
import { BlacklistedFingerprintError } from "../domain/errors";

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

function readFingerprint(request: Request): string | null {
  return (
    request.headers.get("x-fingerprint") ||
    request.headers.get("X-Fingerprint") ||
    new URL(request.url).searchParams.get("fingerprint")
  );
}

export function createAuthPlugin(repo: IdentityRepository) {
  return new Elysia({ name: "identity-auth" })
    .derive({ as: "global" }, async ({ request, cookie }): Promise<{ actor: ActorContext | null }> => {
      const fingerprint = readFingerprint(request);
      if (fingerprint) {
        const fingerprintHash = createHash("sha256").update(fingerprint).digest("hex");
        const isBlacklisted = await repo.isFingerprintBlacklisted(fingerprintHash);
        if (isBlacklisted) {
          throw new BlacklistedFingerprintError();
        }
      }

      let token: string | null = null;
      const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      } else {
        const cookieHeader = request.headers.get("cookie") || "";
        const gmCookieVal = cookie?.gm_session?.value;
        const playerCookieVal = cookie?.player_token?.value;
        const gmCookie = typeof gmCookieVal === "string" ? gmCookieVal : parseCookie(cookieHeader, "gm_session");
        const playerCookie = typeof playerCookieVal === "string" ? playerCookieVal : parseCookie(cookieHeader, "player_token");
        token = gmCookie || playerCookie;
      }

      if (!token) {
        return { actor: null };
      }

      const tokenHash = hashToken(token);
      const now = Date.now();

      const gmSession = await repo.findGmSessionByTokenHash(tokenHash);
      if (gmSession && gmSession.revokedAt === null && gmSession.expiresAt > now) {
        return { actor: { type: "gm", loginSessionId: gmSession.id } };
      }

      const playerToken = await repo.findPlayerTokenByTokenHash(tokenHash);
      if (playerToken && playerToken.revokedAt === null && playerToken.expiresAt > now) {
        const player = await repo.findAnonymousPlayerById(playerToken.playerId);
        if (!player || (await repo.isFingerprintBlacklisted(player.fingerprintHash))) {
          throw new BlacklistedFingerprintError();
        }
        return { actor: { type: "player", playerId: playerToken.playerId } };
      }

      return { actor: null };
    });
}
