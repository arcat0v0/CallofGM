import { useEffect } from "react";
import { useParams } from "@tanstack/react-router";
import type { CatalogHandoutDto, SceneDto, TrackDto } from "@cogm/shared";
import { fetchAllPages } from "@/lib/api";
import { usePlayAudio } from "@/lib/bgm";
import { useSessionConnection } from "@/lib/use-session-connection";
import { usePlayStore } from "@/stores/play-store";
import { SessionTerminalOverlay } from "@/features/play/session-terminal-overlay";
import { ConsoleStage } from "./console-stage";
import { GmChatPanel } from "./gm-chat-panel";
import { GmPanel } from "./gm-panel";
import { ConnectionBanner } from "@/features/play/connection-banner";

function GmConsoleView() {
  const { sessionId } = useParams({ from: "/gm/session/$sessionId" });
  const { retry } = useSessionConnection(sessionId, { ensurePlayer: false });
  usePlayAudio();
  const status = usePlayStore((state) => state.status);
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
          fetchAllPages<SceneDto>(`/gm/modules/${encodeURIComponent(moduleId)}/scenes`),
          fetchAllPages<TrackDto>(`/gm/modules/${encodeURIComponent(moduleId)}/tracks`),
          fetchAllPages<CatalogHandoutDto>(`/gm/modules/${encodeURIComponent(moduleId)}/handouts`),
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
      {status === "ended" ? (
        <div className="bg-warning/20 text-warning absolute inset-x-0 top-0 z-30 px-3 py-1.5 text-center text-label-small">
          本团已结团 · 控场面板已停用，仅在线玩家的踢出与拉黑可用
        </div>
      ) : null}
      <GmPanel className="w-[360px] shrink-0" />
      <div className="min-w-0 flex-1">
        <ConsoleStage />
      </div>
      <GmChatPanel className="w-[392px] shrink-0" />
      <SessionTerminalOverlay sessionId={sessionId} onRetry={retry} />
    </div>
  );
}

export { GmConsoleView };
