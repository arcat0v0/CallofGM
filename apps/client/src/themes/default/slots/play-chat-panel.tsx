import type { PlayChatPanelCtx } from "@cogm/theme-sdk";
import { PlayerChatPanel } from "@/features/play/player-chat-panel";

export function PlayChatPanel({
  sessionId,
  variant,
  compact,
  onCollapse,
  onOpenHistory,
}: PlayChatPanelCtx) {
  return (
    <PlayerChatPanel
      sessionId={sessionId}
      variant={variant}
      compact={compact}
      onCollapse={onCollapse}
      onOpenHistory={onOpenHistory}
    />
  );
}