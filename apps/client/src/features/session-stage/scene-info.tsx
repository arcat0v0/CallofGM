import type { PlayViewport } from "@cogm/theme-sdk";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";
import { sessionPhaseLabel, sessionStatusLabel } from "@/i18n/labels";
import { statusTone } from "@/lib/format";
import { t } from "@/i18n";

const NAME_CLASS: Record<PlayViewport, string> = {
  desktop: "text-headline-small-emph",
  landscape: "text-title-medium-emph",
  portrait: "text-title-large-emph",
};

function SceneInfo({
  variant,
  className,
}: {
  variant: PlayViewport;
  className?: string;
}) {
  const scene = usePlayStore((state) => state.scene);
  const status = usePlayStore((state) => state.status);
  const phase = usePlayStore((state) => state.phase);
  const showBadges = variant !== "landscape";

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <h1 className={cn("text-foreground min-w-0 truncate font-serif", NAME_CLASS[variant])}>
        {scene?.name ?? t("play.sceneFallback")}
      </h1>
      {showBadges ? (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {status ? (
            <Badge variant="soft" tone={statusTone(status)} size="sm">
              {sessionStatusLabel(status)}
            </Badge>
          ) : null}
          {phase ? (
            <Badge variant="soft" tone="default" size="sm">
              {sessionPhaseLabel(phase)}
            </Badge>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export { SceneInfo };
