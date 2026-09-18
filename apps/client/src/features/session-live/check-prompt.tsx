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
import { ATTR_LABELS } from "@/lib/format";

const ROLL_TIMEOUT_MS = 8_000;

export function CheckPrompt({
  request,
  onRespond,
}: {
  request: CheckRequestDto;
  onRespond: () => void;
}) {
  const skill = ATTR_LABELS[request.skillKey]?.label ?? request.skillKey;
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
          <DialogTitle>鉴定请求</DialogTitle>
          <DialogDescription>
            {skill} · {difficulty}
            {request.hidden ? " · 暗骰（结果仅主持可见）" : ""}
          </DialogDescription>
        </DialogHeader>
        <p className="text-foreground-secondary text-body-medium">
          目标值由服务端从人物卡读取。点击后立即掷骰，不受当前阶段限制。
          {request.hidden ? "暗骰仅确认已掷出。" : ""}
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
          {rolling ? "掷骰中…" : "一键掷骰"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
