import { Info, ShieldBan, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FormField } from "@/components/shared/form-field";
import { Alert, AlertDescription, AlertIcon } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

const durations = ["1 小时", "24 小时", "7 天", "30 天", "永久", "自定义"] as const;

const durationSeconds: Record<(typeof durations)[number], number | undefined> = {
  "1 小时": 3600,
  "24 小时": 86400,
  "7 天": 7 * 86400,
  "30 天": 30 * 86400,
  永久: undefined,
  自定义: undefined,
};

function shortHash(hash: string): string {
  return hash.length <= 16 ? hash : `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

function BanPlayerDialog({
  open,
  onOpenChange,
  playerName = "匿名访客",
  roleLabel = "玩家",
  fingerprint = "",
  defaultPlayerId = "",
  defaultFingerprintHash = "",
  onBan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerName?: string;
  roleLabel?: string;
  fingerprint?: string;
  defaultPlayerId?: string;
  defaultFingerprintHash?: string;
  onBan?: (input: {
    playerId?: string;
    fingerprintHash?: string;
    reason: string;
    durationSeconds?: number;
  }) => void | Promise<void>;
}) {
  const [duration, setDuration] = useState<(typeof durations)[number]>("7 天");
  const [playerId, setPlayerId] = useState(defaultPlayerId);
  const [fingerprintHash, setFingerprintHash] = useState(defaultFingerprintHash);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setPlayerId(defaultPlayerId);
    setFingerprintHash(defaultFingerprintHash);
    setReason("");
    setDuration("7 天");
  }, [open, defaultPlayerId, defaultFingerprintHash]);

  const hashOnly = defaultFingerprintHash.trim().length > 0;
  const ready = (playerId.trim() || fingerprintHash.trim()).length > 0;

  async function handleBan() {
    const trimmedPlayerId = playerId.trim();
    const trimmedHash = fingerprintHash.trim();
    if (!ready || pending) {
      return;
    }
    setPending(true);
    try {
      await onBan?.({
        ...(trimmedPlayerId
          ? { playerId: trimmedPlayerId, fingerprintHash: undefined }
          : { fingerprintHash: trimmedHash, playerId: undefined }),
        reason,
        durationSeconds: durationSeconds[duration],
      });
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-130 gap-0 p-0" showCloseButton={false}>
        <DialogHeader className="flex-row items-start justify-between gap-3 px-5 py-[18px]">
          <div className="flex items-start gap-3">
            <span className="bg-danger-soft flex size-9 shrink-0 items-center justify-center rounded-md">
              <ShieldBan className="text-danger-soft-foreground size-[18px]" />
            </span>
            <div className="flex flex-col gap-0.5">
              <DialogTitle>拉黑玩家</DialogTitle>
              <DialogDescription>将该浏览器指纹加入黑名单，握手时拦截</DialogDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="关闭拉黑玩家弹窗" onClick={() => onOpenChange(false)}>
            <X />
          </Button>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-5 py-5">
          <div className="bg-surface-tertiary flex items-center gap-3 rounded-xl px-3 py-3">
            <Avatar size="md" className="bg-default">
              <AvatarFallback className="text-foreground-secondary">?</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-foreground font-sans text-label-large-emph">{playerName}</span>
                <Badge variant="soft" tone="default" size="sm">
                  {roleLabel}
                </Badge>
              </div>
              <span className="text-foreground-tertiary font-mono text-label-small">
                {fingerprint || (hashOnly ? shortHash(defaultFingerprintHash) : "输入玩家 ID 封禁")}
              </span>
            </div>
          </div>

          {hashOnly ? (
            <FormField label="指纹哈希" htmlFor="ban-fingerprint-hash">
              <Input
                id="ban-fingerprint-hash"
                value={fingerprintHash}
                readOnly
                className="border-separator-secondary font-mono text-label-large"
              />
            </FormField>
          ) : (
            <FormField label="玩家 ID" htmlFor="ban-player-id">
              <Input
                id="ban-player-id"
                value={playerId}
                onChange={(event) => setPlayerId(event.target.value)}
                placeholder="playerId"
                className="border-separator-secondary font-mono text-label-large"
              />
            </FormField>
          )}

          <FormField label="封禁时长">
            <RadioGroup value={duration} onValueChange={(value) => setDuration(value as (typeof durations)[number])} className="grid-cols-3">
              {durations.map((option) => {
                const selected = option === duration;
                return (
                  <Label
                    key={option}
                    className={selected
                      ? "bg-danger-soft text-danger-soft-foreground h-[38px] cursor-pointer justify-center rounded-md text-label-large-emph"
                      : "bg-surface-tertiary text-foreground-secondary h-[38px] cursor-pointer justify-center rounded-md text-label-large"
                    }
                  >
                    <RadioGroupItem value={option} className="data-checked:border-danger-soft-foreground data-checked:bg-danger-soft-foreground" />
                    {option}
                  </Label>
                );
              })}
            </RadioGroup>
          </FormField>

          <FormField label="封禁备注（可选）" htmlFor="ban-note">
            <Textarea
              id="ban-note"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="例如：多次恶意刷屏、剧透、人身攻击…"
              className="h-16 min-h-16 resize-none border-separator-secondary text-body-medium"
            />
          </FormField>

          <Alert className="bg-surface-tertiary gap-2.5 rounded-md px-3 py-3 shadow-none">
            <AlertIcon className="mt-0.5 text-foreground-tertiary">
              <Info />
            </AlertIcon>
            <AlertDescription className="text-foreground-secondary text-body-small">
              指纹为尽力而为的标识，更换浏览器或清除数据后可能失效；拉黑同时会立即断开该连接。
            </AlertDescription>
          </Alert>
        </div>

        <div className="bg-md-surface-container-low flex items-center justify-end gap-2.5 rounded-b-xl px-5 py-4">
          <Button variant="tertiary" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="danger" size="sm" disabled={!ready || pending} onClick={() => void handleBan()}>
            <ShieldBan className="size-[15px]" />
            确认拉黑 {duration}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { BanPlayerDialog };
