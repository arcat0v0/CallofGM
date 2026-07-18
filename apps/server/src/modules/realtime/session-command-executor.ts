import { and, eq, isNull } from "drizzle-orm";
import type { ActorContext } from "@/modules/identity";
import type { ClientCommand, CommandReply, ClientCommandType } from "@cogm/shared";
import type { DbClient } from "@/platform/db/client";
import type { TransactionRunner } from "@/platform/db/transaction";
import { sessions, sessionClaims } from "@/platform/db/schema";
import { eq as eqCol } from "drizzle-orm";
import { AppError } from "@/platform/errors/app-error";
import { SessionNotFoundError, SessionStateInvalidError } from "@/modules/sessions";
import { ForbiddenError } from "@/modules/identity";
import type { Clock, IdGenerator, RandomSource } from "@/platform/ports";
import type { SessionEventBus, StagedEvents } from "./session-event-bus";
import type { PresenceService } from "./presence-service";
import type { ConnectionRegistry } from "./connection-registry";
import type { CommandHandler, CommandHandlerContext, CommandHandlerResult } from "./application/command-handler";

const MAX_CACHED_REPLIES_PER_SESSION = 500;

/**
 * 团命令串行执行器：
 * 同一 sessionId 的命令按进入顺序串行执行（不同团并发），
 * 负责命令去重、权限上下文解析、事务边界、事件投递与定向回执。
 * 具体业务由按 type 注册的 CommandHandler 完成。
 */
export class SessionCommandExecutor {
  private queues = new Map<string, Promise<unknown>>();
  private handlers = new Map<ClientCommandType, CommandHandler>();
  private cachedReplies = new Map<string, Map<string, CommandReply>>();

  constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly eventBus: SessionEventBus,
    private readonly presenceService: PresenceService,
    private readonly connectionRegistry: ConnectionRegistry,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly randomSource: RandomSource
  ) {}

  registerHandlers(handlers: CommandHandler[]): void {
    for (const handler of handlers) {
      if (this.handlers.has(handler.type)) {
        throw new Error(`Duplicate command handler for type: ${handler.type}`);
      }
      this.handlers.set(handler.type, handler);
    }
  }

  async execute(
    sessionId: string,
    actor: ActorContext,
    command: ClientCommand,
    connectionId: string
  ): Promise<CommandReply> {
    return this.enqueue(sessionId, async () => {
      // 去重检查必须位于团级串行队列内，否则两个同时到达的同 commandId 都会穿透。
      const cached = this.cachedReplies.get(sessionId)?.get(command.commandId);
      if (cached) {
        return cached;
      }

      const reply = await this.processCommand(sessionId, actor, command, connectionId);
      // 只缓存确定性回执；内部错误不缓存，允许重试
      if (reply.type === "command:accepted" || (reply.payload as { code?: string })?.code !== "INTERNAL_SERVER_ERROR") {
        this.cacheReply(sessionId, command.commandId, reply);
      }
      return reply;
    });
  }

  private enqueue<T>(sessionId: string, work: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(sessionId) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(work);
    this.queues.set(sessionId, result);
    // 队列引用链清理： settled 后移除，避免长会话内存膨胀
    void result.finally(() => {
      if (this.queues.get(sessionId) === result) {
        this.queues.delete(sessionId);
      }
    });
    return result;
  }

  private cacheReply(sessionId: string, commandId: string, reply: CommandReply): void {
    let byCommand = this.cachedReplies.get(sessionId);
    if (!byCommand) {
      byCommand = new Map();
      this.cachedReplies.set(sessionId, byCommand);
    }
    if (byCommand.size >= MAX_CACHED_REPLIES_PER_SESSION) {
      const oldest = byCommand.keys().next().value;
      if (oldest !== undefined) {
        byCommand.delete(oldest);
      }
    }
    byCommand.set(commandId, reply);
  }

  private async processCommand(
    sessionId: string,
    actor: ActorContext,
    command: ClientCommand,
    connectionId: string
  ): Promise<CommandReply> {
    const handler = this.handlers.get(command.type);
    if (!handler) {
      return this.reject(command, new AppError("RULE_ACTION_UNSUPPORTED", `Unsupported command: ${command.type}`, 400));
    }

    try {
      const { staged, result } = await this.transactionRunner.run(async (tx) => {
        const sessionRows = await tx.select().from(sessions).where(eqCol(sessions.id, sessionId));
        const session = sessionRows[0];
        if (!session) {
          throw new SessionNotFoundError();
        }
        if (session.status === "ended" && !handler.allowWhenEnded) {
          throw new SessionStateInvalidError("Session has ended");
        }

        const seat = await this.resolveSeat(tx, sessionId, actor);
        const ctx: CommandHandlerContext = {
          tx,
          sessionId,
          session,
          actor,
          seat,
          connectionId,
          clock: this.clock,
          idGenerator: this.idGenerator,
          randomSource: this.randomSource,
        };

        const result = await handler.execute(ctx, command.payload);
        const staged = await this.eventBus.stage(tx, sessionId, result.events ?? []);
        if (result.finalizeAfterStaged) {
          await result.finalizeAfterStaged(tx, staged);
        }
        return { staged, result };
      });

      await this.afterCommit(sessionId, staged, result);

      return {
        protocolVersion: 1,
        commandId: command.commandId,
        type: "command:accepted",
        payload: result.replyPayload ?? {
          eventIds: staged.entries.map((e) => e.event.eventId),
        },
      };
    } catch (err) {
      return this.reject(command, err);
    }
  }

  private async resolveSeat(
    tx: DbClient,
    sessionId: string,
    actor: ActorContext
  ): Promise<CommandHandlerContext["seat"]> {
    if (actor.type !== "player") {
      return null;
    }
    const claims = await tx
      .select()
      .from(sessionClaims)
      .where(
        and(
          eqCol(sessionClaims.sessionId, sessionId),
          eqCol(sessionClaims.playerId, actor.playerId),
          isNull(sessionClaims.releasedAt)
        )
      );
    const claim = claims[0];
    if (!claim) {
      throw new ForbiddenError("No active claim in this session");
    }
    return {
      role: claim.role === "pc" ? "pc" : "ob",
      characterId: claim.characterId ?? null,
    };
  }

  /** 提交后副作用：投递事件、GM 定向消息、关闭连接、刷新在线列表。 */
  private async afterCommit(
    sessionId: string,
    staged: StagedEvents,
    result: CommandHandlerResult
  ): Promise<void> {
    await this.eventBus.deliver(staged);

    for (const message of result.directToGms ?? []) {
      this.connectionRegistry.sendToGms(sessionId, message);
    }
    for (const message of result.directToSession ?? []) {
      this.connectionRegistry.sendToSession(sessionId, message);
    }

    for (const playerId of result.closeConnectionsOfPlayerIds ?? []) {
      this.connectionRegistry.closePlayerConnections(playerId, sessionId);
      result.refreshPresence = true;
    }

    if (result.refreshPresence) {
      await this.presenceService.broadcast(sessionId);
    }
  }

  private reject(command: ClientCommand, err: unknown): CommandReply {
    if (err instanceof AppError) {
      return {
        protocolVersion: 1,
        commandId: command.commandId,
        type: "command:rejected",
        payload: { code: err.code, message: err.message },
      };
    }
    console.error(`[WS] Command ${command.type} (${command.commandId}) failed:`, err);
    return {
      protocolVersion: 1,
      commandId: command.commandId,
      type: "command:rejected",
      payload: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred" },
    };
  }
}
