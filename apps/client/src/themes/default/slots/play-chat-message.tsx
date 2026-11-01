import type { PlayChatMessageCtx } from "@cogm/theme-sdk";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PlayChatMessage({ message }: PlayChatMessageCtx) {
  if (message.isSystem) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-350 ease-expressive-fast-spatial flex flex-col items-center gap-0.5 text-center">
        <span className="text-label-medium text-md-on-surface-variant font-sans">
          {message.speakerName} · {message.body}
        </span>
        <span className="text-label-small text-md-outline">{message.time}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "animate-in fade-in slide-in-from-bottom-2 duration-350 ease-expressive-fast-spatial flex w-full gap-2.5",
        message.self && "flex-row-reverse",
        message.continued && "-mt-2",
      )}
    >
      {message.self ? null : message.continued ? (
        <span className="size-8 shrink-0" />
      ) : (
        <Avatar size="sm" className={cn("shrink-0", message.avatarBg)}>
          <AvatarFallback className={cn("font-sans text-label-medium", message.avatarFg)}>
            {message.avatarInitials}
          </AvatarFallback>
        </Avatar>
      )}
      <div className={cn("flex min-w-0 max-w-[85%] flex-col gap-0.5", message.self ? "items-end" : "items-start")}>
        {!message.continued ? (
          <div className={cn("flex items-center gap-1.5", message.self && "flex-row-reverse")}>
            <span className="text-md-on-surface font-sans text-label-large">{message.speakerName}</span>
            {message.showRoleBadge ? (
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
            message.self
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
}