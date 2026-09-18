import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type DialogueBoxProps = {
  speaker: string;
  roleLabel?: string;
  text: string;
  className?: string;
  size?: "md" | "sm";
};

function DialogueBox({ speaker, roleLabel, text, className, size = "md" }: DialogueBoxProps) {
  const compact = size === "sm";

  return (
    <div className={cn("flex flex-col", className)}>
      <div
        className={cn(
          "relative z-10 flex items-center",
          compact ? "-mb-2.5 ml-3 gap-1.5" : "-mb-3.5 ml-6 gap-2",
        )}
      >
        <span
          className={cn(
            "shadow-dialogue-name rounded-sm bg-linear-to-br from-accent-hover to-accent font-serif tracking-wide text-accent-foreground",
            compact ? "px-2.5 py-1 text-label-large-emph" : "px-3.5 py-1.5 text-title-medium-emph",
          )}
        >
          {speaker}
        </span>
        {roleLabel ? (
          <Badge variant="soft" tone="accent" size="sm" className="backdrop-blur-md">
            {roleLabel}
          </Badge>
        ) : null}
      </div>

      <div
        className={cn(
          "shadow-dialogue relative overflow-hidden rounded-lg border border-foreground/10 bg-linear-to-b from-dialogue-start to-dialogue-end backdrop-blur-xl",
          compact ? "px-4 pt-4 pb-3" : "px-7 pt-6 pb-5",
        )}
      >
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-accent-hover/70 to-transparent" />
        <p className={cn("font-sans text-foreground", compact ? "text-body-medium" : "text-body-large")}>
          {text}
        </p>
        <span
          aria-hidden="true"
          className="absolute right-4 bottom-2.5 size-0 animate-bounce border-x-[5px] border-t-[7px] border-x-transparent border-t-accent-hover/80"
        />
      </div>
    </div>
  );
}

export { DialogueBox };
