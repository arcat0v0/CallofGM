import { useEffect, useState } from "react";
import { useParams } from "@tanstack/react-router";
import type { CatalogHandoutDto, SceneDto, TrackDto } from "@cogm/shared";
import { fetchAllPages, mediaUrl } from "@/lib/api";
import { usePlayAudio } from "@/lib/bgm";
import { useSessionConnection } from "@/lib/use-session-connection";
import { usePlayStore } from "@/stores/play-store";
import { GmHistoryOverlay } from "@/features/history/gm-history-overlay";
import { SessionTerminalOverlay } from "@/features/play/session-terminal-overlay";
import { ConnectionBanner } from "@/features/play/connection-banner";
import { DialogueBox } from "@/features/session-stage/dialogue-box";
import { PortraitLayer } from "@/features/session-stage/portrait-layer";
import { SceneAudioControl } from "@/features/session-stage/scene-audio-control";
import { GmThemeScope } from "@/themes/runtime/gm-theme-scope";
import { ThemeSlot } from "@/themes/runtime/theme-slot";
import { t, useI18nVersion } from "@/i18n";
import { GmChatPanel } from "./gm-chat-panel";
import { GmPanel } from "./gm-panel";
import { GmToolProvider } from "./gm-tool-context";
import { GmToolDock } from "./gm-tool-dock";
import { GmTopBar } from "./gm-top-bar";

function GmConsoleView() {
  useI18nVersion();
  const { sessionId } = useParams({ from: "/gm/session/$sessionId" });
  const { retry } = useSessionConnection(sessionId, { ensurePlayer: false });
  usePlayAudio();
  const status = usePlayStore((state) => state.status);
  const phase = usePlayStore((state) => state.phase);
  const scene = usePlayStore((state) => state.scene);
  const messages = usePlayStore((state) => state.messages);
  const moduleId = usePlayStore((state) => state.moduleId);
  const setCatalog = usePlayStore((state) => state.setCatalog);
  const [historyOpen, setHistoryOpen] = useState(false);

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
        setCatalog({ scenes, tracks, handouts });
      } catch {
        // catalog is optional for console controls
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [moduleId, setCatalog]);

  const latest = [...messages].reverse().find((message) => message.tone !== "ooc");

  const dialogue = latest ? (
    <DialogueBox
      speaker={latest.speakerName}
      roleLabel={latest.speakerRoleLabel || undefined}
      text={latest.body}
      size="md"
      className="w-[min(760px,100%)]"
    />
  ) : null;

  const stage = (
    <ThemeSlot
      name="gm-console.stage"
      ctx={{
        view: {
          sceneName: scene?.name ?? t("play.consoleFallback"),
          sceneBgUrl: mediaUrl(scene?.bgAssetId),
          status,
          phase,
          hasDialogue: Boolean(latest),
        },
        nodes: {
          sceneInfo: null,
          portrait: <PortraitLayer variant="gm" showNameplate={false} />,
          dialogue,
          audio: <SceneAudioControl variant="desktop" />,
        },
      }}
    />
  );

  return (
    <GmThemeScope>
      <GmToolProvider>
        <div className="bg-background relative h-dvh w-full overflow-hidden">
          <ThemeSlot
            name="gm-console.layout"
            ctx={{
              nodes: {
                topbar: <GmTopBar />,
                controls: <GmPanel />,
                stage,
                chat: <GmChatPanel onOpenHistory={() => setHistoryOpen(true)} />,
                dock: <GmToolDock />,
                overlays: <SessionTerminalOverlay sessionId={sessionId} onRetry={retry} />,
                connection: <ConnectionBanner />,
                endedBanner: null,
              },
              view: { sessionId, status },
            }}
          />
          <GmHistoryOverlay open={historyOpen} onOpenChange={setHistoryOpen} />
        </div>
      </GmToolProvider>
    </GmThemeScope>
  );
}

export { GmConsoleView };