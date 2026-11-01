import { z } from "zod";

/**
 * 已注册的客户端命令类型。协议不接受未注册的 type；
 * 每种命令的 payload 由对应模块的 zod schema 单独校验（见 chat/gameplay/stage/handouts/moderation）。
 */
export const ClientCommandType = z.enum([
  "chat:send",
  "chat:release",
  "chat:discard",
  "chat:reorder",
  "dice:roll",
  "check:perform",
  "check:request",
  "check:respond",
  "check:san",
  "state:edit",
  "scene:switch",
  "expression:set",
  "audio:bgm",
  "audio:se",
  "handout:grant",
  "handout:append",
  "handout:read",
  "session:settings",
  "player:kick",
  "player:ban",
  "player:unban",
  /**
   * 保留给集成测试的事件管道探针。
   * 生产环境从不注册该类型的处理器（executor 一律回绝 RULE_ACTION_UNSUPPORTED），
   * 测试环境可通过 Container(commandHandlers) 注入测试处理器验证事件链路。
   */
  "test:command",
]);
export type ClientCommandType = z.infer<typeof ClientCommandType>;

export const ClientCommand = z.object({
  protocolVersion: z.literal(1),
  commandId: z.string().min(1).max(64),
  type: ClientCommandType,
  payload: z.unknown(),
});
export type ClientCommand = z.infer<typeof ClientCommand>;

export const SessionEvent = z.object({
  protocolVersion: z.literal(1),
  eventId: z.number().int(),
  type: z.string(),
  occurredAt: z.number(),
  payload: z.unknown(),
});
export type SessionEvent = z.infer<typeof SessionEvent>;

export const CommandReply = z.object({
  protocolVersion: z.literal(1),
  commandId: z.string(),
  type: z.enum(["command:accepted", "command:rejected"]),
  payload: z.unknown(),
});
export type CommandReply = z.infer<typeof CommandReply>;

export const SessionSnapshot = z.object({
  protocolVersion: z.literal(1),
  type: z.literal("snapshot"),
  watermark: z.number().int(),
  payload: z.unknown(),
});
export type SessionSnapshot = z.infer<typeof SessionSnapshot>;

/** 非持久化控制消息：GM 队列更新、在线列表等。不分配 eventId，不进事件日志。 */
export const DirectControlMessageType = z.enum(["chat:queue", "presence:updated"]);

export const DirectControlMessage = z.object({
  protocolVersion: z.literal(1),
  type: z.string(),
  payload: z.unknown(),
});
export type DirectControlMessage = z.infer<typeof DirectControlMessage>;

export const ServerMessage = z.union([
  SessionEvent,
  CommandReply,
  SessionSnapshot,
  DirectControlMessage,
]);
export type ServerMessage = z.infer<typeof ServerMessage>;
