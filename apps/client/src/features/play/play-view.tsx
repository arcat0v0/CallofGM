import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ChatMessageView } from "@cogm/theme-sdk";
import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { ConnectionBanner } from "@/features/play/connection-banner";
import { PlayOverlays } from "@/features/play/play-overlays";
import { PlayerActionDock } from "@/features/play/player-action-dock";
import { usePlayViewport } from "@/features/play/use-play-viewport";
import { useSessionTheme } from "@/features/play/use-session-theme";
import { Composer } from "@/features/play/composer";
import { isSystemMessage } from "@/features/chat/message-list";
import { PortraitLayer } from "@/features/session-stage/portrait-layer";
import { SceneAudioControl } from "@/features/session-stage/scene-audio-control";
import { usePlayAudio } from "@/lib/bgm";
import { mediaUrl } from "@/lib/api";
import { useSessionConnection } from "@/lib/use-session-connection";
import { readRotateSuggestionDismissed, writeRotateSuggestionDismissed } from "@/lib/storage";
import { useIdentityStore } from "@/stores/identity-store";
import { usePlayDisplayStore } from "@/stores/play-display-store";
import { usePlayStore } from "@/stores/play-store";
import { ThemeScope } from "@/themes/runtime/theme-scope";
import { ThemeSlot } from "@/themes/runtime/theme-slot";
import { t, useI18nVersion } from "@/i18n";
import { usePlayEntry } from "./use-play-entry";

function PlaySkeleton({ label }: { label: string }) {
  return (
    <div className="bg-background flex h-full w-full flex-col items-center justify-center gap-3">
      <LoadingIndicator contained />
      <h1 className="text-foreground-secondary text-body-medium">{label}</h1>
    </div>
  );
}

function PlayEntryNotice({ sessionId, ended }: { sessionId: string; ended: boolean }) {
  return (
    <main className="bg-background flex h-dvh w-full items-center justify-center px-6">
      <div className="bg-md-surface-container flex w-full max-w-md flex-col items-center gap-3 rounded-3xl px-7 py-9 text-center">
        <h1 className="text-foreground font-serif text-headline-small-emph">
          {ended ? t("play.ended") : t("play.selectSeatFirst")}
        </h1>
        <p className="text-foreground-secondary text-body-medium">
          {ended ? t("play.reviewNeedsSpectator") : t("play.noSeatDescription")}
        </p>
        <Button asChild variant="primary" className="mt-1">
          <Link to="/join/$sessionId" params={{ sessionId }}>
            {t("play.goToSeats")}
          </Link>
        </Button>
      </div>
    </main>
  );
}

function PlayEntryError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="bg-background flex h-dvh w-full items-center justify-center px-6">
      <div className="bg-md-surface-container flex w-full max-w-md flex-col items-center gap-3 rounded-3xl px-7 py-9 text-center">
        <h1 className="text-foreground font-serif text-headline-small-emph">{t("play.seatCheckFailed")}</h1>
        <p className="text-foreground-secondary text-body-medium">{t("play.seatCheckFailedDescription")}</p>
        <Button type="button" variant="primary" className="mt-1" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      </div>
    </main>
  );
}

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
      hidden: message.hidden,
      outcome: message.outcome,
      pending: message.pending,
      rejected: message.rejected,
      rejectionReason: message.rejectionReason,
    };
  });
}

function PlayView() {
  useI18nVersion();
  const { sessionId } = useParams({ from: "/play/$sessionId" });
  const { gate, retry } = usePlayEntry(sessionId);

  if (gate.state === "checking") {
    return (
      <main className="bg-background h-dvh w-full overflow-hidden">
        <PlaySkeleton label={t("play.confirmingSeat")} />
      </main>
    );
  }
  if (gate.state === "error") {
    return <PlayEntryError onRetry={retry} />;
  }
  if (gate.state === "no-seat") {
    return <PlayEntryNotice sessionId={sessionId} ended={gate.ended} />;
  }
  return <PlaySession sessionId={sessionId} />;
}

function PlaySession({ sessionId }: { sessionId: string }) {
  const { retry } = useSessionConnection(sessionId, { ensurePlayer: false });
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
  const snapshotReady = usePlayStore((state) => state.snapshotReady);
  const storeSessionId = usePlayStore((state) => state.sessionId);
  const display = usePlayDisplayStore((state) => state.settings);
  const setDisplayVisible = usePlayDisplayStore((state) => state.setVisible);
  const [showRotateSuggestion, setShowRotateSuggestion] = useState(() => !readRotateSuggestionDismissed());
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

  if (!snapshotReady || storeSessionId !== sessionId) {
    return (
      <main className="bg-background relative h-dvh w-full overflow-hidden">
        <ConnectionBanner />
        <PlaySkeleton label={t("play.connecting")} />
        <PlayOverlays
          sessionId={sessionId}
          retry={retry}
          showRotateSuggestion={false}
          onDismissRotate={() => undefined}
          endDialogOpen={endDialogOpen}
          onEndDialogChange={setEndDialogOpen}
          handoutPromptEnabled={display.handoutPrompt}
        />
      </main>
    );
  }

  const sceneInfo = display.sceneInfo ? (
    <ThemeSlot name="play.scene-info" ctx={{ variant: viewport }} />
  ) : null;
  const portrait = (
    <PortraitLayer
      compact={viewport !== "desktop"}
      showNameplate={display.characterStatus}
      className={
        viewport === "portrait"
          ? "top-[64px] bottom-2"
          : viewport === "landscape"
            ? "top-[44px] bottom-[88px]"
            : undefined
      }
    />
  );
  const audio = display.audio ? <SceneAudioControl variant={viewport} /> : null;
  const dialogue = latest && display.dialogue ? (
    <ThemeSlot
      key={latest.id}
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
        onCollapse: viewport === "portrait" ? undefined : () => setDisplayVisible("chat", false),
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
              dock: <PlayerActionDock variant={viewport} />,
              overlays: (
                <PlayOverlays
                  sessionId={sessionId}
                  retry={retry}
                  showRotateSuggestion={viewport === "portrait" && showRotateSuggestion}
                  onDismissRotate={() => {
                    writeRotateSuggestionDismissed();
                    setShowRotateSuggestion(false);
                  }}
                  endDialogOpen={endDialogOpen}
                  onEndDialogChange={setEndDialogOpen}
                  handoutPromptEnabled={display.handoutPrompt}
                />
              ),
              connection: <ConnectionBanner />,
            },
            view: {
              sessionId,
              status,
              phase,
              landscapeChatOpen: display.chat,
              chatOpen: display.chat,
            },
            actions: {
              setLandscapeChatOpen: (open) => setDisplayVisible("chat", open),
              setChatOpen: (open) => setDisplayVisible("chat", open),
            },
          }}
        />
      </div>
    </ThemeScope>
  );
}

export { PlayView };
