import { useEffect, useState } from "react";
import { useParams } from "@tanstack/react-router";
import type { ChatMessageView } from "@cogm/theme-sdk";
import { ConnectionBanner } from "@/features/play/connection-banner";
import { PlayOverlays } from "@/features/play/play-overlays";
import { usePlayViewport } from "@/features/play/use-play-viewport";
import { useSessionTheme } from "@/features/play/use-session-theme";
import { isSystemMessage } from "@/features/chat/message-list";
import { PortraitLayer } from "@/features/session-stage/portrait-layer";
import { SceneAudioControl } from "@/features/session-stage/scene-audio-control";
import { Composer } from "@/features/play/composer";
import { usePlayAudio } from "@/lib/bgm";
import { mediaUrl } from "@/lib/api";
import { useSessionConnection } from "@/lib/use-session-connection";
import { useIdentityStore } from "@/stores/identity-store";
import { usePlayStore } from "@/stores/play-store";
import { ThemeScope } from "@/themes/runtime/theme-scope";
import { t, useI18nVersion } from "@/i18n";
import { ThemeSlot } from "@/themes/runtime/theme-slot";

function buildChatMessages(
  messages: ReturnType<typeof usePlayStore.getState>["messages"],
  selfName: string,
): ChatMessageView[] {
  return messages.map((message, index) => {
    const system = isSystemMessage(message);
    const previous = messages[index - 1];
    return {
      id: message.id,
      speakerName: message.speakerName,
      speakerRoleLabel: message.speakerRoleLabel,
      avatarInitials: message.avatarInitials,
      avatarBg: message.avatarBg,
      avatarFg: message.avatarFg,
      time: message.time,
      body: message.body,
      tone: message.tone ?? "ic",
      isSystem: system,
      self: message.speakerName === selfName,
      continued:
        !system &&
        previous !== undefined &&
        !isSystemMessage(previous) &&
        previous.speakerName === message.speakerName,
      showRoleBadge: true,
    };
  });
}

function PlayView() {
  useI18nVersion();
  const { sessionId } = useParams({ from: "/play/$sessionId" });
  const { retry } = useSessionConnection(sessionId);
  useSessionTheme(sessionId);
  usePlayAudio();
  const viewport = usePlayViewport();
  const themeId = usePlayStore((state) => state.themeId);
  const status = usePlayStore((state) => state.status);
  const phase = usePlayStore((state) => state.phase);
  const scene = usePlayStore((state) => state.scene);
  const messages = usePlayStore((state) => state.messages);
  const characters = usePlayStore((state) => state.characters);
  const playerId = useIdentityStore((state) => state.playerId);
  const [showRotateSuggestion, setShowRotateSuggestion] = useState(true);
  const [landscapeChatOpen, setLandscapeChatOpen] = useState(true);
  const [endDialogOpen, setEndDialogOpen] = useState(false);

  const claimed = characters.find((character) => character.claim?.playerId === playerId && character.claim.role === "pc");
  const isOb =
    !claimed &&
    characters.some((character) => character.claim?.playerId === playerId && character.claim.role === "ob");
  const selfName = claimed?.name ?? (isOb ? t("chat.spectatorFallback") : t("chat.playerFallback"));
  const latest = [...messages].reverse().find((message) => message.tone !== "ooc");

  useEffect(() => {
    if (status === "ended") {
      setEndDialogOpen(true);
    }
  }, [status]);

  const sceneInfo = <ThemeSlot name="play.scene-info" ctx={{ variant: viewport }} />;
  const portrait = (
    <PortraitLayer
      compact={viewport !== "desktop"}
      className={viewport === "portrait" ? "bottom-[72px]" : undefined}
    />
  );
  const audio = <SceneAudioControl variant={viewport} />;
  const dialogue = latest ? (
    <ThemeSlot
      name="play.dialogue"
      ctx={{
        messageId: latest.id,
        speaker: latest.speakerName,
        roleLabel: latest.speakerRoleLabel || undefined,
        text: latest.body,
        size: viewport === "desktop" ? "md" : "sm",
      }}
    />
  ) : null;

  const stage = (
    <ThemeSlot
      name="play.stage"
      ctx={{
        viewport,
        view: {
          sceneName: scene?.name ?? t("play.sceneFallback"),
          sceneBgUrl: mediaUrl(scene?.bgAssetId),
          status,
          phase,
          hasDialogue: Boolean(latest),
        },
        nodes: { sceneInfo, portrait, dialogue, audio },
      }}
    />
  );

  const chat = (
    <ThemeSlot
      name="play.chat-panel"
      ctx={{
        sessionId,
        variant: viewport,
        compact: viewport !== "desktop",
        messages: buildChatMessages(messages, selfName),
        selfName,
        onCollapse: viewport === "landscape" ? () => setLandscapeChatOpen(false) : undefined,
      }}
    />
  );

  return (
    <ThemeScope themeId={themeId}>
      <div className="bg-background relative h-dvh w-full overflow-hidden">
        <ThemeSlot
          name="play.layout"
          ctx={{
            viewport,
            nodes: {
              stage,
              chat,
              composer: <Composer compact={viewport !== "desktop"} />,
              overlays: (
                <PlayOverlays
                  sessionId={sessionId}
                  retry={retry}
                  showRotateSuggestion={viewport === "portrait" && showRotateSuggestion}
                  onDismissRotate={() => setShowRotateSuggestion(false)}
                  endDialogOpen={endDialogOpen}
                  onEndDialogChange={setEndDialogOpen}
                />
              ),
              connection: <ConnectionBanner />,
            },
            view: {
              sessionId,
              status,
              phase,
              landscapeChatOpen,
            },
            actions: {
              setLandscapeChatOpen,
            },
          }}
        />
      </div>
    </ThemeScope>
  );
}

export { PlayView };