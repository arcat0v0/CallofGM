import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "./types";

const SYSTEM_ROLE_LABELS: Record<string, true> = { 骰点: true, SAN: true, 鉴定: true };

function MessageList({
  messages,
  className,
  showRoleBadge = true,
  selfName,
}: {
  messages: ChatMessage[];
  className?: string;
  showRoleBadge?: boolean;
  selfName?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {messages.map((message, index) => {
        if (SYSTEM_ROLE_LABELS[message.speakerRoleLabel] === true) {
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
        const self = Boolean(selfName) && message.speakerName === selfName;
        const previous = messages[index - 1];
        const continued =
          Boolean(previous) &&
          SYSTEM_ROLE_LABELS[previous?.speakerRoleLabel ?? ""] !== true &&
          previous?.speakerName === message.speakerName;
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

export { MessageList };
