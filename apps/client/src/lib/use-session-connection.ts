import { SessionCloseCode, type ServerMessage } from "@cogm/shared";
import { useCallback, useEffect, useRef } from "react";
import { ensurePlayer } from "./identity";
import { connectSession, type SessionSocket } from "./session-socket";
import { usePlayStore } from "@/stores/play-store";

const MAX_HANDSHAKE_FAILURES = 5;
const SESSION_ENDED_REASON = "session ended";

export function useSessionConnection(
  sessionId: string,
  options?: { ensurePlayer?: boolean },
): { retry: () => void } {
  const applyMessage = usePlayStore((state) => state.applyMessage);
  const reset = usePlayStore((state) => state.reset);
  const setConnected = usePlayStore((state) => state.setConnected);
  const setTerminal = usePlayStore((state) => state.setTerminal);
  const markEnded = usePlayStore((state) => state.markEnded);

  const controls = useRef<{
    resync: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let socket: SessionSocket | null = null;
    const controller = new AbortController();
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let handshakeFailures = 0;
    let refreshingSnapshot = false;
    let reopenedAfterEnd = false;
    let attemptGeneration = 0;
    reset();

    function scheduleReconnect() {
      const watermark = usePlayStore.getState().lastEventId;
      const delay = Math.min(8_000, 800 * 2 ** attempt);
      attempt += 1;
      retry = setTimeout(() => {
        void open(watermark > 0 ? watermark : undefined);
      }, delay);
    }

    async function refreshSnapshot(): Promise<void> {
      if (cancelled || refreshingSnapshot) {
        return;
      }
      refreshingSnapshot = true;
      try {
        await open();
      } finally {
        refreshingSnapshot = false;
      }
    }

    function handleMessage(message: ServerMessage): void {
      if ("type" in message && message.type === "session:refresh") {
        void refreshSnapshot();
        return;
      }
      const settingsBefore = usePlayStore.getState().settings;
      applyMessage(message);
      if (message.type !== "session:settings-changed") {
        return;
      }
      const settingsAfter = usePlayStore.getState().settings;
      if (
        settingsAfter.sharePcSheets !== settingsBefore.sharePcSheets ||
        settingsAfter.obSeePcState !== settingsBefore.obSeePcState
      ) {
        void refreshSnapshot();
      }
    }

    async function open(lastEventId?: number): Promise<void> {
      const generation = ++attemptGeneration;
      const isCurrent = () => !cancelled && generation === attemptGeneration;
      try {
        if (options?.ensurePlayer !== false) {
          await ensurePlayer();
        }
        if (!isCurrent()) {
          return;
        }
        const next = await connectSession({
          sessionId,
          lastEventId,
          signal: controller.signal,
          onMessage: (message) => {
            if (isCurrent()) {
              handleMessage(message);
            }
          },
          onClose: ({ code, reason }) => {
            if (!isCurrent()) {
              return;
            }
            setConnected(false);
            if (code === SessionCloseCode.kicked) {
              setTerminal("kicked");
              return;
            }
            if (code === SessionCloseCode.claimReplaced) {
              setTerminal("replaced");
              return;
            }
            if (code === SessionCloseCode.seatReleased) {
              setTerminal("released");
              return;
            }
            if (code === 1001 && reason === SESSION_ENDED_REASON) {
              markEnded();
              if (!reopenedAfterEnd) {
                reopenedAfterEnd = true;
                scheduleReconnect();
              }
              return;
            }
            scheduleReconnect();
          },
        });
        if (!isCurrent()) {
          next.close();
          return;
        }
        socket = next;
        attempt = 0;
        handshakeFailures = 0;
      } catch {
        if (!isCurrent()) {
          return;
        }
        setConnected(false);
        handshakeFailures += 1;
        if (handshakeFailures >= MAX_HANDSHAKE_FAILURES) {
          setTerminal("unavailable");
          return;
        }
        scheduleReconnect();
      }
    }

    controls.current = {
      resync: async () => {
        attempt = 0;
        handshakeFailures = 0;
        await open();
      },
    };

    void open();

    return () => {
      cancelled = true;
      controls.current = null;
      if (retry) {
        clearTimeout(retry);
      }
      controller.abort();
      socket?.close();
      reset();
    };
  }, [sessionId, options?.ensurePlayer, applyMessage, reset, setConnected, setTerminal, markEnded]);

  const retryConnection = useCallback(() => {
    setTerminal(null);
    void controls.current?.resync();
  }, [setTerminal]);

  return { retry: retryConnection };
}
