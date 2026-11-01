import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckPrompt } from "@/features/session-live/check-prompt";
import { HandoutPrompt } from "@/features/session-live/handout-prompt";
import { sendSessionCommand } from "@/lib/session-socket";
import { usePlayStore } from "@/stores/play-store";
import { RotateSuggestionOverlay } from "./rotate-suggestion-overlay";
import { t } from "@/i18n";
import { SessionTerminalOverlay } from "./session-terminal-overlay";

function PlayOverlays({
  sessionId,
  retry,
  showRotateSuggestion,
  onDismissRotate,
  endDialogOpen,
  onEndDialogChange,
}: {
  sessionId: string;
  retry: () => void;
  showRotateSuggestion: boolean;
  onDismissRotate: () => void;
  endDialogOpen: boolean;
  onEndDialogChange: (open: boolean) => void;
}) {
  const check = usePlayStore((state) => state.pendingChecks[0] ?? null);
  const handouts = usePlayStore((state) => state.handouts);

  return (
    <>
      {check ? (
        <CheckPrompt request={check} onRespond={() => sendSessionCommand("check:respond", { requestId: check.id })} />
      ) : null}
      <HandoutPrompt handouts={handouts} />
      {showRotateSuggestion ? <RotateSuggestionOverlay onDismiss={onDismissRotate} /> : null}
      <SessionTerminalOverlay sessionId={sessionId} onRetry={retry} />
      <Dialog open={endDialogOpen} onOpenChange={onEndDialogChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("play.endedTitle")}</DialogTitle>
            <DialogDescription>{t("play.endedDescription")}</DialogDescription>
          </DialogHeader>
          <Button type="button" variant="primary" onClick={() => onEndDialogChange(false)}>
            {t("play.viewRecords")}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { PlayOverlays };