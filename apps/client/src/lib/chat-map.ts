import { coc7e, type ChatMessageDto } from "@cogm/shared";
import type { ChatMessage } from "@/features/chat/types";
import { formatClock, initialsOf } from "@/lib/format";
import { t } from "@/i18n";

export function mapChatMessage(dto: ChatMessageDto): ChatMessage {
  const isGm = dto.senderType === "gm";
  const speakerName = isGm ? t("common.gmShort") : (dto.characterName ?? t("common.player"));
  return {
    id: dto.id,
    speakerName,
    speakerRoleLabel: isGm ? t("chat.role.gm") : dto.channel === "ooc" ? t("chat.role.ooc") : t("chat.role.pc"),
    avatarInitials: isGm ? "KP" : initialsOf(speakerName),
    avatarBg: isGm ? "bg-accent" : "bg-default",
    avatarFg: isGm ? "text-accent-foreground" : "text-foreground",
    time: formatClock(dto.presentedAt ?? dto.createdAt),
    body: dto.content,
    tone: dto.channel === "ooc" ? "ooc" : "ic",
    isSystem: false,
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
    const name = typeof payload.characterName === "string" && payload.characterName ? payload.characterName : payload.rollerType === "gm" ? t("common.gmShort") : t("common.player");
    const expression = typeof result.expression === "string" ? result.expression : t("chat.role.dice");
    const total = result.total;
    const detail = typeof result.detail === "string" ? result.detail : "";
    const comment = typeof result.comment === "string" ? ` · ${result.comment}` : "";
    const hidden = payload.hidden === true ? t("message.diceHidden") : "";
    return {
      id: `dice-${eventId}`,
      speakerName: name,
      speakerRoleLabel: t("chat.role.dice"),
      avatarInitials: initialsOf(name),
      avatarBg: "bg-default",
      avatarFg: "text-foreground",
      time,
      body: `${expression} = ${String(total)}${detail ? `（${detail}）` : ""}${comment}${hidden}`,
      tone: "ooc",
      isSystem: true,
    };
  }
  if (type === "check:resolved") {
    const result = isRecord(payload.result) ? payload.result : {};
    const name = typeof payload.characterName === "string" ? payload.characterName : t("chat.role.character");
    const skill = typeof payload.skillKey === "string" ? payload.skillKey : t("chat.role.check");
    const hidden = payload.hidden === true ? t("message.diceHidden") : "";
    if (skill === "san") {
      const roll = result.roll;
      const loss = result.loss;
      const after = result.sanAfter;
      const ok = result.success === true ? t("message.outcome.success") : t("message.outcome.failure");
      return {
        id: `check-${eventId}`,
        speakerName: name,
        speakerRoleLabel: t("chat.role.san"),
        avatarInitials: initialsOf(name),
        avatarBg: "bg-default",
        avatarFg: "text-foreground",
        time,
        body: t("message.sanCheck", {
          roll: String(roll),
          outcome: ok,
          loss: String(loss),
          after: String(after),
        }) + hidden,
        tone: "ooc",
        isSystem: true,
      };
    }
    const outcome = typeof result.outcome === "string" ? result.outcome : "";
    const label = (coc7e.CheckOutcomeLabel as Record<string, string>)[outcome] ?? (result.success === true ? t("message.outcome.success") : t("message.outcome.failure"));
    const roll = result.roll;
    const target = result.targetValue;
    return {
      id: `check-${eventId}`,
      speakerName: name,
      speakerRoleLabel: t("chat.role.check"),
      avatarInitials: initialsOf(name),
      avatarBg: "bg-default",
      avatarFg: "text-foreground",
      time,
      body: `${skill} ${String(roll)}/${String(target)} · ${label}${hidden}`,
      tone: "ooc",
      isSystem: true,
    };
  }
  return null;
}
