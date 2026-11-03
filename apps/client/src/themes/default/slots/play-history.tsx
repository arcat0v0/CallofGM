import type { PlayHistoryCtx } from "@cogm/theme-sdk";
import { PlayerHistoryOverlay } from "@/features/history/player-history-overlay";

export function PlayHistory(props: PlayHistoryCtx) {
  return <PlayerHistoryOverlay {...props} />;
}
