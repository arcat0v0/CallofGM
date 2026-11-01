import { coc7e, type ChatMessageDto, type HistoryItem, type SnapshotCharacter } from "@cogm/shared";
import type { ChatMessage } from "@/features/chat/types";
import { formatClock, initialsOf } from "@/lib/format";

export function obSpeakerLabel(playerId: string | null | undefined): string {
  return playerId ? `观战 · ${playerId.slice(0, 6)}` : "观战";
}

export function speakerNameOf(dto: ChatMessageDto): string {
  if (dto.senderType === "gm") {
    return "KP";
  }
  if (dto.characterName) {
    return dto.characterName;
  }
  return obSpeakerLabel(dto.senderId);
}

export function speakerInitialsOf(dto: ChatMessageDto): string {
  if (dto.senderType === "gm") {
    return "KP";
  }
  return dto.characterName ? initialsOf(dto.characterName) : "观";
}

export function speakerRoleLabelOf(dto: ChatMessageDto): string {
  if (dto.senderType === "gm") {
    return "主持人";
  }
  if (!dto.characterName) {
    return "观战";
  }
  return dto.channel === "ooc" ? "场外" : "PC";
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
          ? "KP"
          : obSpeakerLabel(typeof payload.rollerId === "string" ? payload.rollerId : null);
    const expression = typeof result.expression === "string" ? result.expression : "骰点";
    const total = result.total;
    const detail = typeof result.detail === "string" ? result.detail : "";
    const comment = typeof result.comment === "string" ? ` · ${result.comment}` : "";
    const hidden = payload.hidden === true ? "（暗骰）" : "";
    return {
      id: `dice-${eventId}`,
      sortKey: eventId,
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
    const skillKey = typeof payload.skillKey === "string" ? payload.skillKey : "";
    const skill = skillKey ? coc7e.coc7eSkillLabel(skillKey) : "鉴定";
    const hidden = payload.hidden === true ? "（暗骰）" : "";
    if (skillKey === "san") {
      const roll = result.roll;
      const loss = result.loss;
      const after = result.sanAfter;
      const ok = result.success === true ? "成功" : "失败";
      return {
        id: `check-${eventId}`,
        sortKey: eventId,
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
    const parsedDifficulty = coc7e.CheckDifficulty.safeParse(result.difficulty);
    const difficulty = parsedDifficulty.success ? parsedDifficulty.data : "regular";
    const context =
      typeof target === "number"
        ? difficulty === "regular"
          ? `目标值 ${target}`
          : `目标值 ${target} · ${coc7e.CheckDifficultyLabel[difficulty]}阈值 ${coc7e.coc7eDifficultyThreshold(target, difficulty)}`
        : null;
    return {
      id: `check-${eventId}`,
      sortKey: eventId,
      speakerName: name,
      speakerRoleLabel: "鉴定",
      avatarInitials: initialsOf(name),
      avatarBg: "bg-default",
      avatarFg: "text-foreground",
      time,
      body: `${skill} ${String(roll)}/${String(target)} · ${label}${context ? `（${context}）` : ""}${hidden}`,
      tone: "ooc",
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