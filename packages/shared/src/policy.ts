import type { MessageChannel, SeatRole, SessionPhase } from "./session";

export type MessageDecision =
  | { kind: "immediate"; channel: MessageChannel }
  | { kind: "queued"; channel: MessageChannel }
  | { kind: "forbidden" };

/**
 * 发言裁决的观察者身份：GM、持 PC/OB 席位的玩家、以及不占座位的管理员。
 * 判定与席位无关，服务端据此拒绝命令，前端用同一函数只做输入禁用。
 */
export type SpeakerRole = "gm" | "player" | "admin";

export function decideChatMessage(
  phase: SessionPhase,
  actorType: SpeakerRole,
  seatRole: SeatRole | null,
  channel: MessageChannel,
): MessageDecision {
  if (actorType === "gm") {
    return { kind: "immediate", channel };
  }

  const role: SeatRole = seatRole ?? "ob";

  if (actorType === "player" && role === "pc") {
    switch (phase) {
      case "free_discussion":
        return { kind: "immediate", channel: "ooc" };
      case "performance_time":
        return channel === "roleplay" ? { kind: "queued", channel: "roleplay" } : { kind: "forbidden" };
      case "forced_cg":
        return { kind: "forbidden" };
      case "free_performance":
        return channel === "roleplay"
          ? { kind: "queued", channel: "roleplay" }
          : { kind: "immediate", channel: "ooc" };
    }
  }

  switch (phase) {
    case "free_discussion":
    case "free_performance":
      return { kind: "queued", channel: "ooc" };
    case "performance_time":
    case "forced_cg":
      return { kind: "forbidden" };
  }
}

export function canPlayerInitiateDiceRoll(
  phase: SessionPhase,
  actorType: SpeakerRole,
  seatRole: SeatRole | null,
): boolean {
  if (actorType !== "gm" && seatRole === "ob") return false;
  return decideChatMessage(phase, actorType, seatRole, "ooc").kind !== "forbidden";
}