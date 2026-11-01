import type { MessageChannel, SeatRole, SessionPhase } from "./session";

export type MessageDecision =
  | { kind: "immediate"; channel: MessageChannel }
  | { kind: "queued"; channel: MessageChannel }
  | { kind: "forbidden" };

export function decideChatMessage(
  phase: SessionPhase,
  actorType: "gm" | "player",
  seatRole: SeatRole | null,
  channel: MessageChannel,
): MessageDecision {
  if (actorType === "gm") {
    return { kind: "immediate", channel };
  }

  const role: SeatRole = seatRole ?? "ob";

  if (role === "pc") {
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
  actorType: "gm" | "player",
  seatRole: SeatRole | null,
): boolean {
  if (actorType === "player" && seatRole === "ob") return false;
  return decideChatMessage(phase, actorType, seatRole, "ooc").kind !== "forbidden";
}