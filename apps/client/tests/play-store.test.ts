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
        recentHistory: [],
        history: { beforeEventId: null, hasMore: false },
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
        recentHistory: [],
        history: { beforeEventId: null, hasMore: false },
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
        recentHistory: [],
        history: { beforeEventId: null, hasMore: false },
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

const snapshotPayload = {
  session: {
    id: "s1",
    moduleId: "m1",
    moduleName: "灯塔",
    status: "active" as const,
    phase: "free_discussion" as const,
    currentSceneId: null,
    lastEventId: 0,
  },
  currentScene: null,
  viewer: { isGm: false, seatRole: null },
  characters: [],
  bgm: null,
  recentHistory: [],
  history: { beforeEventId: null, hasMore: false },
  visibleHandouts: [],
  pendingCheckRequests: [],
};

function chatItem(eventId: number, content: string) {
  return {
    kind: "chat" as const,
    eventId,
    message: {
      id: `msg-${eventId}`,
      sessionId: "s1",
      senderId: null,
      senderType: "gm" as const,
      characterId: null,
      characterName: null,
      channel: "ooc" as const,
      content,
      expressionKey: null,
      queueOrder: 0,
      eventId,
      presentedAt: 1_700_000_000_000 + eventId,
      createdAt: 1_700_000_000_000 + eventId,
    },
  };
}

describe("chat history paging", () => {
  beforeEach(() => {
    usePlayStore.getState().reset();
  });

  test("snapshot merges chat and activity into one eventId-ordered timeline", () => {
    usePlayStore.getState().applySnapshot(
      {
        ...snapshotPayload,
        recentHistory: [
          chatItem(2, "第二句"),
          {
            kind: "activity",
            eventId: 3,
            type: "dice:rolled",
            occurredAt: 1_700_000_000_003,
            payload: { rollerType: "gm", result: { total: 42, expression: "1d100", detail: "42" } },
          },
          chatItem(4, "第四句"),
        ],
        history: { beforeEventId: 2, hasMore: true },
      },
      4,
    );

    const state = usePlayStore.getState();
    expect(state.messages.map((message) => message.id)).toEqual(["msg-2", "dice-3", "msg-4"]);
    expect(state.historyBeforeEventId).toBe(2);
    expect(state.historyHasMore).toBe(true);
    expect(state.historyLoading).toBe(false);
  });

  test("history reply prepends sorted items, dedupes existing ids and advances the cursor", () => {
    usePlayStore.getState().applySnapshot(
      {
        ...snapshotPayload,
        recentHistory: [chatItem(30, "已有"), chatItem(31, "最新")],
        history: { beforeEventId: 30, hasMore: true },
      },
      31,
    );
    usePlayStore.setState({ historyLoading: true, historyCommandId: "cmd-1" });

    usePlayStore.getState().applyMessage({
      protocolVersion: 1,
      commandId: "cmd-1",
      type: "command:accepted",
      payload: {
        history: {
          items: [chatItem(10, "更早"), chatItem(30, "已有"), chatItem(20, "介于")],
          hasMore: true,
          beforeEventId: 10,
        },
      },
    });

    const state = usePlayStore.getState();
    expect(state.messages.map((message) => message.id)).toEqual(["msg-10", "msg-20", "msg-30", "msg-31"]);
    expect(state.historyBeforeEventId).toBe(10);
    expect(state.historyHasMore).toBe(true);
    expect(state.historyLoading).toBe(false);
    expect(state.historyCommandId).toBeNull();
    expect(state.historyPagesLoaded).toBe(1);
  });

  test("last page hides further loading and keeps ordering stable", () => {
    usePlayStore.getState().applySnapshot(
      {
        ...snapshotPayload,
        recentHistory: [chatItem(5, "最新")],
        history: { beforeEventId: 5, hasMore: true },
      },
      5,
    );
    usePlayStore.setState({ historyLoading: true, historyCommandId: "cmd-2" });

    usePlayStore.getState().applyMessage({
      protocolVersion: 1,
      commandId: "cmd-2",
      type: "command:accepted",
      payload: { history: { items: [chatItem(1, "最早")], hasMore: false, beforeEventId: null } },
    });

    const state = usePlayStore.getState();
    expect(state.messages.map((message) => message.id)).toEqual(["msg-1", "msg-5"]);
    expect(state.historyHasMore).toBe(false);
    expect(state.historyBeforeEventId).toBeNull();
    expect(state.historyPagesLoaded).toBe(1);
  });

  test("stale or unrelated accepted replies do not mutate the timeline", () => {
    usePlayStore.getState().applySnapshot(
      {
        ...snapshotPayload,
        recentHistory: [chatItem(8, "最新")],
        history: { beforeEventId: 8, hasMore: true },
      },
      8,
    );
    usePlayStore.setState({ historyLoading: true, historyCommandId: "cmd-3" });

    usePlayStore.getState().applyMessage({
      protocolVersion: 1,
      commandId: "cmd-other",
      type: "command:accepted",
      payload: { history: { items: [chatItem(2, "越权的更早")], hasMore: false, beforeEventId: null } },
    });

    const state = usePlayStore.getState();
    expect(state.messages.map((message) => message.id)).toEqual(["msg-8"]);
    expect(state.historyLoading).toBe(true);
    expect(state.historyPagesLoaded).toBe(0);
  });

  test("rejected history command clears the loading state", () => {
    usePlayStore.getState().applySnapshot(
      {
        ...snapshotPayload,
        recentHistory: [chatItem(8, "最新")],
        history: { beforeEventId: 8, hasMore: true },
      },
      8,
    );
    usePlayStore.setState({ historyLoading: true, historyCommandId: "cmd-4" });

    usePlayStore.getState().applyMessage({
      protocolVersion: 1,
      commandId: "cmd-4",
      type: "command:rejected",
      payload: { code: "RATE_LIMITED", message: "Too many commands" },
    });

    const state = usePlayStore.getState();
    expect(state.historyLoading).toBe(false);
    expect(state.historyCommandId).toBeNull();
    expect(state.historyHasMore).toBe(true);
  });

  test("live events append after paged history without duplicates", () => {
    usePlayStore.getState().applySnapshot(
      {
        ...snapshotPayload,
        recentHistory: [chatItem(10, "十")],
        history: { beforeEventId: 10, hasMore: true },
      },
      10,
    );
    usePlayStore.setState({ historyLoading: true, historyCommandId: "cmd-5" });
    usePlayStore.getState().applyMessage({
      protocolVersion: 1,
      commandId: "cmd-5",
      type: "command:accepted",
      payload: { history: { items: [chatItem(9, "九")], hasMore: false, beforeEventId: null } },
    });

    usePlayStore.getState().applyMessage({
      protocolVersion: 1,
      eventId: 11,
      occurredAt: 1_700_000_000_011,
      type: "chat:message",
      payload: { message: chatItem(11, "十一").message },
    });
    usePlayStore.getState().applyMessage({
      protocolVersion: 1,
      eventId: 12,
      occurredAt: 1_700_000_000_012,
      type: "chat:message",
      payload: { message: chatItem(12, "十二").message },
    });

    const state = usePlayStore.getState();
    expect(state.messages.map((message) => message.id)).toEqual(["msg-9", "msg-10", "msg-11", "msg-12"]);
    expect(state.lastEventId).toBe(12);
  });
});
