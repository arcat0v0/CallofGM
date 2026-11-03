import { beforeEach, describe, expect, test } from "bun:test";
import {
	effectiveVolume,
	LOCAL_VOLUME_DEFAULT,
	normalizeLocalVolume,
} from "../src/lib/local-volume";
import {
	LOCAL_VOLUME_KEY,
	readLocalVolume,
	writeLocalVolume,
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

describe("local volume normalization", () => {
	test("keeps integers inside 0-100 and rounds fractional input", () => {
		expect(normalizeLocalVolume(0)).toBe(0);
		expect(normalizeLocalVolume(25)).toBe(25);
		expect(normalizeLocalVolume(100)).toBe(100);
		expect(normalizeLocalVolume(25.6)).toBe(26);
	});

	test("clamps out-of-range values and falls back to the default for non-finite input", () => {
		expect(normalizeLocalVolume(-5)).toBe(0);
		expect(normalizeLocalVolume(140)).toBe(100);
		expect(normalizeLocalVolume(Number.NaN)).toBe(LOCAL_VOLUME_DEFAULT);
		expect(normalizeLocalVolume(Number.POSITIVE_INFINITY)).toBe(
			LOCAL_VOLUME_DEFAULT,
		);
	});
});

describe("effective playback volume", () => {
	test("multiplies the broadcast volume by the local factor", () => {
		expect(
			effectiveVolume({
				broadcastVolume: 80,
				localVolume: 25,
				muted: false,
				isGm: false,
			}),
		).toBeCloseTo(0.2, 10);
		expect(
			effectiveVolume({
				broadcastVolume: 80,
				localVolume: 100,
				muted: false,
				isGm: false,
			}),
		).toBeCloseTo(0.8, 10);
		expect(
			effectiveVolume({
				broadcastVolume: 50,
				localVolume: 50,
				muted: false,
				isGm: false,
			}),
		).toBeCloseTo(0.25, 10);
	});

	test("a zero local factor silences playback without touching mute state", () => {
		expect(
			effectiveVolume({
				broadcastVolume: 100,
				localVolume: 0,
				muted: false,
				isGm: false,
			}),
		).toBe(0);
	});

	test("mute wins over any local or broadcast volume", () => {
		expect(
			effectiveVolume({
				broadcastVolume: 100,
				localVolume: 100,
				muted: true,
				isGm: false,
			}),
		).toBe(0);
		expect(
			effectiveVolume({
				broadcastVolume: 100,
				localVolume: 60,
				muted: true,
				isGm: true,
			}),
		).toBe(0);
	});

	test("the GM ignores the local factor and only follows the broadcast volume", () => {
		expect(
			effectiveVolume({
				broadcastVolume: 80,
				localVolume: 25,
				muted: false,
				isGm: true,
			}),
		).toBeCloseTo(0.8, 10);
		expect(
			effectiveVolume({
				broadcastVolume: 35,
				localVolume: 0,
				muted: false,
				isGm: true,
			}),
		).toBeCloseTo(0.35, 10);
	});

	test("clamps the broadcast volume and tolerates non-finite input", () => {
		expect(
			effectiveVolume({
				broadcastVolume: 140,
				localVolume: 50,
				muted: false,
				isGm: false,
			}),
		).toBeCloseTo(0.5, 10);
		expect(
			effectiveVolume({
				broadcastVolume: Number.NaN,
				localVolume: 50,
				muted: false,
				isGm: false,
			}),
		).toBe(0);
	});
});

describe("local volume persistence", () => {
	let storage: MemoryStorage;

	beforeEach(() => {
		storage = new MemoryStorage();
		Object.defineProperty(globalThis, "localStorage", {
			value: storage,
			configurable: true,
			writable: true,
		});
	});

	test("defaults to 100 when nothing has been stored", () => {
		expect(readLocalVolume()).toBe(LOCAL_VOLUME_DEFAULT);
	});

	test("round-trips the stored percentage", () => {
		writeLocalVolume(25);
		expect(storage.getItem(LOCAL_VOLUME_KEY)).toBe("25");
		expect(readLocalVolume()).toBe(25);
	});

	test("normalizes a corrupted or out-of-range stored value", () => {
		storage.setItem(LOCAL_VOLUME_KEY, "loud");
		expect(readLocalVolume()).toBe(LOCAL_VOLUME_DEFAULT);
		storage.setItem(LOCAL_VOLUME_KEY, "");
		expect(readLocalVolume()).toBe(LOCAL_VOLUME_DEFAULT);
		storage.setItem(LOCAL_VOLUME_KEY, "250");
		expect(readLocalVolume()).toBe(100);
		storage.setItem(LOCAL_VOLUME_KEY, "-3");
		expect(readLocalVolume()).toBe(0);
	});

	test("survives a missing localStorage implementation", () => {
		Object.defineProperty(globalThis, "localStorage", {
			value: undefined,
			configurable: true,
			writable: true,
		});
		expect(readLocalVolume()).toBe(LOCAL_VOLUME_DEFAULT);
		expect(() => writeLocalVolume(40)).not.toThrow();
	});
});

describe("play-store local volume", () => {
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

	test("setLocalVolume updates the state and persists the clamped value", () => {
		usePlayStore.getState().setLocalVolume(25);
		expect(usePlayStore.getState().localVolume).toBe(25);
		expect(storage.getItem(LOCAL_VOLUME_KEY)).toBe("25");

		usePlayStore.getState().setLocalVolume(140);
		expect(usePlayStore.getState().localVolume).toBe(100);
		expect(storage.getItem(LOCAL_VOLUME_KEY)).toBe("100");
	});

	test("reset keeps the persisted preference instead of the in-memory value", () => {
		writeLocalVolume(35);
		usePlayStore.getState().setLocalVolume(35);
		usePlayStore.getState().reset();
		expect(usePlayStore.getState().localVolume).toBe(35);
	});

	test("mute stays independent from the local volume", () => {
		usePlayStore.getState().setLocalVolume(0);
		usePlayStore.getState().setMuted(true);
		expect(usePlayStore.getState().localVolume).toBe(0);
		expect(usePlayStore.getState().muted).toBe(true);

		usePlayStore.getState().setLocalVolume(80);
		expect(usePlayStore.getState().muted).toBe(true);
		usePlayStore.getState().setMuted(false);
		expect(usePlayStore.getState().localVolume).toBe(80);
	});
});
