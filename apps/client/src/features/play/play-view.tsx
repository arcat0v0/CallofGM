import { PanelLeftOpen } from "lucide-react";
import { useState } from "react";
import { ChatArea } from "./chat-area";
import { DesktopScene } from "./desktop-scene";
import { MobileLandscapeScene } from "./mobile-landscape-scene";
import { MobilePortraitScene } from "./mobile-portrait-scene";
import { RotateSuggestionOverlay } from "./rotate-suggestion-overlay";

function PlayView() {
  const [showRotateSuggestion, setShowRotateSuggestion] = useState(true);
  const [landscapeChatOpen, setLandscapeChatOpen] = useState(true);

  return (
    <div className="bg-background h-dvh w-full overflow-hidden">
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
          <button
            type="button"
            onClick={() => setLandscapeChatOpen(true)}
            className="text-foreground-secondary bg-background-secondary absolute top-1/2 right-0 flex h-16 w-6 -translate-y-1/2 items-center justify-center rounded-l-lg"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        )}
      </div>

      <div className="relative flex h-full flex-col max-lg:landscape:hidden lg:hidden">
        <MobilePortraitScene />
        <ChatArea variant="portrait" className="min-h-0 flex-1" />
        {showRotateSuggestion && (
          <RotateSuggestionOverlay onDismiss={() => setShowRotateSuggestion(false)} />
        )}
      </div>
    </div>
  );
}

export { PlayView };
