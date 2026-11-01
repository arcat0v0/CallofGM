import { beforeEach, describe, expect, test } from "bun:test";
import {
  PLAYER_ID_KEY,
  ROTATE_SUGGESTION_KEY,
  readRotateSuggestionDismissed,
  writePlayerId,
  writeRotateSuggestionDismissed,
} from "../src/lib/storage";

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
  entries(): Array<[string, string]> {
    return [...this.store.entries()];
  }
}

describe("player identity persistence", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    Object.defineProperty(globalThis, "localStorage", {
      value: storage,
      configurable: true,
      writable: true,
    });
  });

  test("stores only the player id and never a plaintext token", () => {
    writePlayerId("player-1");

    expect(storage.getItem(PLAYER_ID_KEY)).toBe("player-1");
    const values = storage.entries().map(([, value]) => value);
    expect(values).not.toContain("opaque-secret-token");
    expect([...storage.entries()].every(([key]) => !/token/i.test(key))).toBe(true);
  });
});

describe("rotate suggestion dismissal persistence", () => {
  test("defaults to shown and stays dismissed once written", () => {
    const storage = new MemoryStorage();
    (globalThis as { localStorage?: Storage }).localStorage = storage;
    expect(readRotateSuggestionDismissed()).toBe(false);
    writeRotateSuggestionDismissed();
    expect(readRotateSuggestionDismissed()).toBe(true);
    expect(storage.getItem(ROTATE_SUGGESTION_KEY)).toBe("1");
  });
});
