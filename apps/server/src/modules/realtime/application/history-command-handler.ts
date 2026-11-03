import { HistoryPageQuery } from "@cogm/shared";
import type { DbClient } from "@/platform/db/client";
import { AppError } from "@/platform/errors/app-error";
import type { CommandHandler, CommandHandlerContext, CommandHandlerResult } from "./command-handler";
import { SessionHistoryPager } from "./session-history";

export class HistoryPageHandler implements CommandHandler {
  readonly type = "history:page" as const;
  readonly allowedStatuses = ["waiting", "preparing", "active"] as const;
  readonly allowWhenEnded = true;
  readonly transientReply = true;
  readonly skipHistoryCheckpoint = true;

  constructor(private readonly pagerFactory: (db: DbClient) => SessionHistoryPager = (db) => new SessionHistoryPager(db)) {}

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    const parsed = HistoryPageQuery.safeParse(payload ?? {});
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }
    const page = await this.pagerFactory(ctx.tx).page({
      sessionId: ctx.sessionId,
      actor: ctx.actor,
      claimedCharacterId: ctx.seat?.characterId ?? null,
      connectionId: ctx.connectionId,
      beforeEventId: parsed.data.beforeEventId ?? null,
      limit: parsed.data.limit,
    });
    return { replyPayload: { history: page } };
  }
}

export function createHistoryCommandHandlers(): CommandHandler[] {
  return [new HistoryPageHandler()];
}