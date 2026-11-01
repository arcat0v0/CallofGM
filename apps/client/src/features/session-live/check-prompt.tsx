import { coc7e, type CheckRequestDto } from "@cogm/shared";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBlockingDialog } from "@/stores/modal-store";
import { t } from "@/i18n";

const ROLL_TIMEOUT_MS = 8_000;

export function CheckPrompt({
  request,
  onRespond,
  onDismiss,
}: {
  request: CheckRequestDto;
  onRespond: () => void;
  onDismiss: () => void;
}) {
  const skill = coc7e.coc7eSkillLabel(request.skillKey);
  const difficulty = coc7e.CheckDifficultyLabel[request.difficulty] ?? request.difficulty;
  const [rolling, setRolling] = useState(false);
  const dialog = useBlockingDialog("check", true, () => onDismiss());

  useEffect(() => {
    setRolling(false);
  }, [request.id]);

  useEffect(() => {
    if (!rolling) {
      return;
    }
    const timer = window.setTimeout(() => {
      setRolling(false);
    }, ROLL_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [rolling]);

  return (
    <Dialog open={dialog.open} onOpenChange={(next) => !next && onDismiss()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("check.title")}</DialogTitle>
          <DialogDescription>
            {skill} · {difficulty}
            {request.hidden ? t("check.hiddenSuffix") : ""}
          </DialogDescription>
        </DialogHeader>
        <p className="text-foreground-secondary text-body-medium">
          {t("check.description")}
          {request.hidden ? t("check.hiddenNote") : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onDismiss} className="flex-1">
            {t("check.later")}
          </Button>
          <Button
            type="button"
            variant="primary"
            className="flex-1"
            disabled={rolling}
            onClick={() => {
              if (rolling) {
                return;
              }
              setRolling(true);
              onRespond();
            }}
          >
            {rolling ? t("check.rolling") : t("check.roll")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
