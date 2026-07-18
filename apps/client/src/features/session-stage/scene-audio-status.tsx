import { Music2, Volume2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

function SceneAudioStatus({
  trackName,
  volume = 64,
  compact = false,
  className,
}: {
  trackName: string;
  volume?: number;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border bg-stage-panel flex items-center rounded-full border backdrop-blur-lg",
        compact ? "h-[30px] max-w-56 gap-2 px-2.5" : "h-10 w-[306px] gap-2.5 px-3.5",
        className,
      )}
    >
      <Music2 className={cn("shrink-0 text-accent-hover", compact ? "size-3.5" : "size-[15px]")} />
      <span className={cn("text-foreground min-w-0 flex-1 truncate font-sans", compact ? "text-[11px]" : "text-xs")}>
        {trackName}
      </span>
      {!compact ? (
        <>
          <Progress value={volume} className="w-16 bg-foreground/15" aria-label={`音量 ${volume}%`} />
          <Volume2 className="size-[15px] shrink-0 text-foreground-secondary" />
        </>
      ) : null}
    </div>
  );
}

export { SceneAudioStatus };
