import { Eye, VenetianMask } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageInput } from "@/features/chat/message-input";
import { type MessageMode, MessageModeSwitch } from "@/features/chat/message-mode-switch";
import { DiceTray } from "@/features/session-live/dice-tray";
import { expressionLabel, initialsOf, phaseChatHint } from "@/lib/format";
import { mediaUrl } from "@/lib/api";
import { sendSessionCommand } from "@/lib/session-socket";
import { cn } from "@/lib/utils";
import { useIdentityStore } from "@/stores/identity-store";
import { usePlayStore } from "@/stores/play-store";

function Composer({ compact = false, className }: { compact?: boolean; className?: string }) {
  const [mode, setMode] = useState<MessageMode>("roleplay");
  const [expression, setExpression] = useState("default");
  const [draft, setDraft] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const playerId = useIdentityStore((state) => state.playerId);
  const phase = usePlayStore((state) => state.phase);
  const status = usePlayStore((state) => state.status);
  const characters = usePlayStore((state) => state.characters);
  const claimed = characters.find((character) => character.claim?.playerId === playerId && character.claim.role === "pc");
  const isOb = !claimed && characters.some((character) => character.claim?.playerId === playerId && character.claim.role === "ob");
  const speakerName = claimed?.name ?? (isOb ? "观战" : "玩家");
  const canExpress = Boolean(claimed);
  const expressionOptions =
    claimed?.portraits?.map((portrait) => ({
      key: portrait.expressionKey,
      label: expressionLabel(portrait.expressionKey),
      src: mediaUrl(portrait.portraitAssetId),
    })) ?? [];

  const ended = status === "ended";
  const forcedCg = phase === "forced_cg";
  const discussion = phase === "free_discussion";
  const performance = phase === "performance_time";
  const chatDisabled = ended || forcedCg;
  const diceDisabled = ended || forcedCg || performance;
  const effectiveMode: MessageMode = discussion ? "ooc" : performance ? "roleplay" : mode;

  useEffect(() => {
    if (discussion) setMode("ooc");
    if (performance) setMode("roleplay");
  }, [discussion, performance]);

  function handleSend() {
    const content = draft.trim();
    if (!content || chatDisabled) {
      return;
    }
    const sent = sendSessionCommand("chat:send", {
      channel: effectiveMode === "ooc" ? "ooc" : "roleplay",
      content,
      ...(effectiveMode === "roleplay" && canExpress ? { expressionKey: expression } : {}),
    });
    if (!sent) {
      toast.error("尚未连接到团");
      return;
    }
    setDraft("");
  }

  const hint = phaseChatHint(phase);

  return (
    <div
      className={cn(
        "bg-md-surface-container flex flex-col",
        compact ? "gap-2 px-3 pt-2.5 pb-3" : "gap-2.5 px-4 pt-3 pb-3.5",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 px-1">
          <Avatar size="sm" className="bg-default">
            <AvatarFallback className="text-foreground font-sans text-label-medium">{initialsOf(speakerName)}</AvatarFallback>
          </Avatar>
          <span className="text-foreground font-sans text-label-large">{speakerName}</span>
        </div>
        {discussion || performance ? null : (
          <MessageModeSwitch value={mode} onValueChange={setMode} />
        )}
      </div>

      {effectiveMode === "roleplay" && canExpress && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <VenetianMask className="text-accent-hover size-[13px]" />
              <span className="text-foreground-secondary font-sans text-label-small">立绘表情</span>
            </div>
            <Button type="button" variant="tertiary" size="icon-sm" aria-label="预览立绘" onClick={() => setPreviewOpen(true)}>
              <Eye />
            </Button>
          </div>
          <div className="bg-md-surface-container-high flex rounded-full p-0.5">
            {(expressionOptions.length > 0 ? expressionOptions : [{ key: "default", label: "默认", src: null }]).map((tile) => {
              const isActive = tile.key === expression;
              return (
                <button
                  key={tile.key}
                  type="button"
                  onClick={() => setExpression(tile.key)}
                  aria-pressed={isActive}
                  className={cn(
                    "h-7 flex-1 rounded-full px-2 transition-all duration-350 ease-expressive-fast-spatial",
                    isActive
                      ? "bg-md-secondary-container text-md-on-secondary-container text-label-medium-emph"
                      : "text-label-medium text-md-on-surface-variant hover:bg-md-surface-container-highest",
                  )}
                >
                  {tile.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <DiceTray characterId={claimed?.characterId} disabled={diceDisabled} />

      <MessageInput
        placeholder={chatDisabled ? "当前阶段不可发言" : "输入消息…"}
        value={draft}
        onChange={setDraft}
        onSubmit={handleSend}
        disabled={chatDisabled}
      />

      <p className="text-foreground-tertiary font-sans text-label-small">{hint}</p>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>立绘预览 · {speakerName}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {expressionOptions.map((tile) => (
              <button key={tile.key} type="button" className="flex flex-col gap-1" onClick={() => setExpression(tile.key)}>
                {tile.src ? <img src={tile.src} alt={tile.label} className="h-40 w-full object-contain" /> : <div className="bg-default h-40" />}
                <span className="text-center text-label-medium">{tile.label}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { Composer };
