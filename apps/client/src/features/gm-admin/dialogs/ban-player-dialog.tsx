import { Info, ShieldBan, X } from "lucide-react";
import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

const durations = ["1 小时", "24 小时", "7 天", "30 天", "永久", "自定义"];

function BanPlayerDialog({
  open,
  onOpenChange,
  playerName = "匿名访客 #f2a9",
  roleLabel = "OB · 观战",
  fingerprint = "指纹 8c1d·4f2a·9e01·f2a9",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerName?: string;
  roleLabel?: string;
  fingerprint?: string;
}) {
  const [duration, setDuration] = useState("7 天");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-130 gap-0 p-0" showCloseButton={false}>
        <DialogHeader className="border-separator flex-row items-start justify-between gap-3 border-b px-5 py-[18px]">
          <div className="flex items-start gap-3">
            <span className="bg-danger-soft flex size-9 shrink-0 items-center justify-center rounded-[10px]">
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
                <span className="text-foreground font-sans text-[13px] font-semibold">{playerName}</span>
                <Badge variant="soft" tone="default" size="sm">
                  {roleLabel}
                </Badge>
              </div>
              <span className="text-foreground-tertiary font-mono text-[11px]">{fingerprint}</span>
            </div>
          </div>

          <FormField label="封禁时长">
            <RadioGroup value={duration} onValueChange={setDuration} className="grid-cols-3">
              {durations.map((option) => {
                const selected = option === duration;
                return (
                  <Label
                    key={option}
                    className={selected
                      ? "bg-danger-soft text-danger-soft-foreground h-[38px] cursor-pointer justify-center rounded-[10px] text-[13px] font-semibold"
                      : "bg-surface-tertiary text-foreground-secondary h-[38px] cursor-pointer justify-center rounded-[10px] text-[13px]"
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
              placeholder="例如：多次恶意刷屏、剧透、人身攻击…"
              className="h-16 min-h-16 resize-none border-separator-secondary text-[13px]"
            />
          </FormField>

          <Alert className="bg-surface-tertiary gap-2.5 rounded-[10px] px-3 py-3 shadow-none">
            <AlertIcon className="mt-0.5 text-foreground-tertiary">
              <Info />
            </AlertIcon>
            <AlertDescription className="text-foreground-secondary text-xs leading-[1.6]">
              指纹为尽力而为的标识，更换浏览器或清除数据后可能失效；拉黑同时会立即断开该连接。
            </AlertDescription>
          </Alert>
        </div>

        <div className="bg-background-secondary border-separator flex items-center justify-end gap-2.5 border-t px-5 py-4">
          <Button variant="tertiary" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="danger" size="sm" onClick={() => onOpenChange(false)}>
            <ShieldBan className="size-[15px]" />
            确认拉黑 {duration}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { BanPlayerDialog };
