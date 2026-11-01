import type { DbClient } from "@/platform/db/client";
import type { Clock, IdGenerator, RandomSource } from "@/platform/ports";
import type { sessions } from "@/platform/db/schema";
import type { ActorContext } from "@/modules/identity";
import type { VisibilityScope } from "../domain/visibility";
import type { ClientCommandType } from "@cogm/shared";
import type { StagedEvents } from "../session-event-bus";

/** 命令处理器产出的事件（由 realtime 核心分配 eventId 并按可见性投递） */
export interface ProducedEvent {
  type: string;
  payload: unknown;
  visibility: VisibilityScope;
}

/** 命令执行上下文。tx 为当前命令所在的短事务，禁止在事务内做慢速 IO。 */
export interface CommandHandlerContext {
  tx: DbClient;
  sessionId: string;
  session: typeof sessions.$inferSelect;
  actor: ActorContext;
  /** 玩家在当前团的有效认领；GM 或未认领玩家为 null */
  seat: { role: "pc" | "ob"; characterId: string | null } | null;
  connectionId: string;
  clock: Clock;
  idGenerator: IdGenerator;
  randomSource: RandomSource;
}

export interface CommandHandlerResult {
  /** 需要分配 eventId 并广播的团事件 */
  events?: ProducedEvent[];
  /** 仅发送给 GM 连接的 DirectControlMessage（无 eventId，不进事件日志） */
  directToGms?: Array<{ type: string; payload: unknown }>;
  /** 向当前团所有在线连接即时发送，不分配 eventId、不写 outbox、不参与重放。 */
  directToSession?: Array<{ type: string; payload: unknown }>;
  /** 提交后需要强制关闭的玩家连接（踢出/拉黑） */
  closeConnectionsOfPlayerIds?: string[];
  /** 为 true 时关闭该玩家全部团的连接（拉黑）；默认只关本团 */
  closeConnectionsGlobally?: boolean;
  /** 提交后向 GM 刷新在线列表 */
  refreshPresence?: boolean;
  /** command:accepted 回执 payload */
  replyPayload?: unknown;
  /**
   * 在事件分配 eventId 之后、同一事务内执行的收尾钩子。
   * 用于把 eventId 写回业务行（如 session_messages.event_id），
   * 并可就地修正事件 payload 中需要 eventId 的字段。
   */
  finalizeAfterStaged?: (tx: DbClient, staged: StagedEvents) => Promise<void>;
}

/**
 * 实时命令处理器。每种命令一个实现，注册到 SessionCommandExecutor。
 * 处理器只处理业务逻辑：校验权限、读写 tx、声明产出事件；
 * eventId 分配、outbox、广播、去重由 realtime 核心统一完成。
 */
export interface CommandHandler {
  readonly type: ClientCommandType;
  /** 已结团的团是否仍允许执行（默认 false，如踢人/拉黑等管理动作可放行） */
  readonly allowWhenEnded?: boolean;
  /** 未结团时允许的团状态；缺省仅 `active` */
  readonly allowedStatuses?: ReadonlyArray<"waiting" | "preparing" | "active">;
  /** 查询型命令：回执不进入去重缓存，避免体积较大的查询结果占用缓存 */
  readonly transientReply?: boolean;
  execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult>;
}
