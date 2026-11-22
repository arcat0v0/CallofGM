import type { TrackSource } from "@cogm/shared";

export function trackPlaybackFormat(source: TrackSource): string {
	return source === "qq" ? "m4a" : "mp3";
}
