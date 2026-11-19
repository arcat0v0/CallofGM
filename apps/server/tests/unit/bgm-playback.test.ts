import { expect, test } from "bun:test";
import type { BgmState } from "@cogm/shared";
import { BgmPlayback } from "@/modules/sessions/domain/bgm-playback";

test("playback owns its state and snapshots are detached values", () => {
	const original: BgmState = {
		trackId: "track",
		playing: true,
		volume: 100,
		mode: "single",
		seekOffsetMs: 500,
		startedAtMs: 1000,
		version: 7,
		durationMs: 1000,
	};
	const playback = new BgmPlayback(original, 2000);
	const before = playback.toSnapshot();
	original.volume = 5;
	before.trackId = null;
	playback.changeMode("list");
	playback.seek(1200);
	playback.setVolume(42);
	playback.advanceVersion();
	const after = playback.toSnapshot();
	expect(after).toEqual({
		trackId: "track",
		playing: true,
		volume: 42,
		mode: "list",
		seekOffsetMs: 1200,
		startedAtMs: 2000,
		version: 8,
		durationMs: 1000,
	});
	expect(before).toMatchObject({ volume: 100, mode: "single", version: 7 });
	after.playing = false;
	expect(playback.playing).toBe(true);
	expect(playback.position()).toBe(1000);
});
