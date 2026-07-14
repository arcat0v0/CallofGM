import { ChevronDown, Eye, Send, VenetianMask } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { expressionTiles, myCharacter } from "./mock-data";

function Composer({ compact = false, className }: { compact?: boolean; className?: string }) {
  const [mode, setMode] = useState<"roleplay" | "ooc">("roleplay");
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
        <div className="flex items-center gap-2">
          <Avatar size="sm" className="bg-default">
            <AvatarFallback className="text-foreground font-sans text-xs">{myCharacter.initials}</AvatarFallback>
          </Avatar>
          <span className="text-foreground font-sans text-[13px] font-semibold">{myCharacter.name}</span>
          <ChevronDown className="text-foreground-tertiary size-3.5" />
        </div>
        <div className="bg-default flex items-center gap-0.5 rounded-full p-0.5">
          <button
            type="button"
            onClick={() => setMode("roleplay")}
            className={cn(
              "flex h-6 items-center justify-center rounded-full px-3 font-sans text-xs font-semibold",
              mode === "roleplay"
                ? "from-accent to-accent-hover text-accent-foreground bg-gradient-to-b"
                : "text-foreground-secondary font-medium",
            )}
          >
            角色扮演
          </button>
          <button
            type="button"
            onClick={() => setMode("ooc")}
            className={cn(
              "flex h-6 items-center justify-center rounded-full px-3 font-sans text-xs font-semibold",
              mode === "ooc"
                ? "from-accent to-accent-hover text-accent-foreground bg-gradient-to-b"
                : "text-foreground-secondary font-medium",
            )}
          >
            场外
          </button>
        </div>
      </div>

      {mode === "roleplay" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <VenetianMask className="text-accent-hover size-[13px]" />
              <span className="text-foreground-secondary font-sans text-[11px] font-semibold">立绘表情</span>
              <span className="text-foreground-tertiary font-sans text-[10px]">· 随本条发言生效</span>
            </div>
            <button type="button" className="bg-default flex items-center gap-1 rounded-full px-2 py-0.5">
              <Eye className="text-foreground-secondary size-3" />
              <span className="text-foreground-secondary font-sans text-[10px] font-medium">预览立绘</span>
            </button>
          </div>
          <div className="flex gap-1.5">
            {expressionTiles.map((tile) => {
              const isActive = tile.key === expression;
              return (
                <button
                  key={tile.key}
                  type="button"
                  onClick={() => setExpression(tile.key)}
                  className={cn(
                    "flex h-[34px] flex-1 items-center justify-center rounded-[9px] border-[1.5px] font-sans text-xs",
                    isActive
                      ? "bg-accent-soft border-accent-hover text-accent-soft-foreground font-semibold"
                      : "bg-surface-tertiary text-foreground-secondary border-transparent font-normal",
                  )}
                >
                  {tile.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="border-separator-secondary flex h-10 flex-1 items-center rounded-xl border bg-field px-3.5">
          <input
            type="text"
            placeholder="输入消息…"
            className="text-field-foreground placeholder:text-field-placeholder w-full bg-transparent font-sans text-[13px] outline-none"
          />
        </div>
        <button
          type="button"
          className="from-accent to-accent-hover flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br"
        >
          <Send className="text-accent-foreground size-[17px]" />
        </button>
      </div>

      {!compact && (
        <p className="text-foreground-tertiary font-sans text-[11px]">
          自由演绎 · 每条消息可自选「场外 / 角色扮演」
        </p>
      )}
    </div>
  );
}

export { Composer };
