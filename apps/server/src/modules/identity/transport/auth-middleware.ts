import { Elysia } from "elysia";
import { createHash } from "crypto";
import type { ActorContext } from "../domain/actor";
import type { IdentityRepository } from "../application/ports";
import { hashToken } from "../application/token";
import { BlacklistedFingerprintError } from "../domain/errors";

export const SESSION_COOKIE = "cogm_session";
export const PLAYER_COOKIE = "player_token";

export function parseCookie(cookieHeader: string, name: string): string | null {
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

export function readBearer(request: Request): string | null {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  return authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
}

export function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie") || "";
  return parseCookie(cookieHeader, name);
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
    .derive({ as: "global" }, async ({ request }): Promise<{ actor: ActorContext | null }> => {
      const now = Date.now();
      const sessionToken = readBearer(request) ?? readCookie(request, SESSION_COOKIE);

      if (sessionToken) {
        const session = await repo.findUserSessionByTokenHash(hashToken(sessionToken));
        if (session && session.revokedAt === null && session.expiresAt > now) {
          const user = await repo.findUserById(session.userId);
          if (user && user.disabledAt === null && user.deletedAt === null) {
            return {
              actor: {
                type: "user",
                userId: user.id,
                role: user.role,
                loginSessionId: session.id,
                username: user.username,
              },
            };
          }
        }
      }

      const fingerprint = readFingerprint(request);
      if (fingerprint) {
        const fingerprintHash = createHash("sha256").update(fingerprint).digest("hex");
        if (await repo.isFingerprintBlacklisted(fingerprintHash)) {
          throw new BlacklistedFingerprintError();
        }
      }

      const playerToken = readBearer(request) ?? readCookie(request, PLAYER_COOKIE);
      if (!playerToken) {
        return { actor: null };
      }

      const record = await repo.findPlayerTokenByTokenHash(hashToken(playerToken));
      if (record && record.revokedAt === null && record.expiresAt > now) {
        const player = await repo.findAnonymousPlayerById(record.playerId);
        if (!player || (await repo.isFingerprintBlacklisted(player.fingerprintHash))) {
          throw new BlacklistedFingerprintError();
        }
        return { actor: { type: "player", playerId: record.playerId } };
      }

      return { actor: null };
    });
}
