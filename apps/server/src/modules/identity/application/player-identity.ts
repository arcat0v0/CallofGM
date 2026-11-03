import { createHash } from "crypto";
import type { Clock, IdGenerator } from "@/platform/ports";
import { BlacklistedFingerprintError } from "../domain/errors";
import type { AnonymousPlayer, IdentityRepository, PlayerToken } from "./ports";
import { hashToken, issueOpaqueToken } from "./token";

export class PlayerIdentityUseCase {
	constructor(
		private readonly idGenerator: IdGenerator,
		private readonly clock: Clock,
		private readonly repo: IdentityRepository,
	) {}

	async execute(
		fingerprint: string,
		token?: string,
	): Promise<{ playerId: string; token: string }> {
		const fingerprintHash = createHash("sha256")
			.update(fingerprint)
			.digest("hex");
		const isBlacklisted =
			await this.repo.isFingerprintBlacklisted(fingerprintHash);
		if (isBlacklisted) {
			throw new BlacklistedFingerprintError();
		}

		const now = this.clock.nowEpochMs();

		if (token) {
			const tokenHash = hashToken(token);
			const dbToken = await this.repo.findPlayerTokenByTokenHash(tokenHash);
			if (dbToken && dbToken.revokedAt === null && dbToken.expiresAt > now) {
				const player = await this.repo.findAnonymousPlayerById(
					dbToken.playerId,
				);
				if (player) {
					await this.repo.updateAnonymousPlayerActiveTime(player.id, now);
					return { playerId: player.id, token };
				}
			}
		}

		let playerId: string;
		const existingPlayer =
			await this.repo.findAnonymousPlayerByFingerprintHash(fingerprintHash);

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
				const player =
					await this.repo.findAnonymousPlayerByFingerprintHash(fingerprintHash);
				if (player) {
					playerId = player.id;
					await this.repo.updateAnonymousPlayerActiveTime(playerId, now);
				} else {
					throw err;
				}
			}
		}

		const jitterBytes = new Uint8Array(3);
		crypto.getRandomValues(jitterBytes);
		const randomMs =
			((jitterBytes[0]! << 16) | (jitterBytes[1]! << 8) | jitterBytes[2]!) %
			1_000_000;
		const expiresAt = now + 30 * 24 * 60 * 60 * 1000 + randomMs;
		const issued = issueOpaqueToken();

		const playerToken: PlayerToken = {
			id: this.idGenerator.nextId(),
			tokenHash: issued.tokenHash,
			playerId,
			expiresAt,
			revokedAt: null,
			createdAt: now,
		};

		await this.repo.savePlayerToken(playerToken);
		return { playerId, token: issued.token };
	}
}
