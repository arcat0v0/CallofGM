import { Music2, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

function SceneAudioStatus({
  trackName,
  volume = 64,
  compact = false,
  muted = false,
  onMuteToggle,
  className,
}: {
  trackName: string;
  volume?: number;
  compact?: boolean;
  muted?: boolean;
  onMuteToggle?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-stage-panel flex items-center rounded-full backdrop-blur-lg",
        compact ? "h-[30px] max-w-56 gap-2 px-2.5" : "h-10 w-[306px] gap-2.5 px-3.5",
        className,
      )}
    >
      <Music2 className={cn("shrink-0 text-accent-hover", compact ? "size-3.5" : "size-[15px]")} />
      <span className={cn("text-foreground min-w-0 flex-1 truncate font-sans", compact ? "text-label-small" : "text-label-medium")}>
        {trackName}
      </span>
      {!compact ? (
        <Progress value={muted ? 0 : volume} className="w-16 bg-foreground/15" aria-label={t("stage.volume", { value: volume })} />
      ) : null}
      {onMuteToggle ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={muted ? t("stage.unmute") : t("stage.mute")}
          className={cn("text-foreground-secondary", compact ? "size-6" : "size-7")}
          onClick={onMuteToggle}
        >
          {muted ? <VolumeX className="size-[15px]" /> : <Volume2 className="size-[15px]" />}
        </Button>
      ) : null}
    </div>
  );
}

export { SceneAudioStatus };
