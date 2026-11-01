import { PanelLeftOpen } from "lucide-react";
import type { PlayLayoutCtx } from "@cogm/theme-sdk";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";

export function PlayLayout({ viewport, nodes, view, actions }: PlayLayoutCtx) {
  if (viewport === "portrait") {
    return (
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">
        {nodes.connection}
        {nodes.stage}
        <div className="bg-md-surface-container-low flex min-h-0 flex-1 flex-col">
          {nodes.chat}
          {nodes.composer}
        </div>
        {nodes.overlays}
      </div>
    );
  }

  if (viewport === "landscape") {
    return (
      <div className="relative flex h-full w-full overflow-hidden bg-background">
        {nodes.connection}
        {nodes.stage}
        {view.landscapeChatOpen ? (
          <div className="bg-md-surface-container-low flex h-full w-[284px] shrink-0 flex-col">
            {nodes.chat}
            {nodes.composer}
          </div>
        ) : (
          <Button
            type="button"
            variant="tertiary"
            size="icon-sm"
            onClick={() => actions.setLandscapeChatOpen(true)}
            aria-label={t("play.expandChat")}
            className="bg-md-surface-container-high text-md-on-surface-variant absolute top-1/2 right-0 z-20 h-16 w-6 -translate-y-1/2 rounded-l-full rounded-r-none"
          >
            <PanelLeftOpen className="size-4" />
          </Button>
        )}
        {nodes.overlays}
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-background">
      {nodes.connection}
      <div className="min-w-0 flex-1">{nodes.stage}</div>
      <div className="bg-md-surface-container-low flex h-full w-[392px] shrink-0 flex-col">
        {nodes.chat}
        {nodes.composer}
      </div>
      {nodes.overlays}
    </div>
  );
}