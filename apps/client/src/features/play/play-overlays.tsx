import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckPrompt } from "@/features/session-live/check-prompt";
import { HandoutPrompt } from "@/features/session-live/handout-prompt";
import { sendSessionCommand } from "@/lib/session-socket";
import { useBlockingDialog, useBlockingModalOpen } from "@/stores/modal-store";
import { usePlayStore } from "@/stores/play-store";
import { RotateSuggestionOverlay } from "./rotate-suggestion-overlay";
import { SessionTerminalOverlay } from "./session-terminal-overlay";
import { t } from "@/i18n";

function PlayOverlays({
  sessionId,
  retry,
  showRotateSuggestion,
  onDismissRotate,
  endDialogOpen,
  onEndDialogChange,
  handoutPromptEnabled,
}: {
  sessionId: string;
  retry: () => void;
  showRotateSuggestion: boolean;
  onDismissRotate: () => void;
  endDialogOpen: boolean;
  onEndDialogChange: (open: boolean) => void;
  handoutPromptEnabled: boolean;
}) {
  const pendingChecks = usePlayStore((state) => state.pendingChecks);
  const dismissedChecks = usePlayStore((state) => state.dismissedChecks);
  const dismissCheck = usePlayStore((state) => state.dismissCheck);
  const handouts = usePlayStore((state) => state.handouts);
  const check = pendingChecks.find((item) => !dismissedChecks.includes(item.id)) ?? null;
  const endDialog = useBlockingDialog("end", endDialogOpen, onEndDialogChange);
  const blockingModalOpen = useBlockingModalOpen();

  return (
    <>
      {check ? (
        <CheckPrompt
          request={check}
          onRespond={() => sendSessionCommand("check:respond", { requestId: check.id })}
          onDismiss={() => dismissCheck(check.id)}
        />
      ) : null}
      {handoutPromptEnabled ? <HandoutPrompt handouts={handouts} /> : null}
      {showRotateSuggestion && !blockingModalOpen ? <RotateSuggestionOverlay onDismiss={onDismissRotate} /> : null}
      <SessionTerminalOverlay sessionId={sessionId} onRetry={retry} />
      <Dialog open={endDialog.open} onOpenChange={endDialog.onOpenChange}>
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
