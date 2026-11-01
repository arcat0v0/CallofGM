import { Link, useParams } from "@tanstack/react-router";
import { PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { CheckPrompt } from "@/features/session-live/check-prompt";
import { HandoutPrompt } from "@/features/session-live/handout-prompt";
import { usePlayAudio } from "@/lib/bgm";
import { sendSessionCommand } from "@/lib/session-socket";
import { useSessionConnection } from "@/lib/use-session-connection";
import { readRotateSuggestionDismissed, writeRotateSuggestionDismissed } from "@/lib/storage";
import { useBlockingDialog } from "@/stores/modal-store";
import { usePlayStore } from "@/stores/play-store";
import { ChatArea } from "./chat-area";
import { ConnectionBanner } from "./connection-banner";
import { DesktopScene } from "./desktop-scene";
import { MobileLandscapeScene } from "./mobile-landscape-scene";
import { MobilePortraitScene } from "./mobile-portrait-scene";
import { RotateSuggestionOverlay } from "./rotate-suggestion-overlay";
import { SessionTerminalOverlay } from "./session-terminal-overlay";
import { usePlayEntry } from "./use-play-entry";

function PlaySkeleton({ label }: { label: string }) {
  return (
    <div className="bg-background flex h-full w-full flex-col items-center justify-center gap-3">
      <LoadingIndicator contained />
      <p className="text-foreground-secondary text-body-medium">{label}</p>
    </div>
  );
}

function PlayEntryNotice({
  sessionId,
  ended,
}: {
  sessionId: string;
  ended: boolean;
}) {
  return (
    <main className="bg-background flex h-dvh w-full items-center justify-center px-6">
      <div className="bg-md-surface-container flex w-full max-w-md flex-col items-center gap-3 rounded-3xl px-7 py-9 text-center">
        <h1 className="text-foreground font-serif text-headline-small-emph">
          {ended ? "本团已结束" : "请先选择座位"}
        </h1>
        <p className="text-foreground-secondary text-body-medium">
          {ended
            ? "回看聊天记录与情报需要从入口以观战身份进入。"
            : "你还没有在本团认领角色或观战位，选座后才能进入沉浸视图。"}
        </p>
        <Button asChild variant="primary" className="mt-1">
          <Link to="/join/$sessionId" params={{ sessionId }}>
            前往选座
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
        <h1 className="text-foreground font-serif text-headline-small-emph">无法确认座位</h1>
        <p className="text-foreground-secondary text-body-medium">读取本团的座位信息失败，请稍后重试。</p>
        <Button type="button" variant="primary" className="mt-1" onClick={onRetry}>
          重试
        </Button>
      </div>
    </main>
  );
}

function PlayView() {
  const { sessionId } = useParams({ from: "/play/$sessionId" });
  const { gate, retry } = usePlayEntry(sessionId);

  if (gate.state === "checking") {
    return (
      <div className="bg-background h-dvh w-full overflow-hidden">
        <PlaySkeleton label="正在确认座位…" />
      </div>
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
  usePlayAudio();
  const pendingChecks = usePlayStore((state) => state.pendingChecks);
  const dismissedChecks = usePlayStore((state) => state.dismissedChecks);
  const dismissCheck = usePlayStore((state) => state.dismissCheck);
  const handouts = usePlayStore((state) => state.handouts);
  const status = usePlayStore((state) => state.status);
  const snapshotReady = usePlayStore((state) => state.snapshotReady);
  const storeSessionId = usePlayStore((state) => state.sessionId);
  const check = pendingChecks.find((item) => !dismissedChecks.includes(item.id)) ?? null;
  const [showRotateSuggestion, setShowRotateSuggestion] = useState(() => !readRotateSuggestionDismissed());
  const [landscapeChatOpen, setLandscapeChatOpen] = useState(true);
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const endDialog = useBlockingDialog("end", endDialogOpen, setEndDialogOpen);

  useEffect(() => {
    if (status === "ended") {
      setEndDialogOpen(true);
    }
  }, [status]);

  if (!snapshotReady || storeSessionId !== sessionId) {
    return (
      <div className="bg-background relative h-dvh w-full overflow-hidden">
        <ConnectionBanner />
        <PlaySkeleton label="正在连接团…" />
        <SessionTerminalOverlay sessionId={sessionId} onRetry={retry} />
      </div>
    );
  }

  return (
    <div className="bg-background relative h-dvh w-full overflow-hidden">
      <ConnectionBanner />
      <div className="hidden h-full lg:flex">
        <div className="min-w-0 flex-1">
          <DesktopScene />
        </div>
        <ChatArea variant="desktop" className="w-[392px] shrink-0" />
      </div>

      <div className="hidden h-full max-lg:landscape:flex">
        <MobileLandscapeScene />
        {landscapeChatOpen ? (
          <ChatArea
            variant="landscape"
            onCollapse={() => setLandscapeChatOpen(false)}
            className="w-[284px] shrink-0"
          />
        ) : (
          <Button
            type="button"
            variant="tertiary"
            size="icon-sm"
            onClick={() => setLandscapeChatOpen(true)}
            aria-label="展开文字频道"
            className="bg-md-surface-container-high text-md-on-surface-variant absolute top-1/2 right-0 h-16 w-6 -translate-y-1/2 rounded-l-full rounded-r-none"
          >
            <PanelLeftOpen className="size-4" />
          </Button>
        )}
      </div>

      <div className="relative flex h-full flex-col max-lg:landscape:hidden lg:hidden">
        <MobilePortraitScene />
        <ChatArea variant="portrait" className="min-h-0 flex-1" />
        {showRotateSuggestion && (
          <RotateSuggestionOverlay
            onDismiss={() => {
              writeRotateSuggestionDismissed();
              setShowRotateSuggestion(false);
            }}
          />
        )}
      </div>

      {check ? (
        <CheckPrompt
          request={check}
          onRespond={() => sendSessionCommand("check:respond", { requestId: check.id })}
          onDismiss={() => dismissCheck(check.id)}
        />
      ) : null}
      <HandoutPrompt handouts={handouts} />
      <Dialog open={endDialog.open} onOpenChange={endDialog.onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>本团已结束</DialogTitle>
            <DialogDescription>主持人已结团。聊天记录与情报仍可回看。</DialogDescription>
          </DialogHeader>
          <Button type="button" variant="primary" onClick={() => setEndDialogOpen(false)}>
            查看记录
          </Button>
        </DialogContent>
      </Dialog>
      <SessionTerminalOverlay sessionId={sessionId} onRetry={retry} />
    </div>
  );
}

export { PlayView };
