import { coc7e, type ChatMessageDto, type HistoryItem, type SnapshotCharacter } from "@cogm/shared";
import type { ChatMessage } from "@/features/chat/types";
import { formatClock, initialsOf } from "@/lib/format";
import { t } from "@/i18n";

export function obSpeakerLabel(playerId: string | null | undefined): string {
  return playerId ? t("chat.obWithId", { id: playerId.slice(0, 6) }) : t("common.spectator");
}

export function speakerNameOf(dto: ChatMessageDto): string {
  if (dto.senderType === "gm") {
    return t("common.gmShort");
  }
  if (dto.characterName) {
    return dto.characterName;
  }
  return obSpeakerLabel(dto.senderId);
}

export function speakerInitialsOf(dto: ChatMessageDto): string {
  if (dto.senderType === "gm") {
    return t("common.gmShort");
  }
  return dto.characterName ? initialsOf(dto.characterName) : t("chat.obInitial");
}

export function speakerRoleLabelOf(dto: ChatMessageDto): string {
  if (dto.senderType === "gm") {
    return t("chat.role.gm");
  }
  if (!dto.characterName) {
    return t("common.spectator");
  }
  return dto.channel === "ooc" ? t("chat.role.ooc") : t("chat.role.pc");
}

export function mapChatMessage(dto: ChatMessageDto): ChatMessage {
  const isGm = dto.senderType === "gm";
  const speakerName = speakerNameOf(dto);
  return {
    id: dto.id,
    sortKey: dto.eventId ?? dto.createdAt,
    speakerName,
    speakerRoleLabel: speakerRoleLabelOf(dto),
    avatarInitials: speakerInitialsOf(dto),
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

export function resolveActivityPayload(
  type: string,
  payload: Record<string, unknown>,
  characters: SnapshotCharacter[],
): Record<string, unknown> {
  if (type !== "dice:rolled" || payload.rollerType !== "player") {
    return payload;
  }
  if (typeof payload.rollerId !== "string" || payload.characterName) {
    return payload;
  }
  const roller = characters.find((character) => character.claim?.playerId === payload.rollerId);
  return roller ? { ...payload, characterName: roller.name } : payload;
}

export function mapActivityEvent(type: string, payload: unknown, eventId: number, occurredAt?: number): ChatMessage | null {
  if (!isRecord(payload)) {
    return null;
  }
  const time = formatClock(occurredAt ?? Date.now());
  if (type === "dice:rolled") {
    const result = isRecord(payload.result) ? payload.result : {};
    const name =
      typeof payload.characterName === "string" && payload.characterName
        ? payload.characterName
        : payload.rollerType === "gm"
          ? t("common.gmShort")
          : obSpeakerLabel(typeof payload.rollerId === "string" ? payload.rollerId : null);
    const expression = typeof result.expression === "string" ? result.expression : t("message.diceFallback");
    const total = result.total;
    const detail = typeof result.detail === "string" ? result.detail : "";
    const comment = typeof result.comment === "string" ? ` · ${result.comment}` : "";
    const hidden = payload.hidden === true ? t("message.diceHidden") : "";
    return {
      id: `dice-${eventId}`,
      sortKey: eventId,
      speakerName: name,
      speakerRoleLabel: t("chat.role.dice"),
      avatarInitials: initialsOf(name),
      avatarBg: "bg-default",
      avatarFg: "text-foreground",
      time,
      body: `${expression} = ${String(total)}${detail ? `（${detail}）` : ""}${comment}${hidden}`,
      tone: "ooc",
      isSystem: true,
      hidden: payload.hidden === true,
    };
  }
  if (type === "check:resolved") {
    const result = isRecord(payload.result) ? payload.result : {};
    const name = typeof payload.characterName === "string" ? payload.characterName : t("chat.role.character");
    const skillKey = typeof payload.skillKey === "string" ? payload.skillKey : "";
    const skill = skillKey ? coc7e.coc7eSkillLabel(skillKey) : t("chat.role.check");
    const hidden = payload.hidden === true ? t("message.diceHidden") : "";
    if (skillKey === "san") {
      const roll = result.roll;
      const loss = result.loss;
      const after = result.sanAfter;
      const ok = result.success === true ? t("message.outcome.success") : t("message.outcome.failure");
      return {
        id: `check-${eventId}`,
        sortKey: eventId,
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
        hidden: payload.hidden === true,
        outcome: typeof result.success === "boolean" ? (result.success ? "success" : "failure") : undefined,
      };
    }
    const outcome = typeof result.outcome === "string" ? result.outcome : "";
    const label = (coc7e.CheckOutcomeLabel as Record<string, string>)[outcome] ?? (result.success === true ? t("message.outcome.success") : t("message.outcome.failure"));
    const roll = result.roll;
    const target = result.targetValue;
    const parsedDifficulty = coc7e.CheckDifficulty.safeParse(result.difficulty);
    const difficulty = parsedDifficulty.success ? parsedDifficulty.data : "regular";
    const context =
      typeof target === "number"
        ? difficulty === "regular"
          ? t("message.checkTarget", { target })
          : t("message.checkThreshold", {
              target,
              label: coc7e.CheckDifficultyLabel[difficulty],
              threshold: coc7e.coc7eDifficultyThreshold(target, difficulty),
            })
        : null;
    return {
      id: `check-${eventId}`,
      sortKey: eventId,
      speakerName: name,
      speakerRoleLabel: t("chat.role.check"),
      avatarInitials: initialsOf(name),
      avatarBg: "bg-default",
      avatarFg: "text-foreground",
      time,
      body: `${skill} ${String(roll)}/${String(target)} · ${label}${context ? `（${context}）` : ""}${hidden}`,
      tone: "ooc",
      isSystem: true,
      hidden: payload.hidden === true,
      outcome:
        typeof result.success === "boolean"
          ? result.success
            ? "success"
            : "failure"
          : undefined,
    };
  }
  return null;
}

export function mapHistoryItem(item: HistoryItem, characters: SnapshotCharacter[]): ChatMessage | null {
  if (item.kind === "chat") {
    return mapChatMessage(item.message);
  }
  const payload = isRecord(item.payload) ? resolveActivityPayload(item.type, item.payload, characters) : item.payload;
  return mapActivityEvent(item.type, payload, item.eventId, item.occurredAt);
}