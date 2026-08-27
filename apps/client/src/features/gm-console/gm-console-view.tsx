import { useEffect } from "react";
import { useParams } from "@tanstack/react-router";
import { fetchAllPages } from "@/lib/api";
import { usePlayAudio } from "@/lib/bgm";
import { useSessionConnection } from "@/lib/use-session-connection";
import { usePlayStore, type CatalogHandout, type CatalogScene, type CatalogTrack } from "@/stores/play-store";
import { ConsoleStage } from "./console-stage";
import { GmChatPanel } from "./gm-chat-panel";
import { GmPanel } from "./gm-panel";
import { ConnectionBanner } from "@/features/play/connection-banner";

function GmConsoleView() {
  const { sessionId } = useParams({ from: "/gm/session/$sessionId" });
  useSessionConnection(sessionId, { ensurePlayer: false });
  usePlayAudio();
  const moduleId = usePlayStore((state) => state.moduleId);
  const setCatalog = usePlayStore((state) => state.setCatalog);

  useEffect(() => {
    if (!moduleId) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [scenes, tracks, handouts] = await Promise.all([
          fetchAllPages<CatalogScene>(`/gm/modules/${encodeURIComponent(moduleId)}/scenes`),
          fetchAllPages<CatalogTrack>(`/gm/modules/${encodeURIComponent(moduleId)}/tracks`),
          fetchAllPages<CatalogHandout>(`/gm/modules/${encodeURIComponent(moduleId)}/handouts`),
        ]);
        if (cancelled) {
          return;
        }
        setCatalog({
          scenes,
          tracks,
          handouts,
        });
      } catch {
        // catalog is optional for console controls
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [moduleId, setCatalog]);

  return (
    <div className="bg-background relative flex h-dvh w-full overflow-hidden">
      <ConnectionBanner />
      <GmPanel className="w-[360px] shrink-0" />
      <div className="min-w-0 flex-1">
        <ConsoleStage />
      </div>
      <GmChatPanel className="w-[392px] shrink-0" />
    </div>
  );
}

export { GmConsoleView };
