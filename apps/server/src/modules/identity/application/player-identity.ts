import { createHash, createHmac, timingSafeEqual } from "crypto";
import type { Clock, IdGenerator } from "@/platform/ports";
import type { IdentityRepository, TokenSigner, AnonymousPlayer, PlayerToken } from "./ports";
import { BlacklistedFingerprintError, InvalidTokenError } from "../domain/errors";

export class HmacTokenSigner implements TokenSigner {
  constructor(private readonly secret: string) {}

  sign(playerId: string, expiresAt: number): string {
    const payload = `${playerId}:${expiresAt}`;
    const signature = createHmac("sha256", this.secret).update(payload).digest("base64url");
    return `${payload}.${signature}`;
  }

  verify(token: string): { playerId: string; expiresAt: number } | null {
    const dotIndex = token.lastIndexOf(".");
    if (dotIndex === -1) {
      return null;
    }
    const payloadStr = token.substring(0, dotIndex);
    const sigStr = token.substring(dotIndex + 1);

    const expectedSig = createHmac("sha256", this.secret).update(payloadStr).digest("base64url");
    const sigBuf = Buffer.from(sigStr);
    const expectedBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const colonIndex = payloadStr.indexOf(":");
    if (colonIndex === -1) {
      return null;
    }
    const playerId = payloadStr.substring(0, colonIndex);
    const expiresAt = parseInt(payloadStr.substring(colonIndex + 1), 10);

    if (isNaN(expiresAt)) {
      return null;
    }

    return { playerId, expiresAt };
  }
}

export class PlayerIdentityUseCase {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly repo: IdentityRepository,
    private readonly tokenSigner: TokenSigner
  ) {}

  async execute(
    fingerprint: string,
    token?: string
  ): Promise<{ playerId: string; token: string }> {
    const fingerprintHash = createHash("sha256").update(fingerprint).digest("hex");
    const isBlacklisted = await this.repo.isFingerprintBlacklisted(fingerprintHash);
    if (isBlacklisted) {
      throw new BlacklistedFingerprintError();
    }

    const now = this.clock.nowEpochMs();

    if (token) {
      const verified = this.tokenSigner.verify(token);
      if (verified && verified.expiresAt > now) {
        const tokenHash = createHash("sha256").update(token).digest("hex");
        const dbToken = await this.repo.findPlayerTokenByTokenHash(tokenHash);
        if (dbToken && dbToken.revokedAt === null) {
          const player = await this.repo.findAnonymousPlayerById(dbToken.playerId);
          if (player) {
            await this.repo.updateAnonymousPlayerActiveTime(player.id, now);
            return { playerId: player.id, token };
          }
        }
      }
    }

    let playerId: string;
    const existingPlayer = await this.repo.findAnonymousPlayerByFingerprintHash(fingerprintHash);

    if (existingPlayer) {
      playerId = existingPlayer.id;
      await this.repo.updateAnonymousPlayerActiveTime(playerId, now);
    } else {
      playerId = this.idGenerator.nextId();
      const newPlayer: AnonymousPlayer = {
        id: playerId,
        fingerprintHash,
        firstActiveAt: now,
        lastActiveAt: now,
      };
      try {
        await this.repo.saveAnonymousPlayer(newPlayer);
      } catch (err) {
        const player = await this.repo.findAnonymousPlayerByFingerprintHash(fingerprintHash);
        if (player) {
          playerId = player.id;
          await this.repo.updateAnonymousPlayerActiveTime(playerId, now);
        } else {
          throw err;
        }
      }
    }

    const randomMs = Math.floor(Math.random() * 1000000);
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000 + randomMs;
    const newToken = this.tokenSigner.sign(playerId, expiresAt);
    const newTokenHash = createHash("sha256").update(newToken).digest("hex");

    const playerToken: PlayerToken = {
      id: this.idGenerator.nextId(),
      tokenHash: newTokenHash,
      playerId,
      expiresAt,
      revokedAt: null,
      createdAt: now,
    };

    await this.repo.savePlayerToken(playerToken);

    return { playerId, token: newToken };
  }
}
