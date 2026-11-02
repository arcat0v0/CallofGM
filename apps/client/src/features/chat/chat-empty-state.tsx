import { MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";

function ChatEmptyState({
  title,
  description,
  variant = "player",
  className,
}: {
  title: string;
  description?: string;
  variant?: "player" | "gm";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        variant === "gm" ? "flex-1 gap-2 py-8" : "min-h-0 flex-1 gap-1.5 px-6",
        className,
      )}
    >
      <MessagesSquare className="text-md-on-surface-variant/35 size-6" />
      <p
        className={cn(
          variant === "gm"
            ? "text-md-on-surface-variant/85 text-label-medium"
            : "text-md-on-surface-variant font-serif text-title-small-emph",
        )}
      >
        {title}
      </p>
      {description ? (
        <p className="text-md-on-surface-variant/70 text-label-small">{description}</p>
      ) : null}
    </div>
  );
}

export { ChatEmptyState };
