import { GrantHandoutCommand, AppendHandoutRecipientsCommand, type GrantedHandoutDto } from "@cogm/shared";
import type {
  CommandHandler,
  CommandHandlerContext,
  CommandHandlerResult,
} from "@/modules/realtime";
import { AppError } from "@/platform/errors/app-error";
import { ForbiddenError } from "@/modules/identity";
import { HandoutNotFoundError, HandoutGrantNotFoundError } from "../domain/errors";
import type { DbClient } from "@/platform/db/client";
import type { HandoutsRepository } from "./ports";

function toGrantedDto(
  grant: { id: string; isPublic: number; createdAt: number },
  handout: { id: string; title: string; content: string; imageAssetId: string | null }
): GrantedHandoutDto {
  return {
    grantId: grant.id,
    handout: {
      id: handout.id,
      title: handout.title,
      content: handout.content,
      imageAssetId: handout.imageAssetId ?? null,
    },
    isPublic: grant.isPublic === 1,
    grantedAt: grant.createdAt,
  };
}

/**
 * handout:grant — 发放情报。
 * 公开情报 visibility=public；秘密情报仅定向投递给指定 PC，其余人完全无感知。
 */
export class GrantHandoutHandler implements CommandHandler {
  readonly type = "handout:grant" as const;
  readonly allowedStatuses = ["preparing", "active"] as const;

  constructor(private readonly repoFactory: (tx: DbClient) => HandoutsRepository) {}

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    if (ctx.actor.type !== "gm") {
      throw new ForbiddenError("Only the GM can grant handouts");
    }
    const parsed = GrantHandoutCommand.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }
    const input = parsed.data;
    const repo = this.repoFactory(ctx.tx);

    const handout = await repo.findHandoutById(input.handoutId);
    if (!handout || handout.moduleId !== ctx.session.moduleId) {
      throw new HandoutNotFoundError();
    }

    const recipients = [...new Set(input.recipientCharacterIds)];
    const notInSession = await repo.findCharactersNotInSession(ctx.sessionId, recipients);
    if (notInSession.length > 0) {
      throw new AppError("VALIDATION_FAILED", `Characters not in session: ${notInSession.join(", ")}`, 400);
    }

    const isPublic = recipients.length === 0;
    const now = ctx.clock.nowEpochMs();
    const grantId = ctx.idGenerator.nextId();

    await repo.insertGrant({
      id: grantId,
      sessionId: ctx.sessionId,
      handoutId: handout.id,
      isPublic: isPublic ? 1 : 0,
      createdAt: now,
    });
    if (!isPublic) {
      await repo.insertRecipients(
        recipients.map((characterId) => ({
          id: ctx.idGenerator.nextId(),
          grantId,
          characterId,
          createdAt: now,
        }))
      );
    }

    const grantDto = toGrantedDto(
      { id: grantId, isPublic: isPublic ? 1 : 0, createdAt: now },
      handout
    );

    return {
      events: [
        {
          type: "handout:granted",
          payload: { grant: grantDto },
          visibility: isPublic ? { type: "public" } : { type: "selectedPcIds", pcIds: recipients },
        },
      ],
      replyPayload: { grantId, isPublic },
    };
  }
}

/**
 * handout:append — 为已发放的秘密情报追加可见对象。
 * 事件只投递给新增 PC，已有可见者不会收到重复弹窗。
 */
export class AppendHandoutRecipientsHandler implements CommandHandler {
  readonly type = "handout:append" as const;
  readonly allowedStatuses = ["preparing", "active"] as const;

  constructor(private readonly repoFactory: (tx: DbClient) => HandoutsRepository) {}

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    if (ctx.actor.type !== "gm") {
      throw new ForbiddenError("Only the GM can append handout recipients");
    }
    const parsed = AppendHandoutRecipientsCommand.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }
    const input = parsed.data;
    const repo = this.repoFactory(ctx.tx);

    const grant = await repo.findGrantById(input.grantId);
    if (!grant || grant.sessionId !== ctx.sessionId) {
      throw new HandoutGrantNotFoundError();
    }
    if (grant.isPublic === 1) {
      throw new AppError("VALIDATION_FAILED", "Cannot append recipients to a public grant", 400);
    }

    const handout = await repo.findHandoutById(grant.handoutId);
    if (!handout) {
      throw new HandoutNotFoundError();
    }

    const requested = [...new Set(input.recipientCharacterIds)];
    const notInSession = await repo.findCharactersNotInSession(ctx.sessionId, requested);
    if (notInSession.length > 0) {
      throw new AppError("VALIDATION_FAILED", `Characters not in session: ${notInSession.join(", ")}`, 400);
    }

    const existing = new Set(await repo.listRecipientCharacterIds(grant.id));
    const newRecipients = requested.filter((id) => !existing.has(id));

    if (newRecipients.length > 0) {
      const now = ctx.clock.nowEpochMs();
      await repo.insertRecipients(
        newRecipients.map((characterId) => ({
          id: ctx.idGenerator.nextId(),
          grantId: grant.id,
          characterId,
          createdAt: now,
        }))
      );

      const grantDto = toGrantedDto(grant, handout);
      return {
        events: [
          {
            type: "handout:granted",
            payload: { grant: grantDto },
            visibility: { type: "selectedPcIds", pcIds: newRecipients },
          },
        ],
        replyPayload: { grantId: grant.id, addedCount: newRecipients.length },
      };
    }

    return { replyPayload: { grantId: grant.id, addedCount: 0 } };
  }
}

export function createHandoutCommandHandlers(
  repoFactory: (tx: DbClient) => HandoutsRepository
): CommandHandler[] {
  return [new GrantHandoutHandler(repoFactory), new AppendHandoutRecipientsHandler(repoFactory)];
}
