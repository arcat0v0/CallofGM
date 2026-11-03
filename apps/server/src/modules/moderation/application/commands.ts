import {
	BanFingerprintCommand,
	KickPlayerCommand,
	UnbanFingerprintCommand,
	UnkickPlayerCommand,
} from "@cogm/shared";
import { and, eq, isNull } from "drizzle-orm";
import { ForbiddenError } from "@/modules/identity";
import type {
	CommandHandler,
	CommandHandlerContext,
	CommandHandlerResult,
} from "@/modules/realtime";
import type { SeatHolderInput } from "@/modules/sessions";
import { holderKeyOf } from "@/modules/sessions";
import type { DbClient } from "@/platform/db/client";
import { sessionClaims } from "@/platform/db/schema";
import { AppError } from "@/platform/errors/app-error";
import type { ModerationRepository, SessionKickStore } from "./ports";

export class PlayerNotFoundError extends AppError {
	constructor(message = "Player not found") {
		super("PLAYER_NOT_FOUND", message, 404);
	}
}

/** player:kick — 记录团内禁入并关闭玩家当前连接；解除前无法重新认领或握手 */
export class KickPlayerHandler implements CommandHandler {
	readonly type = "player:kick" as const;
	readonly allowWhenEnded = true;

	constructor(
		private readonly kickStoreFactory: (tx: DbClient) => SessionKickStore,
	) {}

	async execute(
		ctx: CommandHandlerContext,
		payload: unknown,
	): Promise<CommandHandlerResult> {
		if (ctx.actor.type !== "user" || ctx.actor.role !== "gm") {
			throw new ForbiddenError("Only the GM can kick players");
		}
		const parsed = KickPlayerCommand.safeParse(payload);
		if (!parsed.success) {
			throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
		}
		const holder: SeatHolderInput =
			parsed.data.holderKind === "user"
				? { holderKind: "user", userId: parsed.data.holderId, playerId: null }
				: {
						holderKind: "anonymous",
						userId: null,
						playerId: parsed.data.holderId,
					};
		const store = this.kickStoreFactory(ctx.tx);
		const existing = await store.findActiveSessionKick(ctx.sessionId, holder);

		if (!existing) {
			const claims = await ctx.tx
				.select({ id: sessionClaims.id })
				.from(sessionClaims)
				.where(
					and(
						eq(sessionClaims.sessionId, ctx.sessionId),
						holder.holderKind === "user"
							? eq(sessionClaims.userId, holder.userId!)
							: eq(sessionClaims.playerId, holder.playerId!),
						isNull(sessionClaims.releasedAt),
					),
				);
			if (claims.length === 0) {
				throw new PlayerNotFoundError(
					"Player has no active claim in this session",
				);
			}
			const reason = parsed.data.reason?.trim() ?? "";
			await store.recordSessionKick({
				id: ctx.idGenerator.nextId(),
				sessionId: ctx.sessionId,
				holderKind: holder.holderKind,
				playerId: holder.playerId,
				userId: holder.userId,
				reason: reason.length > 0 ? reason : null,
				createdAt: ctx.clock.nowEpochMs(),
			});
		}

		return {
			closeConnectionsOfHolders: [holderKeyOf(holder)],
			refreshPresence: true,
			replyPayload: {
				kicked: parsed.data.holderId,
				alreadyKicked: existing !== null,
			},
		};
	}
}

export class UnkickPlayerHandler implements CommandHandler {
	readonly type = "player:unkick" as const;
	readonly allowWhenEnded = true;

	constructor(
		private readonly kickStoreFactory: (tx: DbClient) => SessionKickStore,
	) {}

	async execute(
		ctx: CommandHandlerContext,
		payload: unknown,
	): Promise<CommandHandlerResult> {
		if (ctx.actor.type !== "user" || ctx.actor.role !== "gm") {
			throw new ForbiddenError("Only the GM can lift a kick");
		}
		const parsed = UnkickPlayerCommand.safeParse(payload);
		if (!parsed.success) {
			throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
		}

		const holder: SeatHolderInput =
			parsed.data.holderKind === "user"
				? { holderKind: "user", userId: parsed.data.holderId, playerId: null }
				: {
						holderKind: "anonymous",
						userId: null,
						playerId: parsed.data.holderId,
					};
		const lifted = await this.kickStoreFactory(ctx.tx).liftSessionKick(
			ctx.sessionId,
			holder,
			ctx.clock.nowEpochMs(),
		);

		return {
			refreshPresence: true,
			replyPayload: { holderId: parsed.data.holderId, lifted },
		};
	}
}

/** player:ban — 将玩家指纹写入黑名单并立即断开其连接；HTTP 与 WS 握手均会被拦截 */
export class BanFingerprintHandler implements CommandHandler {
	readonly type = "player:ban" as const;
	readonly allowWhenEnded = true;

	constructor(
		private readonly repoFactory: (tx: DbClient) => ModerationRepository,
	) {}

	async execute(
		ctx: CommandHandlerContext,
		payload: unknown,
	): Promise<CommandHandlerResult> {
		if (ctx.actor.type !== "user" || ctx.actor.role !== "gm") {
			throw new ForbiddenError("Only the GM can ban players");
		}
		const parsed = BanFingerprintCommand.safeParse(payload);
		if (!parsed.success) {
			throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
		}
		const input = parsed.data;

		const repo = this.repoFactory(ctx.tx);
		let fingerprintHash: string;
		let playerId: string | null = null;
		let userId: string | null = null;
		let displayName: string | null = null;
		if (input.userId) {
			const context = await repo.findUserBanContext(input.userId);
			if (!context) {
				throw new PlayerNotFoundError();
			}
			fingerprintHash = context.fingerprintHash;
			userId = input.userId;
			displayName = context.displayName;
		} else if (input.playerId) {
			const context = await repo.findPlayerBanContext(input.playerId);
			if (!context) {
				throw new PlayerNotFoundError();
			}
			fingerprintHash = context.fingerprintHash;
			playerId = input.playerId;
			displayName = context.displayName;
		} else if (input.fingerprintHash) {
			fingerprintHash = input.fingerprintHash;
		} else {
			throw new AppError(
				"VALIDATION_FAILED",
				"playerId or fingerprintHash is required",
				400,
			);
		}

		const now = ctx.clock.nowEpochMs();
		// durationSeconds 缺省为永久（NULL）
		const expiresAt = input.durationSeconds
			? now + input.durationSeconds * 1000
			: null;

		await repo.upsertBlacklistEntry({
			id: ctx.idGenerator.nextId(),
			fingerprintHash,
			playerId,
			userId,
			displayName,
			reason: input.reason,
			expiresAt,
			createdAt: now,
		});

		return {
			...(input.playerId
				? { closeConnectionsOfHolders: [`player:${input.playerId}`] }
				: {}),
			...(input.userId
				? { closeConnectionsOfHolders: [`user:${input.userId}`] }
				: {}),
			refreshPresence: true,
			replyPayload: {
				banned: userId ?? playerId,
				fingerprintHash,
				permanent: expiresAt === null,
			},
		};
	}
}

/** player:unban — 解除指纹黑名单 */
export class UnbanFingerprintHandler implements CommandHandler {
	readonly type = "player:unban" as const;
	readonly allowWhenEnded = true;

	constructor(
		private readonly repoFactory: (tx: DbClient) => ModerationRepository,
	) {}

	async execute(
		ctx: CommandHandlerContext,
		payload: unknown,
	): Promise<CommandHandlerResult> {
		if (ctx.actor.type !== "user" || ctx.actor.role !== "gm") {
			throw new ForbiddenError("Only the GM can unban players");
		}
		const parsed = UnbanFingerprintCommand.safeParse(payload);
		if (!parsed.success) {
			throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
		}

		const repo = this.repoFactory(ctx.tx);
		const removed = await repo.deleteBlacklistEntry(parsed.data);
		return { replyPayload: { removed } };
	}
}

export function createModerationCommandHandlers(
	repoFactory: (tx: DbClient) => ModerationRepository,
	kickStoreFactory: (tx: DbClient) => SessionKickStore,
): CommandHandler[] {
	return [
		new KickPlayerHandler(kickStoreFactory),
		new UnkickPlayerHandler(kickStoreFactory),
		new BanFingerprintHandler(repoFactory),
		new UnbanFingerprintHandler(repoFactory),
	];
}
