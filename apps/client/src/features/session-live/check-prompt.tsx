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
import { attrLabel } from "@/lib/format";
import { t } from "@/i18n";

const ROLL_TIMEOUT_MS = 8_000;

export function CheckPrompt({
  request,
  onRespond,
}: {
  request: CheckRequestDto;
  onRespond: () => void;
}) {
  const skill = attrLabel(request.skillKey);
  const difficulty = coc7e.CheckDifficultyLabel[request.difficulty] ?? request.difficulty;
  const [rolling, setRolling] = useState(false);

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
    <Dialog open onOpenChange={() => undefined}>
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
        <Button
          type="button"
          variant="primary"
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
      </DialogContent>
    </Dialog>
  );
}
