import { Fragment, type ReactNode, useLayoutEffect, useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "./types";

type MessageMeta = {
  self: boolean;
  continued: boolean;
  isSystem: boolean;
};

function isSystemMessage(message: ChatMessage): boolean {
  return message.isSystem === true;
}

function MessageList({
  messages,
  className,
  showRoleBadge = true,
  selfName,
  onLoadOlder,
  hasOlderHistory = false,
  loadingOlder = false,
  olderLoads = 0,
  renderMessage,
}: {
  messages: ChatMessage[];
  className?: string;
  showRoleBadge?: boolean;
  selfName?: string;
  onLoadOlder?: () => void;
  hasOlderHistory?: boolean;
  loadingOlder?: boolean;
  olderLoads?: number;
  renderMessage?: (message: ChatMessage, meta: MessageMeta) => ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const anchor = useRef<{ firstId: string | undefined; height: number; top: number } | null>(null);

  const rememberPosition = () => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    anchor.current = { firstId: messages[0]?.id, height: container.scrollHeight, top: container.scrollTop };
  };

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const previous = anchor.current;
    const firstId = messages[0]?.id;
    if (previous && previous.firstId !== undefined && firstId !== previous.firstId) {
      const grown = container.scrollHeight - previous.height;
      if (grown > 0) {
        container.scrollTop = previous.top + grown;
      }
    }
    rememberPosition();
  }, [messages]);

  const showOlderControl = Boolean(onLoadOlder) && (hasOlderHistory || olderLoads > 0);

  return (
    <div
      data-slot="message-list"
      ref={containerRef}
      onScroll={rememberPosition}
      className={cn("flex flex-col gap-3", className)}
    >
      {showOlderControl ? (
        <div className="flex shrink-0 justify-center">
          {hasOlderHistory ? (
            <Button
              variant="tonal"
              size="xs"
              className="h-8 px-3.5 text-label-medium"
              disabled={loadingOlder}
              onClick={onLoadOlder}
            >
              {loadingOlder ? t("common.loading") : t("chat.loadMore")}
            </Button>
          ) : (
            <span className="text-label-small text-md-outline font-sans">{t("chat.historyStart")}</span>
          )}
        </div>
      ) : null}
      {messages.map((message, index) => {
        const system = isSystemMessage(message);
        const self = Boolean(selfName) && message.speakerName === selfName;
        const previous = messages[index - 1];
        const continued =
          !system &&
          previous !== undefined &&
          !isSystemMessage(previous) &&
          previous.speakerName === message.speakerName;
        const meta: MessageMeta = { self, continued, isSystem: system };

        if (renderMessage) {
          return <Fragment key={message.id}>{renderMessage(message, meta)}</Fragment>;
        }

        if (system) {
          return (
            <div
              key={message.id}
              className="animate-in fade-in slide-in-from-bottom-2 duration-350 ease-expressive-fast-spatial flex flex-col items-center gap-0.5 text-center"
            >
              <span className="text-label-medium text-md-on-surface-variant font-sans">
                {message.speakerName} · {message.body}
              </span>
              <span className="text-label-small text-md-outline">{message.time}</span>
            </div>
          );
        }
        return (
          <div
            key={message.id}
            className={cn(
              "animate-in fade-in slide-in-from-bottom-2 duration-350 ease-expressive-fast-spatial flex w-full gap-2.5",
              self && "flex-row-reverse",
              continued && "-mt-2",
            )}
          >
            {self ? null : continued ? (
              <span className="size-8 shrink-0" />
            ) : (
              <Avatar size="sm" className={cn("shrink-0", message.avatarBg)}>
                <AvatarFallback className={cn("font-sans text-label-medium", message.avatarFg)}>
                  {message.avatarInitials}
                </AvatarFallback>
              </Avatar>
            )}
            <div className={cn("flex min-w-0 max-w-[85%] flex-col gap-0.5", self ? "items-end" : "items-start")}>
              {!continued ? (
                <div className={cn("flex items-center gap-1.5", self && "flex-row-reverse")}>
                  <span className="text-md-on-surface font-sans text-label-large">{message.speakerName}</span>
                  {showRoleBadge ? (
                    <Badge variant="soft" tone="accent" size="sm">
                      {message.speakerRoleLabel}
                    </Badge>
                  ) : null}
                  <span className="text-label-small text-md-outline">{message.time}</span>
                </div>
              ) : null}
              <p
                className={cn(
                  "w-fit rounded-2xl px-3.5 py-2 font-sans text-body-medium",
                  self
                    ? "bg-md-primary-container text-md-on-primary-container"
                    : cn(
                        "bg-md-surface-container-high",
                        message.tone === "ooc" ? "text-md-on-surface-variant" : "text-md-on-surface",
                      ),
                )}
              >
                {message.body}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { MessageList, isSystemMessage };
export type { MessageMeta };
