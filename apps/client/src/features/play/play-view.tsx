import { PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckPrompt } from "@/features/session-live/check-prompt";
import { HandoutPrompt } from "@/features/session-live/handout-prompt";
import { usePlayAudio } from "@/lib/bgm";
import { sendSessionCommand } from "@/lib/session-socket";
import { useSessionConnection } from "@/lib/use-session-connection";
import { readRotateSuggestionDismissed, writeRotateSuggestionDismissed } from "@/lib/storage";
import { usePlayStore } from "@/stores/play-store";
import { ChatArea } from "./chat-area";
import { ConnectionBanner } from "./connection-banner";
import { DesktopScene } from "./desktop-scene";
import { MobileLandscapeScene } from "./mobile-landscape-scene";
import { MobilePortraitScene } from "./mobile-portrait-scene";
import { RotateSuggestionOverlay } from "./rotate-suggestion-overlay";
import { SessionTerminalOverlay } from "./session-terminal-overlay";

function PlayView() {
  const { sessionId } = useParams({ from: "/play/$sessionId" });
  const { retry } = useSessionConnection(sessionId);
  usePlayAudio();
  const pendingChecks = usePlayStore((state) => state.pendingChecks);
  const handouts = usePlayStore((state) => state.handouts);
  const status = usePlayStore((state) => state.status);
  const check = pendingChecks[0] ?? null;
  const [showRotateSuggestion, setShowRotateSuggestion] = useState(() => !readRotateSuggestionDismissed());
  const [landscapeChatOpen, setLandscapeChatOpen] = useState(true);
  const [endDialogOpen, setEndDialogOpen] = useState(false);

  useEffect(() => {
    if (status === "ended") {
      setEndDialogOpen(true);
    }
  }, [status]);

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
        />
      ) : null}
      <HandoutPrompt handouts={handouts} />
      <Dialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
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
