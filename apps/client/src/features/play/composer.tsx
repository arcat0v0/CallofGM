import { ChevronDown, Eye, VenetianMask } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MessageInput } from "@/features/chat/message-input";
import { type MessageMode, MessageModeSwitch } from "@/features/chat/message-mode-switch";
import { cn } from "@/lib/utils";
import { expressionTiles, myCharacter } from "./mock-data";

function Composer({ compact = false, className }: { compact?: boolean; className?: string }) {
  const [mode, setMode] = useState<MessageMode>("roleplay");
  const [expression, setExpression] = useState("surprised");

  return (
    <div
      className={cn(
        "border-separator-secondary flex flex-col border-t bg-background-tertiary",
        compact ? "gap-2 px-3 pt-2.5 pb-3" : "gap-2.5 px-4 pt-3 pb-3.5",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" className="-ml-2 h-8 gap-2 px-2" aria-label="切换发言角色">
          <Avatar size="sm" className="bg-default">
            <AvatarFallback className="text-foreground font-sans text-xs">{myCharacter.initials}</AvatarFallback>
          </Avatar>
          <span className="text-foreground font-sans text-[13px] font-semibold">{myCharacter.name}</span>
          <ChevronDown className="text-foreground-tertiary size-3.5" />
        </Button>
        <MessageModeSwitch value={mode} onValueChange={setMode} />
      </div>

      {mode === "roleplay" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <VenetianMask className="text-accent-hover size-[13px]" />
              <span className="text-foreground-secondary font-sans text-[11px] font-semibold">立绘表情</span>
              <span className="text-foreground-tertiary font-sans text-[10px]">· 随本条发言生效</span>
            </div>
            <Button type="button" variant="tertiary" size="sm" className="h-5 gap-1 px-2 text-[10px] text-foreground-secondary">
              <Eye />
              预览立绘
            </Button>
          </div>
          <div className="flex gap-1.5">
            {expressionTiles.map((tile) => {
              const isActive = tile.key === expression;
              return (
                <Button
                  key={tile.key}
                  type="button"
                  onClick={() => setExpression(tile.key)}
                  variant="outline"
                  aria-pressed={isActive}
                  className={cn(
                    "h-[34px] flex-1 rounded-[9px] border-[1.5px] px-2 text-xs",
                    isActive
                      ? "bg-accent-soft border-accent-hover text-accent-soft-foreground hover:bg-accent-soft-hover font-semibold"
                      : "bg-surface-tertiary text-foreground-secondary border-transparent hover:bg-surface-hover font-normal",
                  )}
                >
                  {tile.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <MessageInput placeholder="输入消息…" />

      {!compact && (
        <p className="text-foreground-tertiary font-sans text-[11px]">
          自由演绎 · 每条消息可自选「场外 / 角色扮演」
        </p>
      )}
    </div>
  );
}

export { Composer };
