import { beforeEach, describe, expect, test } from "bun:test";
import {
  PLAY_DISPLAY_DEFAULTS,
  PLAY_DISPLAY_KEY,
  readPlayDisplay,
  writePlayDisplay,
} from "../src/lib/storage";
import { usePlayDisplayStore } from "../src/stores/play-display-store";

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

describe("play display preferences", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    Object.defineProperty(globalThis, "localStorage", {
      value: storage,
      configurable: true,
      writable: true,
    });
    usePlayDisplayStore.getState().reset();
  });

  test("defaults to every component visible", () => {
    expect(readPlayDisplay()).toEqual(PLAY_DISPLAY_DEFAULTS);
  });

  test("ignores invalid JSON and non-boolean stored values", () => {
    storage.setItem(PLAY_DISPLAY_KEY, "{");
    expect(readPlayDisplay()).toEqual(PLAY_DISPLAY_DEFAULTS);

    storage.setItem(
      PLAY_DISPLAY_KEY,
      JSON.stringify({ audio: "no", dialogue: false, unknown: true }),
    );
    expect(readPlayDisplay()).toEqual({ ...PLAY_DISPLAY_DEFAULTS, dialogue: false });
  });

  test("reads a complete stored record", () => {
    const settings = { ...PLAY_DISPLAY_DEFAULTS, sceneInfo: false, handoutPrompt: false };
    writePlayDisplay(settings);
    expect(readPlayDisplay()).toEqual(settings);
  });

  test("persists toggles and restores defaults", () => {
    usePlayDisplayStore.getState().setVisible("audio", false);
    usePlayDisplayStore.getState().setVisible("dialogue", false);

    expect(usePlayDisplayStore.getState().settings.audio).toBe(false);
    expect(readPlayDisplay()).toEqual({
      ...PLAY_DISPLAY_DEFAULTS,
      audio: false,
      dialogue: false,
    });
    expect(JSON.parse(storage.getItem(PLAY_DISPLAY_KEY) ?? "{}")).toMatchObject({
      audio: false,
      dialogue: false,
    });

    usePlayDisplayStore.getState().reset();
    expect(usePlayDisplayStore.getState().settings).toEqual(PLAY_DISPLAY_DEFAULTS);
    expect(readPlayDisplay()).toEqual(PLAY_DISPLAY_DEFAULTS);
  });
});
