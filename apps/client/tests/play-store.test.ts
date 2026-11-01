import { describe, expect, test, beforeEach } from "bun:test";
import { usePlayStore } from "../src/stores/play-store";

describe("play-store draft-loss and command rejection tracking", () => {
  beforeEach(() => {
    usePlayStore.getState().reset();
  });

  test("command:rejected records lastRejection with commandId and Chinese copy for the code", () => {
    usePlayStore.getState().applyMessage({
      protocolVersion: 1,
      commandId: "cmd-xyz-123",
      type: "command:rejected",
      payload: { code: "VALIDATION_FAILED", message: "Expression portrait not found" },
    });

    const rejection = usePlayStore.getState().lastRejection;
    expect(rejection).not.toBeNull();
    expect(rejection?.commandId).toBe("cmd-xyz-123");
    expect(rejection?.message).toBe("提交的内容不符合要求，请检查后重试");
  });

  test("snapshot viewer carries the server-provided seat role", () => {
    usePlayStore.getState().applySnapshot(
      {
        viewer: { isGm: false, seatRole: "ob" },
        session: {
          id: "s1",
          name: null,
          moduleId: "m1",
          moduleName: "模组",
          status: "active",
          phase: "free_discussion",
          currentSceneId: null,
          lastEventId: 0,
          settings: { sharePcSheets: true, obSeePcState: true },
        },
        currentScene: null,
        characters: [],
        bgm: null,
        recentMessages: [],
        recentEvents: [],
        visibleHandouts: [],
        pendingCheckRequests: [],
      },
      0,
    );
    expect(usePlayStore.getState().viewer).toEqual({ isGm: false, seatRole: "ob" });
  });

  test("snapshot settings drive visibility toggles", () => {
    usePlayStore.getState().applySnapshot(
      {
        viewer: { isGm: true, seatRole: null },
        session: {
          id: "s1",
          name: "灯塔之夜",
          moduleId: "m1",
          moduleName: "模组",
          status: "active",
          phase: "free_discussion",
          currentSceneId: null,
          lastEventId: 0,
          settings: { sharePcSheets: false, obSeePcState: false },
        },
        currentScene: null,
        characters: [],
        bgm: null,
        recentMessages: [],
        recentEvents: [],
        visibleHandouts: [],
        pendingCheckRequests: [],
      },
      0,
    );
    expect(usePlayStore.getState().sessionName).toBe("灯塔之夜");
    expect(usePlayStore.getState().settings).toEqual({ sharePcSheets: false, obSeePcState: false });

    usePlayStore.getState().applyMessage({
      protocolVersion: 1,
      eventId: 1,
      type: "session:settings-changed",
      occurredAt: Date.now(),
      payload: { sharePcSheets: true, obSeePcState: false },
    });
    expect(usePlayStore.getState().settings).toEqual({ sharePcSheets: true, obSeePcState: false });
  });

  test("acknowledged handouts are marked read and skipped by the prompt", () => {
    const handout = {
      grantId: "grant-1",
      handout: { id: "h1", title: "潮汐日志", content: "…", imageAssetId: null },
      isPublic: false,
      grantedAt: 1,
      read: false,
    };
    usePlayStore.getState().applySnapshot(
      {
        viewer: { isGm: false, seatRole: "pc" },
        session: {
          id: "s1",
          name: null,
          moduleId: "m1",
          moduleName: "模组",
          status: "active",
          phase: "free_discussion",
          currentSceneId: null,
          lastEventId: 0,
          settings: { sharePcSheets: true, obSeePcState: true },
        },
        currentScene: null,
        characters: [],
        bgm: null,
        recentMessages: [],
        recentEvents: [],
        visibleHandouts: [handout],
        pendingCheckRequests: [],
      },
      0,
    );
    expect(usePlayStore.getState().handouts.filter((item) => !item.read)).toHaveLength(1);

    usePlayStore.getState().markHandoutRead("grant-1");
    expect(usePlayStore.getState().handouts.filter((item) => !item.read)).toHaveLength(0);
  });

  test("reset clears lastRejection", () => {
    usePlayStore.getState().applyMessage({
      protocolVersion: 1,
      commandId: "cmd-xyz-123",
      type: "command:rejected",
      payload: { code: "FORBIDDEN", message: "Access forbidden" },
    });
    expect(usePlayStore.getState().lastRejection).not.toBeNull();
    usePlayStore.getState().reset();
    expect(usePlayStore.getState().lastRejection).toBeNull();
  });
});
