import { KickPlayerCommand, BanFingerprintCommand, UnbanFingerprintCommand } from "@cogm/shared";
import { and, eq, isNull } from "drizzle-orm";
import { sessionClaims } from "@/platform/db/schema";
import type {
  CommandHandler,
  CommandHandlerContext,
  CommandHandlerResult,
} from "@/modules/realtime";
import { AppError } from "@/platform/errors/app-error";
import { ForbiddenError } from "@/modules/identity";
import { DrizzleModerationRepository } from "../infrastructure/drizzle-moderation-repository";

export class PlayerNotFoundError extends AppError {
  constructor(message = "Player not found") {
    super("PLAYER_NOT_FOUND", message, 404);
  }
}

/** player:kick — 关闭玩家当前连接（不拉黑，不释放 claim） */
export class KickPlayerHandler implements CommandHandler {
  readonly type = "player:kick" as const;
  readonly allowWhenEnded = true;

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    if (ctx.actor.type !== "gm") {
      throw new ForbiddenError("Only the GM can kick players");
    }
    const parsed = KickPlayerCommand.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }

    const claims = await ctx.tx
      .select({ id: sessionClaims.id })
      .from(sessionClaims)
      .where(
        and(
          eq(sessionClaims.sessionId, ctx.sessionId),
          eq(sessionClaims.playerId, parsed.data.playerId),
          isNull(sessionClaims.releasedAt)
        )
      );
    if (claims.length === 0) {
      throw new PlayerNotFoundError("Player has no active claim in this session");
    }

    return {
      closeConnectionsOfPlayerIds: [parsed.data.playerId],
      refreshPresence: true,
      replyPayload: { kicked: parsed.data.playerId },
    };
  }
}

/** player:ban — 将玩家指纹写入黑名单并立即断开其连接；HTTP 与 WS 握手均会被拦截 */
export class BanFingerprintHandler implements CommandHandler {
  readonly type = "player:ban" as const;
  readonly allowWhenEnded = true;

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    if (ctx.actor.type !== "gm") {
      throw new ForbiddenError("Only the GM can ban players");
    }
    const parsed = BanFingerprintCommand.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }
    const input = parsed.data;

    const repo = new DrizzleModerationRepository(ctx.tx);
    const fingerprintHash = await repo.findPlayerFingerprintHash(input.playerId);
    if (!fingerprintHash) {
      throw new PlayerNotFoundError();
    }

    const now = ctx.clock.nowEpochMs();
    // durationSeconds 缺省为永久（NULL）
    const expiresAt = input.durationSeconds ? now + input.durationSeconds * 1000 : null;

    await repo.upsertBlacklistEntry({
      id: ctx.idGenerator.nextId(),
      fingerprintHash,
      reason: input.reason,
      expiresAt,
      createdAt: now,
    });

    return {
      closeConnectionsOfPlayerIds: [input.playerId],
      refreshPresence: true,
      replyPayload: { banned: input.playerId, permanent: expiresAt === null },
    };
  }
}

/** player:unban — 解除指纹黑名单 */
export class UnbanFingerprintHandler implements CommandHandler {
  readonly type = "player:unban" as const;
  readonly allowWhenEnded = true;

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    if (ctx.actor.type !== "gm") {
      throw new ForbiddenError("Only the GM can unban players");
    }
    const parsed = UnbanFingerprintCommand.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }

    const repo = new DrizzleModerationRepository(ctx.tx);
    const removed = await repo.deleteBlacklistEntry(parsed.data.fingerprintHash);
    return { replyPayload: { removed } };
  }
}

export function createModerationCommandHandlers(): CommandHandler[] {
  return [new KickPlayerHandler(), new BanFingerprintHandler(), new UnbanFingerprintHandler()];
}
