import { beforeEach, describe, expect, test } from "bun:test";
import { usePlayStore } from "../src/stores/play-store";

const snapshotBase = {
  session: {
    id: "s1",
    moduleId: "m1",
    moduleName: "灯塔",
    name: null,
    status: "active" as const,
    phase: "free_discussion" as const,
    currentSceneId: null,
    lastEventId: 0,
    settings: { sharePcSheets: true, obSeePcState: true },
  },
  currentScene: null,
  characters: [],
  bgm: null,
  recentHistory: [],
  history: { beforeEventId: null, hasMore: false },
  visibleHandouts: [],
  pendingCheckRequests: [],
};

const online = [
  { playerId: "p1", role: "pc" as const, characterId: "c1", connectionCount: 1 },
];

describe("presence availability", () => {
  beforeEach(() => {
    usePlayStore.getState().reset();
  });

  test("GM snapshot carrying an online list makes presence available", () => {
    usePlayStore.getState().applySnapshot({ ...snapshotBase, online }, 0);
    expect(usePlayStore.getState().presenceAvailable).toBe(true);
    expect(usePlayStore.getState().presence).toHaveLength(1);
  });

  test("GM snapshot with an empty online list stays available", () => {
    usePlayStore.getState().applySnapshot({ ...snapshotBase, online: [] }, 0);
    expect(usePlayStore.getState().presenceAvailable).toBe(true);
    expect(usePlayStore.getState().presence).toHaveLength(0);
  });

  test("player snapshot without an online list keeps presence unavailable", () => {
    usePlayStore.getState().applySnapshot(snapshotBase, 0);
    expect(usePlayStore.getState().presenceAvailable).toBe(false);
    expect(usePlayStore.getState().presence).toHaveLength(0);
  });

  test("a later player snapshot clears presence that a previous GM snapshot supplied", () => {
    usePlayStore.getState().applySnapshot({ ...snapshotBase, online }, 0);
    usePlayStore.getState().applySnapshot(snapshotBase, 0);
    expect(usePlayStore.getState().presenceAvailable).toBe(false);
    expect(usePlayStore.getState().presence).toHaveLength(0);
  });

  test("GM presence pushes make presence available", () => {
    usePlayStore.getState().applyMessage({ type: "presence:updated", payload: { online } } as never);
    expect(usePlayStore.getState().presenceAvailable).toBe(true);
    expect(usePlayStore.getState().presence).toHaveLength(1);
  });
});
