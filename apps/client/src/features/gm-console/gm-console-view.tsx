import { useEffect } from "react";
import { useParams } from "@tanstack/react-router";
import type { CatalogHandoutDto, SceneDto, TrackDto } from "@cogm/shared";
import { fetchAllPages, mediaUrl } from "@/lib/api";
import { usePlayAudio } from "@/lib/bgm";
import { useSessionConnection } from "@/lib/use-session-connection";
import { usePlayStore } from "@/stores/play-store";
import { SessionTerminalOverlay } from "@/features/play/session-terminal-overlay";
import { ConnectionBanner } from "@/features/play/connection-banner";
import { PortraitLayer } from "@/features/session-stage/portrait-layer";
import { SceneAudioControl } from "@/features/session-stage/scene-audio-control";
import { GmChatPanel } from "./gm-chat-panel";
import { GmPanel } from "./gm-panel";
import { GmThemeControl } from "@/themes/runtime/gm-theme-control";
import { GmThemeScope } from "@/themes/runtime/gm-theme-scope";
import { ThemeSlot } from "@/themes/runtime/theme-slot";
import { t, useI18nVersion } from "@/i18n";

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

  const sceneInfo = <ThemeSlot name="play.scene-info" ctx={{ variant: "desktop" }} />;
  const portrait = <PortraitLayer />;
  const audio = <SceneAudioControl variant="desktop" />;
  const dialogue = latest ? (
    <ThemeSlot
      name="play.dialogue"
      ctx={{
        messageId: latest.id,
        speaker: latest.speakerName,
        roleLabel: latest.speakerRoleLabel || undefined,
        text: latest.body,
        size: "md",
      }}
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
        nodes: { sceneInfo, portrait, dialogue, audio },
      }}
    />
  );

  return (
    <GmThemeScope>
      <div className="bg-background relative h-dvh w-full overflow-hidden">
        <ThemeSlot
          name="gm-console.layout"
          ctx={{
            nodes: {
              controls: <GmPanel />,
              stage,
              chat: <GmChatPanel />,
              overlays: <SessionTerminalOverlay sessionId={sessionId} onRetry={retry} />,
              connection: <ConnectionBanner />,
              endedBanner:
                status === "ended" ? (
                  <div className="bg-warning/20 text-warning absolute inset-x-0 top-0 z-30 px-3 py-1.5 text-center text-label-small">
                    {t("play.endedBanner")}
                  </div>
                ) : null,
            },
            view: { sessionId, status },
          }}
        />
      </div>
      <GmThemeControl />
    </GmThemeScope>
  );
}

export { GmConsoleView };