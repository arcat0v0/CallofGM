import type { BgmState } from "@cogm/shared";

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
  const name = bgm?.name ?? "BGM";
  switch (bgmPlaybackState(bgm)) {
    case "idle":
      return "未播放";
    case "paused":
      return `已暂停 · ${name}`;
    case "faded":
      return `已淡出 · ${name}`;
    default:
      return bgm?.name ?? "BGM 播放中";
  }
}

export function bgmShowsProgress(bgm: BgmState | null): boolean {
  return bgmPlaybackState(bgm) === "playing";
}
