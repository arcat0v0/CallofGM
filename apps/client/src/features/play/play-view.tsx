import { PanelLeftOpen } from "lucide-react";
import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CheckPrompt } from "@/features/session-live/check-prompt";
import { HandoutPrompt } from "@/features/session-live/handout-prompt";
import { usePlayAudio } from "@/lib/bgm";
import { sendSessionCommand } from "@/lib/session-socket";
import { useSessionConnection } from "@/lib/use-session-connection";
import { usePlayStore } from "@/stores/play-store";
import { ChatArea } from "./chat-area";
import { ConnectionBanner } from "./connection-banner";
import { DesktopScene } from "./desktop-scene";
import { MobileLandscapeScene } from "./mobile-landscape-scene";
import { MobilePortraitScene } from "./mobile-portrait-scene";
import { RotateSuggestionOverlay } from "./rotate-suggestion-overlay";

function PlayView() {
  const { sessionId } = useParams({ from: "/play/$sessionId" });
  useSessionConnection(sessionId);
  usePlayAudio();
  const pendingChecks = usePlayStore((state) => state.pendingChecks);
  const handouts = usePlayStore((state) => state.handouts);
  const check = pendingChecks[0] ?? null;
  const [showRotateSuggestion, setShowRotateSuggestion] = useState(true);
  const [landscapeChatOpen, setLandscapeChatOpen] = useState(true);

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
            className="text-foreground-secondary bg-background-secondary absolute top-1/2 right-0 h-16 w-6 -translate-y-1/2 rounded-l-lg rounded-r-none"
          >
            <PanelLeftOpen className="size-4" />
          </Button>
        )}
      </div>

      <div className="relative flex h-full flex-col max-lg:landscape:hidden lg:hidden">
        <MobilePortraitScene />
        <ChatArea variant="portrait" className="min-h-0 flex-1" />
        {showRotateSuggestion && (
          <RotateSuggestionOverlay onDismiss={() => setShowRotateSuggestion(false)} />
        )}
      </div>

      {check ? (
        <CheckPrompt
          request={check}
          onRespond={() => sendSessionCommand("check:respond", { requestId: check.id })}
        />
      ) : null}
      <HandoutPrompt handouts={handouts} />
    </div>
  );
}

export { PlayView };
