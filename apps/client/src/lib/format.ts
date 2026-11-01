import { SessionPhaseLabel, type SessionPhase, type SessionStatus } from "@cogm/shared";

export const EXPRESSION_LABELS: Record<string, string> = {
  default: "默认",
  smile: "微笑",
  surprised: "惊讶",
  angry: "生气",
  hurt: "受伤",
};

export function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "?";
  }
  const parts = trimmed.split(/\s+/);
  const last = parts[parts.length - 1] ?? trimmed;
  return last.slice(0, 1);
}

export function formatClock(epochMs: number): string {
  const date = new Date(epochMs);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formatDurationMmSs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function statusTone(status: SessionStatus): "success" | "accent" | "warning" | "default" {
  if (status === "active") return "success";
  if (status === "preparing") return "accent";
  if (status === "waiting") return "default";
  return "warning";
}

export function expressionLabel(key: string | null | undefined): string {
  if (!key) {
    return "默认";
  }
  return EXPRESSION_LABELS[key] ?? key;
}

export function nextSessionStatus(status: SessionStatus): SessionStatus | null {
  if (status === "waiting") return "preparing";
  if (status === "preparing") return "active";
  if (status === "active") return "ended";
  return null;
}

export function nextStatusActionLabel(status: SessionStatus): string | null {
  if (status === "waiting") return "进入准备";
  if (status === "preparing") return "开始进行";
  if (status === "active") return "进入控制台";
  return null;
}

export function phaseChatHint(phase: SessionPhase | null, role: "player" | "gm" = "player"): string {
  if (role === "gm") {
    if (phase === "forced_cg") return "强制 CG · 仅主持人可推进演出";
    if (phase === "free_discussion") return "自由讨论 · 玩家发言记为场外";
    if (phase === "performance_time") return "演绎时间 · 玩家角色扮演需你放行后呈现";
    if (phase === "free_performance") return "自由演绎 · 玩家角色扮演经你放行";
    return "以 KP 身份发言 / 旁白";
  }
  if (phase === "forced_cg") return "强制 CG · 全员禁言";
  if (phase === "free_discussion") return "自由讨论 · 发言记为场外";
  if (phase === "performance_time") return "演绎时间 · 角色扮演经主持人放行后呈现";
  if (phase === "free_performance") return "自由演绎 · 每条消息可自选「场外 / 角色扮演」";
  return "连接后即可发言";
}
