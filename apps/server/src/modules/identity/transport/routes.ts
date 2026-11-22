import {
	BanPlayerRequest,
	BlacklistEntryDto,
	ChangePasswordRequest,
	LoginRequest,
	SessionCloseCode,
	UnbanFingerprintRequest,
} from "@cogm/shared";
import { Elysia } from "elysia";
import { z } from "zod";
import type { Container } from "@/bootstrap/container";
import { PlayerNotFoundError } from "@/modules/moderation";
import { AppError } from "@/platform/errors/app-error";
import { validationFailed } from "@/platform/errors/validation";
import { logger } from "@/platform/logging/logger";
import { assertTrustedOrigin } from "@/platform/security/origin";
import { clientIp } from "@/platform/security/request-ip";
import { requireGm } from "../application/guards";
import { PlayerIdentityUseCase } from "../application/player-identity";
import {
	ChangeOwnPasswordUseCase,
	LoginUseCase,
} from "../application/user-accounts";
import {
	AuthRequiredError,
	InvalidPasswordError,
	isPasswordFieldFailure,
} from "../domain/errors";
import {
	PLAYER_COOKIE,
	readBearer,
	readCookie,
	SESSION_COOKIE,
} from "./auth-middleware";

export function createIdentityRoutes(container: Container) {
	const { identityRepo: repo, moderationRepo, authPlugin } = container;
	const loginUseCase = new LoginUseCase(
		container.idGenerator,
		container.clock,
		repo,
	);
	const changePasswordUseCase = new ChangeOwnPasswordUseCase(
		container.clock,
		repo,
	);
	const playerIdentityUseCase = new PlayerIdentityUseCase(
		container.idGenerator,
		container.clock,
		repo,
	);

	const allowedOrigins = container.config.corsOrigins;

	return new Elysia()
		.use(authPlugin)
		.post("/api/v1/auth/login", async ({ body, cookie, request, server }) => {
			assertTrustedOrigin(request, allowedOrigins, container.config.trustProxy);
			container.httpLimits.loginRateLimiter.assert(
				clientIp(request, server, container.config.trustProxy),
			);

			const parsed = LoginRequest.safeParse(body);
			if (!parsed.success) {
				throw validationFailed(parsed.error);
			}

			let result;
			try {
				result = await loginUseCase.execute(
					parsed.data.username,
					parsed.data.password,
				);
			} catch (err) {
				logger.audit("auth.login.failed", {
					ip: clientIp(request, server, container.config.trustProxy),
				});
				throw err;
			}

			for (const replacedId of result.replacedSessionIds) {
				container.connectionRegistry.closeLoginSessionConnections(replacedId);
			}
			container.connectionRegistry.closeUserConnections(
				result.user.id,
				undefined,
				SessionCloseCode.loginRevoked,
				"session replaced",
			);

			cookie?.[SESSION_COOKIE]?.set({
				value: result.sessionToken,
				httpOnly: true,
				secure: container.config.environment === "production",
				sameSite: "strict",
				path: "/",
				expires: new Date(result.expiresAt),
			});

			logger.audit("auth.login.ok", { role: result.user.role });
			return {
				...(container.config.environment === "production"
					? {}
					: { sessionToken: result.sessionToken }),
				userId: result.user.id,
				username: result.user.username,
				role: result.user.role,
				expiresAt: result.expiresAt,
			};
		})
		.post("/api/v1/auth/logout", async ({ actor, request, cookie }) => {
			assertTrustedOrigin(request, allowedOrigins, container.config.trustProxy);
			if (!actor || actor.type !== "user") {
				throw new AuthRequiredError();
			}
			await repo.revokeSession(
				actor.loginSessionId,
				container.clock.nowEpochMs(),
			);
			cookie?.[SESSION_COOKIE]?.remove();
			logger.audit("auth.logout");
			return { success: true };
		})
		.get("/api/v1/auth/me", ({ actor }) => {
			if (!actor || actor.type !== "user") {
				throw new AuthRequiredError();
			}
			return {
				type: "user" as const,
				userId: actor.userId,
				username: actor.username,
				role: actor.role,
			};
		})
		.put("/api/v1/auth/password", async ({ actor, body, request, cookie }) => {
			assertTrustedOrigin(request, allowedOrigins, container.config.trustProxy);
			if (!actor || actor.type !== "user") {
				throw new AuthRequiredError();
			}
			const parsed = ChangePasswordRequest.safeParse(body);
			if (!parsed.success) {
				if (isPasswordFieldFailure(parsed.error, "newPassword")) {
					throw new InvalidPasswordError();
				}
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
		.get("/api/v1/gm/blacklist", async ({ actor }) => {
			requireGm(actor);
			return z
				.array(BlacklistEntryDto)
				.parse(await repo.listBlacklistEntries());
		})
		.post("/api/v1/gm/blacklist", async ({ actor, body, request }) => {
			assertTrustedOrigin(request, allowedOrigins, container.config.trustProxy);
			requireGm(actor);
			const parsed = BanPlayerRequest.safeParse(body);
			if (!parsed.success) {
				throw validationFailed(parsed.error);
			}
			let fingerprintHash: string;
			let playerId: string | null = null;
			let userId: string | null = null;
			let displayName: string | null = null;
			if (parsed.data.userId) {
				const context = await moderationRepo.findUserBanContext(
					parsed.data.userId,
				);
				if (!context) {
					throw new PlayerNotFoundError();
				}
				fingerprintHash =
					context.fingerprintHash || `user:${parsed.data.userId}`;
				userId = parsed.data.userId;
				displayName = context.displayName;
			} else if (parsed.data.playerId) {
				const context = await moderationRepo.findPlayerBanContext(
					parsed.data.playerId,
				);
				if (!context) {
					throw new PlayerNotFoundError();
				}
				fingerprintHash = context.fingerprintHash;
				playerId = parsed.data.playerId;
				displayName = context.displayName;
			} else if (parsed.data.fingerprintHash) {
				fingerprintHash = parsed.data.fingerprintHash;
			} else {
				throw new AppError(
					"VALIDATION_FAILED",
					"playerId, userId or fingerprintHash is required",
					400,
				);
			}
			const now = container.clock.nowEpochMs();
			const expiresAt = parsed.data.durationSeconds
				? now + parsed.data.durationSeconds * 1000
				: null;
			await moderationRepo.upsertBlacklistEntry({
				id: container.idGenerator.nextId(),
				fingerprintHash,
				playerId,
				userId,
				displayName,
				reason: parsed.data.reason,
				expiresAt,
				createdAt: now,
			});
			if (playerId)
				container.connectionRegistry.closePlayerConnections(playerId);
			if (userId)
				container.connectionRegistry.closeUserConnections(
					userId,
					undefined,
					4000,
					"banned",
				);
			logger.audit("gm.blacklist.ban", { playerId, userId });
			return {
				banned: userId ?? playerId,
				permanent: expiresAt === null,
				fingerprintHash,
			};
		})
		.post("/api/v1/gm/blacklist/unban", async ({ actor, body, request }) => {
			assertTrustedOrigin(request, allowedOrigins, container.config.trustProxy);
			requireGm(actor);
			const parsed = UnbanFingerprintRequest.safeParse(body);
			if (!parsed.success) {
				throw validationFailed(parsed.error);
			}
			const removed = await moderationRepo.deleteBlacklistEntry(parsed.data);
			logger.audit("gm.blacklist.unban", {
				fingerprintHash: parsed.data.fingerprintHash,
				removed,
			});
			return { removed };
		})
		.get("/api/v1/player/me", ({ actor }) => {
			if (!actor || actor.type !== "player") {
				throw new AuthRequiredError();
			}
			return { playerId: actor.playerId };
		})
		.post(
			"/api/v1/player/identity",
			async ({ body, cookie, request, server }) => {
				assertTrustedOrigin(
					request,
					allowedOrigins,
					container.config.trustProxy,
				);
				container.httpLimits.identityRateLimiter.assert(
					clientIp(request, server, container.config.trustProxy),
				);

				const payload = body as Record<string, unknown> | null;
				const fingerprint = payload?.fingerprint;
				const token = payload?.token;

				if (typeof fingerprint !== "string" || fingerprint.trim() === "") {
					throw new AppError(
						"VALIDATION_FAILED",
						"Fingerprint is required",
						400,
					);
				}
				if (token !== undefined && typeof token !== "string") {
					throw new AppError(
						"VALIDATION_FAILED",
						"Token must be a string",
						400,
					);
				}

				const result = await playerIdentityUseCase.execute(fingerprint, token);

				cookie?.[PLAYER_COOKIE]?.set({
					value: result.token,
					httpOnly: true,
					secure: container.config.environment === "production",
					sameSite: "strict",
					path: "/",
					expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
				});

				return {
					playerId: result.playerId,
					...(container.config.environment === "production"
						? {}
						: { token: result.token }),
				};
			},
		);
}

export { readBearer, readCookie };
