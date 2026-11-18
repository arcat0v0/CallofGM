import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { BgmState, SePlayedEvent } from "@cogm/shared";
import { fireEvent, renderHook } from "@testing-library/react";
import { currentBgmPosition, useBgmPlayback } from "../src/lib/bgm";

const bgmCommands: Array<{ type: string; payload: Record<string, unknown> }> =
	[];
mock.module("@/lib/session-socket", () => ({
	sendSessionCommand: (type: string, payload: Record<string, unknown>) => {
		bgmCommands.push({ type, payload });
		return `bgm-command-${bgmCommands.length}`;
	},
}));

class FakeHowl {
	static instances: FakeHowl[] = [];
	readonly options: Record<string, unknown>;
	readonly fadeCalls: Array<[number, number, number]> = [];
	readonly unload = mock(() => undefined);
	readonly play = mock(() => {
		this.isPlaying = true;
		return 1;
	});
	readonly pause = mock(() => {
		this.isPlaying = false;
		return this;
	});
	isPlaying = false;
	private currentVolume: number;
	private currentSeek = 0;
	private looping = false;
	private listeners = new Map<string, () => void>();

	constructor(options: Record<string, unknown>) {
		this.options = options;
		this.currentVolume = Number(options.volume ?? 1);
		this.looping = Boolean(options.loop);
		FakeHowl.instances.push(this);
	}

	state() {
		return "loaded";
	}

	volume(value?: number) {
		if (value === undefined) return this.currentVolume;
		this.currentVolume = value;
		return this;
	}

	loop(value?: boolean) {
		if (value === undefined) return this.looping;
		this.looping = value;
		return this;
	}

	seek(value?: number) {
		if (value === undefined) return this.currentSeek;
		this.currentSeek = value;
		return this;
	}

	playing() {
		return this.isPlaying;
	}

	fade(from: number, to: number, duration: number) {
		this.fadeCalls.push([from, to, duration]);
		this.currentVolume = to;
		return this;
	}

	once(event: string, listener: () => void) {
		this.listeners.set(event, listener);
		return this;
	}

	finish() {
		this.listeners.get("end")?.();
	}
}

mock.module("howler", () => ({ Howl: FakeHowl }));

function bgm(overrides: Partial<BgmState> = {}): BgmState {
	return {
		trackId: "track-a",
		playing: true,
		volume: 80,
		mode: "off",
		seekOffsetMs: 10_000,
		startedAtMs: Date.now() - 2_000,
		version: 1,
		durationMs: 60_000,
		audioAssetId: "asset-a",
		...overrides,
	};
}

function firstHowl() {
	const howl = FakeHowl.instances[0];
	if (!howl) {
		throw new Error("Expected a Howl instance");
	}
	return howl;
}

beforeEach(() => {
	FakeHowl.instances.length = 0;
	bgmCommands.length = 0;
});

describe("BGM position and Howler synchronization", () => {
	test("unlocks audio with an explicit WAV format", () => {
		renderHook(() => useBgmPlayback(null, null));
		fireEvent.pointerDown(window);
		const unlock = firstHowl();
		expect(unlock.options.format).toEqual(["wav"]);
		expect(unlock.play).toHaveBeenCalledTimes(1);
		expect(unlock.unload).toHaveBeenCalledTimes(1);
	});

	test("derives paused, looping and ended positions", () => {
		const now = Date.now();
		expect(currentBgmPosition(bgm({ playing: false }), now)).toBe(10_000);
		expect(
			currentBgmPosition(
				bgm({ mode: "single", seekOffsetMs: 58_000, startedAtMs: now - 4_000 }),
				now,
			),
		).toBe(2_000);
		expect(
			currentBgmPosition(
				bgm({ seekOffsetMs: 58_000, startedAtMs: now - 4_000 }),
				now,
			),
		).toBe(60_000);
	});

	test("plays at the authoritative offset and pauses without recreating the asset", () => {
		const initial = bgm({ audioMimeType: "audio/wav" });
		const hook = renderHook(
			({ state }) =>
				useBgmPlayback(state, "/api/v1/media/asset-a", null, undefined, {
					isGm: true,
				}),
			{ initialProps: { state: initial } },
		);
		const howl = firstHowl();
		expect(howl.options.src).toEqual(["/api/v1/media/asset-a"]);
		expect(howl.options.format).toEqual(["wav"]);
		expect(howl.seek()).toBeGreaterThanOrEqual(12);
		expect(howl.play).toHaveBeenCalledTimes(1);
		hook.rerender({
			state: bgm({ playing: false, seekOffsetMs: 12_000, version: 2 }),
		});
		expect(FakeHowl.instances).toHaveLength(1);
		expect(howl.pause).toHaveBeenCalledTimes(1);
		hook.rerender({
			state: bgm({
				playing: true,
				seekOffsetMs: 30_000,
				startedAtMs: Date.now(),
				version: 3,
			}),
		});
		expect(howl.seek()).toBeGreaterThanOrEqual(30);
		expect(howl.play).toHaveBeenCalledTimes(2);
	});

	test("applies loop, volume transitions and asset replacement cleanup", () => {
		const hook = renderHook(
			({ state, asset, transitionMs }) =>
				useBgmPlayback(state, asset, null, undefined, {
					isGm: true,
					transitionMs,
				}),
			{
				initialProps: {
					state: bgm(),
					asset: "/api/v1/media/asset-a",
					transitionMs: 400,
				},
			},
		);
		const first = firstHowl();
		hook.rerender({
			state: bgm({ mode: "single", volume: 30, version: 2 }),
			asset: "/api/v1/media/asset-a",
			transitionMs: 1_000,
		});
		expect(first.loop()).toBe(true);
		expect(first.fadeCalls.at(-1)).toEqual([0.8, 0.3, 1_000]);
		hook.rerender({
			state: bgm({ trackId: "track-b", version: 3 }),
			asset: "/api/v1/media/asset-b",
			transitionMs: 400,
		});
		expect(first.unload).toHaveBeenCalledTimes(1);
		expect(FakeHowl.instances).toHaveLength(2);
		hook.unmount();
		expect(FakeHowl.instances[1]?.unload).toHaveBeenCalledTimes(1);
	});

	test("GM reports non-looping endings once using the latest BGM version", () => {
		const initial = bgm({ mode: "list" });
		const hook = renderHook(
			({ state }) =>
				useBgmPlayback(state, "/api/v1/media/asset-a", null, undefined, {
					isGm: true,
				}),
			{ initialProps: { state: initial } },
		);
		const howl = firstHowl();
		hook.rerender({
			state: { ...initial, mode: "shuffle", volume: 45, version: 2 },
		});
		const ended = howl.options.onend as () => void;
		ended();
		ended();
		expect(bgmCommands).toEqual([
			{ type: "audio:bgm", payload: { action: "ended", expectedVersion: 2 } },
		]);
		hook.rerender({
			state: { ...initial, mode: "shuffle", volume: 30, version: 3 },
		});
		expect(bgmCommands.at(-1)?.payload).toEqual({
			action: "ended",
			expectedVersion: 3,
		});
		expect(howl.play).toHaveBeenCalledTimes(1);
	});

	test.each([
		{ mode: "single" as const, isGm: true },
		{ mode: "list" as const, isGm: false },
	])(
		"does not send endings for single repeat or a player ($mode, $isGm)",
		({ mode, isGm }) => {
			renderHook(() =>
				useBgmPlayback(
					bgm({ mode }),
					"/api/v1/media/asset-a",
					null,
					undefined,
					{ isGm },
				),
			);
			(firstHowl().options.onend as () => void)();
			expect(bgmCommands).toHaveLength(0);
		},
	);

	test("ignores a disposed track's end callback", () => {
		const hook = renderHook(
			({ state, asset }) =>
				useBgmPlayback(state, asset, null, undefined, { isGm: true }),
			{
				initialProps: {
					state: bgm({ mode: "list" }),
					asset: "/api/v1/media/asset-a",
				},
			},
		);
		const oldEnd = firstHowl().options.onend as () => void;
		hook.rerender({
			state: bgm({ trackId: "track-b", mode: "list", version: 2 }),
			asset: "/api/v1/media/asset-b",
		});
		oldEnd();
		expect(bgmCommands).toHaveLength(0);
	});

	test("reconnect retries an end report whose acknowledgement was lost", () => {
		const state = bgm({ mode: "list" });
		const hook = renderHook(
			({ connected }) =>
				useBgmPlayback(state, "/api/v1/media/asset-a", null, undefined, {
					isGm: true,
					connected,
				}),
			{ initialProps: { connected: true } },
		);
		(firstHowl().options.onend as () => void)();
		expect(bgmCommands).toHaveLength(1);
		hook.rerender({ connected: false });
		hook.rerender({ connected: true });
		expect(bgmCommands).toHaveLength(2);
		expect(bgmCommands[1]?.payload).toEqual({
			action: "ended",
			expectedVersion: state.version,
		});
	});

	test("an end while offline is reported only after reconnect", () => {
		const state = bgm({ mode: "off" });
		const hook = renderHook(
			({ connected }) =>
				useBgmPlayback(state, "/api/v1/media/asset-a", null, undefined, {
					isGm: true,
					connected,
				}),
			{ initialProps: { connected: false } },
		);
		(firstHowl().options.onend as () => void)();
		expect(bgmCommands).toHaveLength(0);
		hook.rerender({ connected: true });
		expect(bgmCommands).toHaveLength(1);
	});

	test("a completed reconnect snapshot requests the next authoritative state without replaying", () => {
		renderHook(() =>
			useBgmPlayback(
				bgm({ mode: "list", startedAtMs: Date.now() - 90_000 }),
				"/api/v1/media/asset-a",
				null,
				undefined,
				{ isGm: true },
			),
		);
		expect(firstHowl().play).not.toHaveBeenCalled();
		expect(bgmCommands).toHaveLength(1);
	});

	test("paused playback ignores a delayed end callback", () => {
		const initial = bgm({ mode: "list" });
		const hook = renderHook(
			({ state }) =>
				useBgmPlayback(state, "/api/v1/media/asset-a", null, undefined, {
					isGm: true,
				}),
			{ initialProps: { state: initial } },
		);
		hook.rerender({ state: { ...initial, playing: false, version: 2 } });
		(firstHowl().options.onend as () => void)();
		expect(bgmCommands).toHaveLength(0);
	});

	test("uses same-origin platform streams and retries a failed load", () => {
		const onPlaybackStatus = mock(() => undefined);
		const source = "/api/v1/music/tracks/track-a/stream";
		const hook = renderHook(
			({ retryRevision }) =>
				useBgmPlayback(bgm(), source, null, undefined, {
					isGm: true,
					retryRevision,
					onPlaybackStatus,
				}),
			{ initialProps: { retryRevision: 0 } },
		);
		const first = firstHowl();
		expect(first.options.src).toEqual([source]);
		expect(first.options.format).toEqual(["mp3"]);
		const onLoadError = first.options.onloaderror as
			| ((id: number, error: unknown) => void)
			| undefined;
		onLoadError?.(1, "failed");
		expect(onPlaybackStatus).toHaveBeenCalledWith("error");
		hook.rerender({ retryRevision: 1 });
		expect(first.unload).toHaveBeenCalledTimes(1);
		expect(FakeHowl.instances).toHaveLength(2);
		expect(FakeHowl.instances[1]?.options.src).toEqual([source]);
	});

	test("plays a one-shot SE, updates its local volume and unloads on end", () => {
		const cue: SePlayedEvent = {
			trackId: "se-door",
			volume: 80,
			audioAssetId: "asset-door",
			audioMimeType: "audio/ogg",
		};
		const played = mock(() => undefined);
		const hook = renderHook(
			({ localVolume }) =>
				useBgmPlayback(null, null, cue, played, { localVolume, isGm: false }),
			{ initialProps: { localVolume: 100 } },
		);
		const se = firstHowl();
		expect(se.options.format).toEqual(["ogg"]);
		expect(se.play).toHaveBeenCalledTimes(1);
		expect(se.volume()).toBe(0.8);
		expect(played).toHaveBeenCalledTimes(1);
		hook.rerender({ localVolume: 50 });
		expect(se.volume()).toBe(0.4);
		se.finish();
		expect(se.unload).toHaveBeenCalledTimes(1);
	});
});
