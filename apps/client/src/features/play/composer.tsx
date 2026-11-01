import { canPlayerInitiateDiceRoll, decideChatMessage } from "@cogm/shared";
import { Dices, Eye, VenetianMask } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageInput } from "@/features/chat/message-input";
import { type MessageMode, MessageModeSwitch } from "@/features/chat/message-mode-switch";
import { DiceTray } from "@/features/session-live/dice-tray";
import { expressionLabel, initialsOf, phaseChatHint } from "@/lib/format";
import { mediaUrl } from "@/lib/api";
import { sendSessionCommand } from "@/lib/session-socket";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { useIdentityStore } from "@/stores/identity-store";
import { useBlockingModalOpen } from "@/stores/modal-store";
import { usePlayStore } from "@/stores/play-store";

function Composer({ compact = false, className }: { compact?: boolean; className?: string }) {
  const [mode, setMode] = useState<MessageMode>("roleplay");
  const [draft, setDraft] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const playerId = useIdentityStore((state) => state.playerId);
  const phase = usePlayStore((state) => state.phase);
  const status = usePlayStore((state) => state.status);
  const characters = usePlayStore((state) => state.characters);
  const lastRejection = usePlayStore((state) => state.lastRejection);
  const seatRole = usePlayStore((state) => state.viewer.seatRole);
  const blockingModalOpen = useBlockingModalOpen();
  const claimed = characters.find((character) => character.claim?.playerId === playerId && character.claim.role === "pc");
  const isOb = seatRole === "ob";
  const speakerName = claimed?.name ?? (isOb ? t("chat.spectatorFallback") : t("chat.playerFallback"));
  const expressionOptions =
    claimed?.portraits?.map((portrait) => ({
      key: portrait.expressionKey,
      label: expressionLabel(portrait.expressionKey),
      src: mediaUrl(portrait.portraitAssetId),
    })) ?? [];
  const canExpress = Boolean(claimed && expressionOptions.length > 0);
  const [expression, setExpression] = useState(expressionOptions[0]?.key ?? "");

  const pendingSendsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (expressionOptions.length > 0 && !expressionOptions.some((opt) => opt.key === expression)) {
      setExpression(expressionOptions[0]?.key ?? "");
    }
  }, [expressionOptions, expression]);

  useEffect(() => {
    if (!lastRejection) return;
    const restoredText = pendingSendsRef.current.get(lastRejection.commandId);
    if (restoredText !== undefined) {
      pendingSendsRef.current.delete(lastRejection.commandId);
      setDraft((current) => (current ? `${current} ${restoredText}` : restoredText));
    }
  }, [lastRejection]);

  const ended = status === "ended";
  const discussion = phase === "free_discussion";
  const performance = phase === "performance_time";
  const effectiveMode: MessageMode = discussion ? "ooc" : performance ? "roleplay" : mode;
  const messageForbidden =
    phase !== null && decideChatMessage(phase, "player", seatRole, effectiveMode === "ooc" ? "ooc" : "roleplay").kind === "forbidden";
  const chatDisabled = ended || messageForbidden;
  const diceDisabled = ended || phase === null || !canPlayerInitiateDiceRoll(phase, "player", seatRole);

  useEffect(() => {
    if (discussion) setMode("ooc");
    if (performance) setMode("roleplay");
  }, [discussion, performance]);

  function handleSend() {
    const content = draft.trim();
    if (!content || chatDisabled || blockingModalOpen) {
      return;
    }
    const sent = sendSessionCommand("chat:send", {
      channel: effectiveMode === "ooc" ? "ooc" : "roleplay",
      content,
      ...(effectiveMode === "roleplay" && canExpress && expression ? { expressionKey: expression } : {}),
    });
    if (!sent) {
      toast.error(t("chat.notConnected"));
      return;
    }
    const pending = pendingSendsRef.current;
    pending.set(sent, content);
    while (pending.size > 10) {
      const oldest = pending.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      pending.delete(oldest);
    }
    setDraft("");
  }

  const hint = ended
    ? t("chat.hint.ended")
    : discussion
      ? t("chat.hint.discussion")
      : isOb
        ? t("chat.hint.spectator")
        : phaseChatHint(phase);

  return (
    <div
      className={cn(
        "bg-md-surface-container flex flex-col",
        compact ? "gap-1.5 px-3 pt-2 pb-2.5" : "gap-2.5 px-4 pt-3 pb-3.5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 px-1">
          <Avatar size="sm" className="bg-default">
            <AvatarFallback className="text-foreground font-sans text-label-medium">{initialsOf(speakerName)}</AvatarFallback>
          </Avatar>
          <span className="text-foreground truncate font-sans text-label-large">{speakerName}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {compact ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="tertiary"
                  size="icon-sm"
                  aria-label={t("chat.diceAria")}
                  disabled={diceDisabled}
                >
                  <Dices />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="end" className="w-[min(316px,calc(100vw-24px))] p-3">
                <DiceTray characterId={claimed?.characterId} disabled={diceDisabled} />
              </PopoverContent>
            </Popover>
          ) : null}
          {performance ? null : (
            <MessageModeSwitch value={effectiveMode} onValueChange={setMode} roleplayDisabled={discussion} />
          )}
        </div>
      </div>

      {effectiveMode === "roleplay" && canExpress && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <VenetianMask className="text-accent-hover size-[13px]" />
              <span className="text-foreground-secondary font-sans text-label-small">{t("chat.expression")}</span>
            </div>
            <Button type="button" variant="tertiary" size="icon-sm" aria-label={t("chat.previewPortrait")} onClick={() => setPreviewOpen(true)}>
              <Eye />
            </Button>
          </div>
          <div className="bg-md-surface-container-high flex rounded-full p-0.5">
            {expressionOptions.map((tile) => {
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

      {compact ? null : <DiceTray characterId={claimed?.characterId} disabled={diceDisabled} />}

      <MessageInput
        compact={compact}
        placeholder={
          ended
            ? t("chat.endedPlaceholder")
            : chatDisabled
              ? t("chat.disabledPlaceholder")
              : t("chat.placeholder")
        }
        value={draft}
        onChange={setDraft}
        onSubmit={handleSend}
        disabled={chatDisabled}
      />

      <p className={cn("font-sans text-label-small", discussion ? "text-accent" : "text-foreground-tertiary")}>
        {hint}
      </p>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("chat.portraitPreviewTitle", { name: speakerName })}</DialogTitle>
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
