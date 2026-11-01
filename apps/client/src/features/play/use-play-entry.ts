import { useCallback, useEffect, useState } from "react";
import type { MyClaimResponse } from "@cogm/shared";
import { api } from "@/lib/api";
import { ensurePlayer } from "@/lib/identity";
import { resolvePlayEntry, type PlayEntryGate } from "@/lib/play-entry";

export function usePlayEntry(sessionId: string): { gate: PlayEntryGate; retry: () => void } {
  const [claim, setClaim] = useState<MyClaimResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setClaim(null);
    setFailed(false);
    void (async () => {
      try {
        await ensurePlayer();
        const result = await api<MyClaimResponse>(`/sessions/${encodeURIComponent(sessionId)}/my-claim`);
        if (!cancelled) {
          setClaim(result);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, attempt]);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  return { gate: resolvePlayEntry({ claim, failed }), retry };
}
