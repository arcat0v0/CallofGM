import { Info, ShieldBan, X } from "lucide-react";
import { useState } from "react";
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
import { cn } from "@/lib/utils";

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
          <Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)}>
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

          <div className="flex flex-col gap-2">
            <span className="text-foreground font-sans text-[13px] font-semibold">封禁时长</span>
            <div className="grid grid-cols-3 gap-2">
              {durations.map((option) => {
                const selected = option === duration;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDuration(option)}
                    className={cn(
                      "flex h-[38px] items-center justify-center gap-2 rounded-[10px] font-sans text-[13px]",
                      selected ? "bg-danger-soft text-danger-soft-foreground font-semibold" : "bg-surface-tertiary text-foreground-secondary",
                    )}
                  >
                    <span
                      className={cn(
                        "size-[15px] rounded-full border-[1.5px]",
                        selected ? "border-[4.5px] border-danger-soft-foreground" : "border-separator-tertiary",
                      )}
                    />
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-foreground font-sans text-[13px] font-semibold">封禁备注（可选）</span>
            <textarea
              placeholder="例如：多次恶意刷屏、剧透、人身攻击…"
              className="border-separator-secondary bg-field text-field-foreground placeholder:text-field-placeholder h-16 resize-none rounded-[10px] border px-3 py-2.5 font-sans text-[13px] outline-none"
            />
          </div>

          <div className="bg-surface-tertiary flex items-start gap-2.5 rounded-[10px] px-3 py-3">
            <Info className="text-foreground-tertiary mt-0.5 size-[15px] shrink-0" />
            <p className="text-foreground-secondary font-sans text-xs leading-[1.6]">
              指纹为尽力而为的标识，更换浏览器或清除数据后可能失效；拉黑同时会立即断开该连接。
            </p>
          </div>
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
