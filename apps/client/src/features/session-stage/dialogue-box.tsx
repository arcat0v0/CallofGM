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
    <div
      className={cn(
        "animate-in fade-in slide-in-from-bottom-2 duration-350 ease-expressive-fast-spatial relative flex flex-col",
        className,
      )}
    >
      <div className="absolute -top-5 left-6 z-10 flex items-center gap-2">
        <span
          className={cn(
            "bg-md-primary-container text-md-on-primary-container shadow-dialogue-name rounded-full font-serif",
            compact ? "px-3 py-1 text-label-large-emph" : "px-4 py-1.5 text-title-medium-emph",
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
          "shadow-dialogue relative overflow-hidden rounded-2xl bg-md-surface-container-high/95 backdrop-blur-xl",
          compact ? "px-4 pt-5 pb-3" : "px-7 pt-7 pb-5",
        )}
      >
        <p className={cn("font-sans text-md-on-surface", compact ? "text-body-medium" : "text-body-large")}>
          {text}
        </p>
      </div>
    </div>
  );
}

export { DialogueBox };
