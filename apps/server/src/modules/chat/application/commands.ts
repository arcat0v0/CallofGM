import {
  SendChatMessageCommand,
  ReleaseChatMessageCommand,
  DiscardChatMessageCommand,
  ReorderChatQueueCommand,
  type ChatMessageDto,
  type SessionPhase,
} from "@cogm/shared";
import type {
  CommandHandler,
  CommandHandlerContext,
  CommandHandlerResult,
  StagedEvents,
} from "@/modules/realtime";
import { AppError } from "@/platform/errors/app-error";
import { ForbiddenError } from "@/modules/identity";
import { SessionPhaseForbidsActionError } from "@/modules/sessions";
import { decideChatMessage } from "../domain/message-policy";
import { MessageNotFoundError, MessageNotPendingError, ExpressionNotFoundError } from "../domain/errors";
import type { DbClient } from "@/platform/db/client";
import type { ChatRepository, MessageRow } from "./ports";

async function toDto(
  repo: ChatRepository,
  row: MessageRow,
  nameCache: Map<string, string | null>
): Promise<ChatMessageDto> {
  let characterName: string | null = null;
  if (row.characterId) {
    if (!nameCache.has(row.characterId)) {
      nameCache.set(row.characterId, await repo.findCharacterName(row.characterId));
    }
    characterName = nameCache.get(row.characterId) ?? null;
  }
  return {
    id: row.id,
    sessionId: row.sessionId,
    senderId: row.senderId ?? null,
    senderType: row.senderType === "gm" ? "gm" : "player",
    characterId: row.characterId ?? null,
    characterName,
    channel: row.channel === "roleplay" ? "roleplay" : "ooc",
    content: row.content,
    expressionKey: row.expressionKey ?? null,
    queueOrder: row.queueOrder,
    eventId: row.eventId ?? null,
    presentedAt: row.presentedAt ?? null,
    createdAt: row.createdAt,
  };
}

async function persistPresentedEventId(
  repo: ChatRepository,
  staged: StagedEvents,
  dto: ChatMessageDto,
  messageId: string
): Promise<void> {
  const entry = staged.entries[0];
  const eventId = entry?.event.eventId;
  if (eventId === undefined) {
    return;
  }
  await repo.assignEventId(messageId, eventId);
  dto.eventId = eventId;
  const payload = { message: dto };
  if (entry) {
    entry.event.payload = payload;
  }
}

/** 向 GM 推送最新待呈现队列（DirectControlMessage） */
async function queueUpdate(
  ctx: CommandHandlerContext,
  repo: ChatRepository
): Promise<{ type: string; payload: unknown }> {
  const pending = await repo.listPending(ctx.sessionId);
  const nameCache = new Map<string, string | null>();
  const messages = await Promise.all(pending.map((row) => toDto(repo, row, nameCache)));
  return { type: "chat:queue", payload: { messages } };
}

/**
 * chat:send — 发送消息。
 * 按阶段权限矩阵裁决：立即呈现（分配 eventId 广播）或进入 GM 待呈现队列（对玩家零感知）。
 */
export class SendChatMessageHandler implements CommandHandler {
  readonly type = "chat:send" as const;
  readonly allowedStatuses = ["waiting", "preparing", "active"] as const;

  constructor(private readonly repoFactory: (tx: DbClient) => ChatRepository) {}

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    const parsed = SendChatMessageCommand.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }
    const input = parsed.data;
    const repo = this.repoFactory(ctx.tx);

    const isGm = ctx.actor.type === "gm";
    const characterId = isGm ? null : (ctx.seat?.characterId ?? null);
    const senderId = ctx.actor.type === "player" ? ctx.actor.playerId : null;

    const decision = decideChatMessage(
      ctx.session.phase as SessionPhase,
      ctx.actor.type,
      ctx.seat?.role ?? null,
      input.channel
    );
    if (decision.kind === "forbidden") {
      throw new SessionPhaseForbidsActionError("Current phase forbids this message");
    }

    // 表情切换：只能操作发言者自己认领的 PC，且必须引用该人物已有立绘
    let expressionKey: string | null = null;
    if (input.expressionKey) {
      if (isGm || !characterId) {
        throw new ForbiddenError("Only the owning player can attach expressions");
      }
      const exists = await repo.portraitExists(characterId, input.expressionKey);
      if (!exists) {
        throw new ExpressionNotFoundError();
      }
      expressionKey = input.expressionKey;
    }

    const now = ctx.clock.nowEpochMs();
    const messageId = ctx.idGenerator.nextId();

    if (decision.kind === "immediate") {
      const row = {
        id: messageId,
        sessionId: ctx.sessionId,
        senderId,
        senderType: isGm ? "gm" : "player",
        characterId,
        channel: decision.channel,
        content: input.content,
        status: "presented",
        queueOrder: 0,
        expressionKey,
        eventId: null,
        presentedAt: now,
        createdAt: now,
      };
      await repo.insertMessage(row);

      const nameCache = new Map<string, string | null>();
      const dto = await toDto(repo, { ...row, eventId: null }, nameCache);

      return {
        events: [
          {
            type: "chat:message",
            payload: { message: dto },
            visibility: { type: "public" },
          },
        ],
        finalizeAfterStaged: async (_tx, staged) => {
          await persistPresentedEventId(repo, staged, dto, messageId);
        },
        replyPayload: { messageId, presented: true },
      };
    }

    // 进入待呈现队列：不广播、不分配 eventId，玩家零感知
    const queueOrder = (await repo.maxQueueOrder(ctx.sessionId)) + 1;
    await repo.insertMessage({
      id: messageId,
      sessionId: ctx.sessionId,
      senderId,
      senderType: "player",
      characterId,
      channel: decision.channel,
      content: input.content,
      status: "pending",
      queueOrder,
      expressionKey,
      eventId: null,
      presentedAt: null,
      createdAt: now,
    });

    return {
      directToGms: [await queueUpdate(ctx, repo)],
      replyPayload: { messageId, presented: false },
    };
  }
}

/**
 * chat:release — GM 放行队列消息。
 * 事务内校验仍为 pending、应用表情切换、设置 presented、分配 eventId。
 */
export class ReleaseChatMessageHandler implements CommandHandler {
  readonly type = "chat:release" as const;
  readonly allowedStatuses = ["waiting", "preparing", "active"] as const;

  constructor(private readonly repoFactory: (tx: DbClient) => ChatRepository) {}

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    if (ctx.actor.type !== "gm") {
      throw new ForbiddenError("Only the GM can release queued messages");
    }
    const parsed = ReleaseChatMessageCommand.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }
    const repo = this.repoFactory(ctx.tx);

    const row = await repo.findMessageById(parsed.data.messageId);
    if (!row || row.sessionId !== ctx.sessionId) {
      throw new MessageNotFoundError();
    }

    const now = ctx.clock.nowEpochMs();
    const released = await repo.markPresentedIfPending(row.id, now);
    if (!released) {
      throw new MessageNotPendingError();
    }

    const events: NonNullable<CommandHandlerResult["events"]> = [];
    const nameCache = new Map<string, string | null>();
    const dto = await toDto(repo, { ...row, status: "presented", presentedAt: now }, nameCache);
    events.push({
      type: "chat:message",
      payload: { message: dto },
      visibility: { type: "public" },
    });

    // 演绎发言携带的表情切换随放行生效
    if (row.expressionKey && row.characterId) {
      await repo.setSessionCharacterExpression(ctx.sessionId, row.characterId, row.expressionKey);
      events.push({
        type: "expression:changed",
        payload: { characterId: row.characterId, expressionKey: row.expressionKey },
        visibility: { type: "public" },
      });
    }

    return {
      events,
      directToGms: [await queueUpdate(ctx, repo)],
      finalizeAfterStaged: async (_tx, staged) => {
        await persistPresentedEventId(repo, staged, dto, row.id);
      },
      replyPayload: { messageId: row.id },
    };
  }
}

/** chat:discard — GM 丢弃队列消息（对玩家无通知，保留最小审计记录） */
export class DiscardChatMessageHandler implements CommandHandler {
  readonly type = "chat:discard" as const;
  readonly allowedStatuses = ["waiting", "preparing", "active"] as const;

  constructor(private readonly repoFactory: (tx: DbClient) => ChatRepository) {}

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    if (ctx.actor.type !== "gm") {
      throw new ForbiddenError("Only the GM can discard queued messages");
    }
    const parsed = DiscardChatMessageCommand.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }
    const repo = this.repoFactory(ctx.tx);

    const row = await repo.findMessageById(parsed.data.messageId);
    if (!row || row.sessionId !== ctx.sessionId) {
      throw new MessageNotFoundError();
    }
    const discarded = await repo.markDiscardedIfPending(row.id);
    if (!discarded) {
      throw new MessageNotPendingError();
    }

    return {
      directToGms: [await queueUpdate(ctx, repo)],
      replyPayload: { messageId: row.id },
    };
  }
}

/** chat:reorder — GM 调整待呈现队列顺序（全量有序 id 列表，稳定重排） */
export class ReorderChatQueueHandler implements CommandHandler {
  readonly type = "chat:reorder" as const;
  readonly allowedStatuses = ["waiting", "preparing", "active"] as const;

  constructor(private readonly repoFactory: (tx: DbClient) => ChatRepository) {}

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    if (ctx.actor.type !== "gm") {
      throw new ForbiddenError("Only the GM can reorder the queue");
    }
    const parsed = ReorderChatQueueCommand.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }
    const repo = this.repoFactory(ctx.tx);

    const pending = await repo.listPending(ctx.sessionId);
    const pendingIds = new Set(pending.map((row) => row.id));
    const ordered = parsed.data.messageIds.filter((id) => pendingIds.has(id));
    // 未包含在指令中的 pending 消息按原顺序排到尾部，保证全量确定性
    const remaining = pending.map((row) => row.id).filter((id) => !ordered.includes(id));
    await repo.reorderPending(ctx.sessionId, [...ordered, ...remaining]);

    return {
      directToGms: [await queueUpdate(ctx, repo)],
      replyPayload: { ok: true },
    };
  }
}

export function createChatCommandHandlers(
  repoFactory: (tx: DbClient) => ChatRepository
): CommandHandler[] {
  return [
    new SendChatMessageHandler(repoFactory),
    new ReleaseChatMessageHandler(repoFactory),
    new DiscardChatMessageHandler(repoFactory),
    new ReorderChatQueueHandler(repoFactory),
  ];
}
