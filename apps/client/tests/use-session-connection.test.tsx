import { beforeEach, describe, expect, mock, test } from "bun:test";
import { act, render, waitFor } from "@testing-library/react";
import type { ServerMessage } from "@cogm/shared";
import type { SessionSocket } from "@/lib/session-socket";

type ConnectOptions = {
  sessionId: string;
  lastEventId?: number;
  signal?: AbortSignal;
  onMessage: (message: ServerMessage) => void;
  onClose?: (info: { code: number; reason: string }) => void;
};

const connections: ConnectOptions[] = [];

mock.module("@/lib/session-socket", () => ({
  connectSession: async (options: ConnectOptions): Promise<SessionSocket> => {
    connections.push(options);
    return {
      sendCommand: () => crypto.randomUUID(),
      close: () => undefined,
    };
  },
  sendSessionCommand: () => null,
}));

const { useSessionConnection } = await import("@/lib/use-session-connection");
const { usePlayStore } = await import("@/stores/play-store");

const SNAPSHOT = {
  protocolVersion: 1,
  type: "snapshot",
  watermark: 3,
  payload: {
    session: {
      id: "session-1",
      name: "测试团",
      moduleId: "module-1",
      moduleName: "测试模组",
      themeId: null,
      status: "active",
      phase: "free_discussion",
      currentSceneId: null,
      lastEventId: 3,
      settings: { sharePcSheets: true, obSeePcState: true },
    },
    currentScene: null,
    viewer: { isGm: false, seatRole: "ob" },
    characters: [],
    bgm: null,
    recentHistory: [],
    history: { beforeEventId: null, hasMore: false },
    visibleHandouts: [],
    pendingCheckRequests: [],
  },
} satisfies ServerMessage;

let retry: (() => void) | null = null;

function Harness() {
  retry = useSessionConnection("session-1", { ensurePlayer: false }).retry;
  return null;
}

describe("useSessionConnection retry", () => {
  beforeEach(() => {
    connections.length = 0;
    retry = null;
    usePlayStore.getState().reset();
  });

  test("kicked retry resyncs with a fresh snapshot instead of replaying the old watermark", async () => {
    render(<Harness />);
    await waitFor(() => expect(connections.length).toBe(1));
    const first = connections[0]!;

    act(() => {
      usePlayStore.setState({ lastEventId: 7, snapshotReady: true });
      first.onClose?.({ code: 4000, reason: "kicked" });
    });
    expect(usePlayStore.getState().terminal).toBe("kicked");

    act(() => retry?.());
    expect(usePlayStore.getState().terminal).toBeNull();
    await waitFor(() => expect(connections.length).toBe(2));
    expect(connections[1]!.lastEventId).toBeUndefined();

    act(() => connections[1]!.onMessage(SNAPSHOT));
    expect(usePlayStore.getState().connected).toBe(true);
    expect(usePlayStore.getState().snapshotReady).toBe(true);
    expect(usePlayStore.getState().lastEventId).toBe(3);
    expect(usePlayStore.getState().terminal).toBeNull();
  });

  test("a superseded connection cannot restore the kicked terminal state", async () => {
    render(<Harness />);
    await waitFor(() => expect(connections.length).toBe(1));
    const first = connections[0]!;

    act(() => first.onClose?.({ code: 4000, reason: "kicked" }));
    expect(usePlayStore.getState().terminal).toBe("kicked");

    act(() => retry?.());
    await waitFor(() => expect(connections.length).toBe(2));

    act(() => first.onClose?.({ code: 4000, reason: "kicked" }));
    expect(usePlayStore.getState().terminal).toBeNull();
  });

  test("automatic reconnect keeps the watermark for gap-free replay", async () => {
    render(<Harness />);
    await waitFor(() => expect(connections.length).toBe(1));

    act(() => {
      usePlayStore.setState({ lastEventId: 7 });
      connections[0]!.onClose?.({ code: 1006, reason: "network" });
    });

    await waitFor(() => expect(connections.length).toBe(2), { timeout: 3000 });
    expect(connections[1]!.lastEventId).toBe(7);
  });

  test("claim replacement still terminates the session", async () => {
    render(<Harness />);
    await waitFor(() => expect(connections.length).toBe(1));

    act(() => connections[0]!.onClose?.({ code: 4001, reason: "claim replaced" }));
    expect(usePlayStore.getState().terminal).toBe("replaced");
  });

  test("session end keeps the ended status and reopens once for review", async () => {
    render(<Harness />);
    await waitFor(() => expect(connections.length).toBe(1));

    act(() => connections[0]!.onClose?.({ code: 1001, reason: "session ended" }));
    expect(usePlayStore.getState().status).toBe("ended");
    await waitFor(() => expect(connections.length).toBe(2), { timeout: 3000 });
  });
});
