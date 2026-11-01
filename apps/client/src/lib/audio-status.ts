import type { BgmState } from "@cogm/shared";
import { t } from "@/i18n";

export type BgmPlaybackState = "idle" | "playing" | "paused" | "faded";

export function bgmPlaybackState(bgm: BgmState | null): BgmPlaybackState {
  if (!bgm || bgm.trackId === null) {
    return "idle";
  }
  if (!bgm.playing) {
    return "paused";
  }
  return bgm.volume <= 0 ? "faded" : "playing";
}

export function bgmStatusLabel(bgm: BgmState | null): string {
  const name = bgm?.name ?? t("stage.bgm");
  switch (bgmPlaybackState(bgm)) {
    case "idle":
      return t("stage.bgmNone");
    case "paused":
      return t("stage.bgmPaused", { name });
    case "faded":
      return t("stage.bgmFaded", { name });
    default:
      return bgm?.name ?? t("stage.bgmPlaying");
  }
}

export function bgmShowsProgress(bgm: BgmState | null): boolean {
  return bgmPlaybackState(bgm) === "playing";
}
