import type { ChatMessageDto } from "@cogm/shared";
import type { ChatMessage } from "@/features/chat/types";
import { formatClock, initialsOf } from "@/lib/format";

export function toChatMessages(messages: ChatMessageDto[]): ChatMessage[] {
  return messages.map((message) => {
    const isGm = message.senderType === "gm";
    const name = isGm ? "KP" : (message.characterName ?? "OB");
    return {
      id: message.id,
      speakerName: name,
      speakerRoleLabel: isGm ? "主持人" : message.channel === "roleplay" ? "PC" : "场外",
      avatarInitials: isGm ? "KP" : initialsOf(name),
      avatarBg: isGm ? "bg-accent" : "bg-default",
      avatarFg: isGm ? "text-accent-foreground" : "text-foreground",
      time: formatClock(message.presentedAt ?? message.createdAt),
      body: message.content,
      tone: message.channel === "ooc" ? "ooc" : "ic",
    };
  });
}

export function filterChat(messages: ChatMessage[], channel: string): ChatMessage[] {
  if (channel === "ic") {
    return messages.filter((message) => message.tone !== "ooc");
  }
  if (channel === "ooc") {
    return messages.filter((message) => message.tone === "ooc");
  }
  return messages;
}
