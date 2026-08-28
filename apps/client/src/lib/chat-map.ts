import { coc7e, type ChatMessageDto } from "@cogm/shared";
import type { ChatMessage } from "@/features/chat/types";
import { formatClock, initialsOf } from "@/lib/format";

export function mapChatMessage(dto: ChatMessageDto): ChatMessage {
  const isGm = dto.senderType === "gm";
  const speakerName = isGm ? "KP" : (dto.characterName ?? "玩家");
  return {
    id: dto.id,
    speakerName,
    speakerRoleLabel: isGm ? "主持人" : dto.channel === "ooc" ? "场外" : "PC",
    avatarInitials: isGm ? "KP" : initialsOf(speakerName),
    avatarBg: isGm ? "bg-accent" : "bg-default",
    avatarFg: isGm ? "text-accent-foreground" : "text-foreground",
    time: formatClock(dto.presentedAt ?? dto.createdAt),
    body: dto.content,
    tone: dto.channel === "ooc" ? "ooc" : "ic",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function mapActivityEvent(type: string, payload: unknown, eventId: number, occurredAt?: number): ChatMessage | null {
  if (!isRecord(payload)) {
    return null;
  }
  const time = formatClock(occurredAt ?? Date.now());
  if (type === "dice:rolled") {
    const result = isRecord(payload.result) ? payload.result : {};
    const name = typeof payload.characterName === "string" && payload.characterName ? payload.characterName : payload.rollerType === "gm" ? "KP" : "玩家";
    const expression = typeof result.expression === "string" ? result.expression : "骰点";
    const total = result.total;
    const detail = typeof result.detail === "string" ? result.detail : "";
    const comment = typeof result.comment === "string" ? ` · ${result.comment}` : "";
    const hidden = payload.hidden === true ? "（暗骰）" : "";
    return {
      id: `dice-${eventId}`,
      speakerName: name,
      speakerRoleLabel: "骰点",
      avatarInitials: initialsOf(name),
      avatarBg: "bg-default",
      avatarFg: "text-foreground",
      time,
      body: `${expression} = ${String(total)}${detail ? `（${detail}）` : ""}${comment}${hidden}`,
      tone: "ooc",
    };
  }
  if (type === "check:resolved") {
    const result = isRecord(payload.result) ? payload.result : {};
    const name = typeof payload.characterName === "string" ? payload.characterName : "角色";
    const skill = typeof payload.skillKey === "string" ? payload.skillKey : "鉴定";
    const hidden = payload.hidden === true ? "（暗骰）" : "";
    if (skill === "san") {
      const roll = result.roll;
      const loss = result.loss;
      const after = result.sanAfter;
      const ok = result.success === true ? "成功" : "失败";
      return {
        id: `check-${eventId}`,
        speakerName: name,
        speakerRoleLabel: "SAN",
        avatarInitials: initialsOf(name),
        avatarBg: "bg-default",
        avatarFg: "text-foreground",
        time,
        body: `理智检定 ${String(roll)} · ${ok} · 损失 ${String(loss)} → SAN ${String(after)}${hidden}`,
        tone: "ooc",
      };
    }
    const outcome = typeof result.outcome === "string" ? result.outcome : "";
    const label = (coc7e.CheckOutcomeLabel as Record<string, string>)[outcome] ?? (result.success === true ? "成功" : "失败");
    const roll = result.roll;
    const target = result.targetValue;
    return {
      id: `check-${eventId}`,
      speakerName: name,
      speakerRoleLabel: "鉴定",
      avatarInitials: initialsOf(name),
      avatarBg: "bg-default",
      avatarFg: "text-foreground",
      time,
      body: `${skill} ${String(roll)}/${String(target)} · ${label}${hidden}`,
      tone: "ooc",
    };
  }
  return null;
}
