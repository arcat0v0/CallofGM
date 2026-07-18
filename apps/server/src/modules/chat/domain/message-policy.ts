import type { SessionPhase, MessageChannel } from "@cogm/shared";

export type MessageDecision =
  | { kind: "immediate"; channel: MessageChannel }
  | { kind: "queued"; channel: MessageChannel }
  | { kind: "forbidden" };

export type SeatRole = "pc" | "ob";

/**
 * 发言权限矩阵（表驱动，服务端权威）：
 *
 * | 阶段     | PC OOC   | PC RP          | OB OOC  | GM       |
 * |---------|----------|----------------|---------|----------|
 * | 自由讨论 | 立即呈现  | 强制记为 OOC    | 入队     | 立即呈现  |
 * | 演绎时间 | 禁止      | 入队            | 禁止     | 立即呈现  |
 * | 强制 CG | 禁止      | 禁止            | 禁止     | 立即呈现  |
 * | 自由演绎 | 立即呈现  | 入队            | 入队     | 立即呈现  |
 *
 * OB 的发言一律为场外性质；自由讨论阶段所有消息一律记为场外。
 */
export function decideChatMessage(
  phase: SessionPhase,
  actorType: "gm" | "player",
  seatRole: SeatRole | null,
  channel: MessageChannel
): MessageDecision {
  if (actorType === "gm") {
    return { kind: "immediate", channel };
  }

  const role: SeatRole = seatRole ?? "ob";

  if (role === "pc") {
    switch (phase) {
      case "free_discussion":
        // 自由讨论：所有消息一律记为场外
        return { kind: "immediate", channel: "ooc" };
      case "performance_time":
        return channel === "roleplay"
          ? { kind: "queued", channel: "roleplay" }
          : { kind: "forbidden" };
      case "forced_cg":
        return { kind: "forbidden" };
      case "free_performance":
        return channel === "roleplay"
          ? { kind: "queued", channel: "roleplay" }
          : { kind: "immediate", channel: "ooc" };
    }
  }

  // OB：所有发言一律记为场外，且必须经 GM 放行（演绎时间/强制 CG 禁言）
  switch (phase) {
    case "free_discussion":
    case "free_performance":
      return { kind: "queued", channel: "ooc" };
    case "performance_time":
    case "forced_cg":
      return { kind: "forbidden" };
  }
}

/**
 * 玩家自主掷骰视同场外发言：复用发言权限矩阵判断。
 * 响应 GM 鉴定请求不走此判定（不受阶段限制）；GM 任何阶段都可掷骰。
 */
export function canPlayerInitiateDiceRoll(
  phase: SessionPhase,
  actorType: "gm" | "player",
  seatRole: SeatRole | null
): boolean {
  // OB 的场外发言需要 GM 放行，而骰点不能进入演绎队列，因此不允许自主掷骰。
  if (actorType === "player" && seatRole === "ob") return false;
  return decideChatMessage(phase, actorType, seatRole, "ooc").kind !== "forbidden";
}
