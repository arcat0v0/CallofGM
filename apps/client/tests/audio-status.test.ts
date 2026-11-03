import { beforeEach, describe, expect, test } from "bun:test";
import type { BgmState } from "@cogm/shared";
import {
	bgmPlaybackState,
	bgmShowsProgress,
	bgmStatusLabel,
} from "../src/lib/audio-status";
import {
	LOCAL_MUTED_KEY,
	readLocalMuted,
	writeLocalMuted,
} from "../src/lib/storage";
import { usePlayStore } from "../src/stores/play-store";

class MemoryStorage implements Storage {
	private store = new Map<string, string>();
	get length(): number {
		return this.store.size;
	}
	clear(): void {
		this.store.clear();
	}
	getItem(key: string): string | null {
		return this.store.get(key) ?? null;
	}
	key(index: number): string | null {
		return [...this.store.keys()][index] ?? null;
	}
	removeItem(key: string): void {
		this.store.delete(key);
	}
	setItem(key: string, value: string): void {
		this.store.set(key, value);
	}
}

function bgm(overrides: Partial<BgmState> = {}): BgmState {
	return {
		trackId: "track-1",
		playing: true,
		volume: 64,
		loop: true,
		seekOffsetMs: 0,
		startedAtMs: 0,
		version: 1,
		name: "海雾低鸣",
		...overrides,
	};
}

describe("bgm playback status", () => {
	test("no track means idle", () => {
		expect(bgmPlaybackState(null)).toBe("idle");
		expect(bgmStatusLabel(null)).toBe("未播放");
		expect(bgmPlaybackState(bgm({ trackId: null, playing: false }))).toBe(
			"idle",
		);
	});

	test("keeps the track name when the GM pauses", () => {
		const paused = bgm({ playing: false });
		expect(bgmPlaybackState(paused)).toBe("paused");
		expect(bgmStatusLabel(paused)).toBe("已暂停 · 海雾低鸣");
	});

	test("volume zero while playing is a fade, not a stop", () => {
		const faded = bgm({ volume: 0 });
		expect(bgmPlaybackState(faded)).toBe("faded");
		expect(bgmStatusLabel(faded)).toBe("已淡出 · 海雾低鸣");
	});

	test("playing with volume reports the track name", () => {
		const playing = bgm();
		expect(bgmPlaybackState(playing)).toBe("playing");
		expect(bgmStatusLabel(playing)).toBe("海雾低鸣");
		expect(bgmStatusLabel(bgm({ name: undefined }))).toBe("BGM 播放中");
	});

	test("progress is only meaningful while actually playing", () => {
		expect(bgmShowsProgress(bgm())).toBe(true);
		expect(bgmShowsProgress(bgm({ playing: false }))).toBe(false);
		expect(bgmShowsProgress(bgm({ volume: 0 }))).toBe(false);
		expect(bgmShowsProgress(null)).toBe(false);
	});
});

describe("mute persistence", () => {
	let storage: MemoryStorage;

	beforeEach(() => {
		storage = new MemoryStorage();
		Object.defineProperty(globalThis, "localStorage", {
			value: storage,
			configurable: true,
			writable: true,
		});
		usePlayStore.getState().reset();
	});

	test("defaults to unmuted when nothing is stored", () => {
		expect(readLocalMuted()).toBe(false);
		expect(usePlayStore.getState().muted).toBe(false);
	});

	test("setMuted persists the per-device preference", () => {
		usePlayStore.getState().setMuted(true);
		expect(usePlayStore.getState().muted).toBe(true);
		expect(storage.getItem(LOCAL_MUTED_KEY)).toBe("1");

		usePlayStore.getState().setMuted(false);
		expect(storage.getItem(LOCAL_MUTED_KEY)).toBe("0");
	});

	test("reset restores the stored preference instead of unmuting", () => {
		writeLocalMuted(true);
		usePlayStore.getState().setMuted(true);
		usePlayStore.getState().reset();
		expect(usePlayStore.getState().muted).toBe(true);
	});

	test("mute stays independent from the local volume", () => {
		usePlayStore.getState().setMuted(true);
		usePlayStore.getState().setLocalVolume(80);
		expect(usePlayStore.getState().muted).toBe(true);
		expect(usePlayStore.getState().localVolume).toBe(80);

		usePlayStore.getState().setMuted(false);
		expect(usePlayStore.getState().localVolume).toBe(80);
	});
});
