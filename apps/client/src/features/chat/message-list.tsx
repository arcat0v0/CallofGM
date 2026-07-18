import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "./types";

function MessageList({
  messages,
  className,
  showRoleBadge = true,
}: {
  messages: ChatMessage[];
  className?: string;
  showRoleBadge?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-3.5", className)}>
      {messages.map((message) => (
        <div key={message.id} className="flex w-full gap-2.5">
          <Avatar size="sm" className={cn("shrink-0", message.avatarBg)}>
            <AvatarFallback className={cn("font-sans text-xs", message.avatarFg)}>
              {message.avatarInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex w-full min-w-0 flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-foreground font-sans text-[13px] font-semibold">{message.speakerName}</span>
              {showRoleBadge ? (
                <Badge variant="soft" tone="accent" size="sm">
                  {message.speakerRoleLabel}
                </Badge>
              ) : null}
              <span className="text-foreground-tertiary font-chip text-[11px]">{message.time}</span>
            </div>
            <p className={cn("font-sans text-[13px] leading-[1.65]", message.tone === "ooc" ? "text-foreground-secondary" : "text-dialogue-text")}>
              {message.body}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export { MessageList };
