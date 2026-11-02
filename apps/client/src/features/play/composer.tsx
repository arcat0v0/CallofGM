import { decideChatMessage } from "@cogm/shared";
import { Eye, Send, VenetianMask } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type MessageMode, MessageModeSwitch } from "@/features/chat/message-mode-switch";
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
  const showExpression = effectiveMode === "roleplay" && canExpress;

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

  const placeholder = ended
    ? t("chat.endedPlaceholder")
    : chatDisabled
      ? t("chat.disabledPlaceholder")
      : t("chat.placeholder");

  return (
    <form
      className={cn("shrink-0", compact ? "px-3 pb-2.5" : "px-3.5 pb-3.5", className)}
      onSubmit={(event) => {
        event.preventDefault();
        handleSend();
      }}
    >
      <div
        className={cn(
          "border border-md-outline-variant/40 bg-md-surface-container/70 flex flex-col rounded-xl",
          compact ? "gap-2 p-2.5" : "gap-2.5 p-3",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Avatar size="sm" className={cn("shrink-0", compact ? "size-6" : "size-7")}>
              <AvatarFallback
                className={cn(
                  "text-foreground font-sans",
                  compact ? "text-label-small" : "text-label-small",
                )}
              >
                {initialsOf(speakerName)}
              </AvatarFallback>
            </Avatar>
            <span className="text-foreground min-w-0 truncate font-sans text-label-medium">
              {speakerName}
            </span>
            {showExpression ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    aria-label={t("chat.expression")}
                    title={t("chat.expression")}
                    className="text-md-on-surface-variant h-6 shrink-0 gap-1 rounded-full px-2 text-label-small"
                  >
                    <VenetianMask className="size-3.5" />
                    {expressionLabel(expression)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" side="top" className="w-72 p-3">
                  <div className="grid grid-cols-3 gap-2">
                    {expressionOptions.map((tile) => {
                      const isActive = tile.key === expression;
                      return (
                        <button
                          key={tile.key}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => setExpression(tile.key)}
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-lg p-1.5 outline-none transition-colors duration-150 ease-standard-fast-effects focus-visible:ring-4 focus-visible:ring-focus-ring/50",
                            isActive
                              ? "bg-accent-soft text-accent-soft-foreground"
                              : "text-md-on-surface-variant hover:bg-md-on-surface/8",
                          )}
                        >
                          {tile.src ? (
                            <img src={tile.src} alt="" className="h-16 w-full object-contain" />
                          ) : (
                            <span className="bg-default h-16 w-full rounded-md" />
                          )}
                          <span className="text-label-small">{tile.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="text-md-on-surface-variant mt-2 h-8 w-full gap-1.5 text-label-small"
                    onClick={() => setPreviewOpen(true)}
                  >
                    <Eye className="size-3.5" />
                    {t("chat.previewPortrait")}
                  </Button>
                </PopoverContent>
              </Popover>
            ) : null}
          </div>
          {performance || discussion || ended || phase === "forced_cg" ? (
            <Badge variant="soft" tone="default" size="sm" className="shrink-0">
              {ended
                ? t("status.ended")
                : discussion
                  ? t("chat.ooc")
                  : performance
                    ? t("chat.roleplay")
                    : t("phase.forced_cg")}
            </Badge>
          ) : (
            <div className="shrink-0">
              <MessageModeSwitch value={effectiveMode} onValueChange={setMode} />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <InputGroup
            className={cn(
              "border-md-outline-variant/40 bg-md-surface-container-high/55 flex-1 rounded-full px-3.5",
              compact ? "h-9" : "h-10",
            )}
          >
            <InputGroupInput
              placeholder={placeholder}
              aria-label={placeholder}
              className="text-body-medium"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={chatDisabled}
            />
          </InputGroup>
          <Button
            type="submit"
            variant="primary"
            size="icon-sm"
            aria-label={t("chat.send")}
            disabled={chatDisabled || draft.trim().length === 0}
            className={cn("shrink-0", compact ? "size-9" : "size-10")}
          >
            <Send className="size-4" />
          </Button>
        </div>

        <p
          className={cn(
            "px-1 text-label-small",
            discussion ? "text-accent" : "text-md-on-surface-variant/70",
          )}
        >
          {hint}
        </p>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("chat.portraitPreviewTitle", { name: speakerName })}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {expressionOptions.map((tile) => (
              <button
                key={tile.key}
                type="button"
                aria-pressed={tile.key === expression}
                className="flex flex-col gap-1"
                onClick={() => setExpression(tile.key)}
              >
                {tile.src ? (
                  <img src={tile.src} alt={tile.label} className="h-40 w-full object-contain" />
                ) : (
                  <div className="bg-default h-40" />
                )}
                <span className="text-center text-label-medium">{tile.label}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}

export { Composer };
