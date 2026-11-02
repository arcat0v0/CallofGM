import type { PlayChatMessageCtx } from "@cogm/theme-sdk";
import { ChatMessageCard } from "@/features/chat/chat-message-card";

export function PlayChatMessage({ message }: PlayChatMessageCtx) {
  return (
    <ChatMessageCard
      message={message}
      self={message.self}
      continued={message.continued}
      showRoleBadge={message.showRoleBadge}
    />
  );
}
