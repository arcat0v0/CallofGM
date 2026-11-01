import { useEffect } from "react";
import { api } from "@/lib/api";
import { usePlayStore } from "@/stores/play-store";

export function useSessionTheme(sessionId: string): void {
  const setThemeId = usePlayStore((state) => state.setThemeId);

  useEffect(() => {
    let cancelled = false;
    void api<{ themeId: string | null }>(`/public/sessions/${encodeURIComponent(sessionId)}/theme`)
      .then((result) => {
        if (!cancelled) {
          setThemeId(result.themeId);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sessionId, setThemeId]);
}