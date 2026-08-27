import { useEffect } from "react";
import { ensurePlayer } from "./identity";
import { connectSession, type SessionSocket } from "./session-socket";
import { usePlayStore } from "@/stores/play-store";

export function useSessionConnection(sessionId: string, options?: { ensurePlayer?: boolean }): void {
  const applyMessage = usePlayStore((state) => state.applyMessage);
  const reset = usePlayStore((state) => state.reset);
  const setConnected = usePlayStore((state) => state.setConnected);

  useEffect(() => {
    let cancelled = false;
    let socket: SessionSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    reset();

    async function open(lastEventId?: number): Promise<void> {
      if (options?.ensurePlayer !== false) {
        await ensurePlayer();
      }
      if (cancelled) {
        return;
      }
      socket = await connectSession({
        sessionId,
        lastEventId,
        onMessage: applyMessage,
        onClose: () => {
          if (cancelled) {
            return;
          }
          setConnected(false);
          const watermark = usePlayStore.getState().lastEventId;
          const delay = Math.min(8_000, 800 * 2 ** attempt);
          attempt += 1;
          retry = setTimeout(() => {
            void open(watermark > 0 ? watermark : undefined);
          }, delay);
        },
      });
      attempt = 0;
    }

    void open();

    return () => {
      cancelled = true;
      if (retry) {
        clearTimeout(retry);
      }
      socket?.close();
      reset();
    };
  }, [sessionId, options?.ensurePlayer, applyMessage, reset, setConnected]);
}
