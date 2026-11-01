import { coc7e } from "@cogm/shared";
import { mediaUrl } from "@/lib/api";
import { parseCocState } from "@/lib/coc-live";
import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";

function Bar({
  label,
  current,
  max,
  className,
  dense = false,
}: {
  label: string;
  current: number;
  max: number;
  className?: string;
  dense?: boolean;
}) {
  const ratio = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  if (dense) {
    return (
      <div className="text-md-on-surface/80 flex items-center gap-1.5 text-label-small">
        <span className="w-6 shrink-0">{label}</span>
        <span className="bg-md-scrim/40 h-1 min-w-0 flex-1 overflow-hidden rounded-full">
          <span className={cn("block h-full rounded-full", className)} style={{ width: `${ratio}%` }} />
        </span>
        <span className="shrink-0 tabular-nums">
          {current}/{max}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-md-on-surface/80 flex justify-between text-label-small">
        <span>{label}</span>
        <span>{current}/{max}</span>
      </div>
      <div className="bg-md-scrim/40 h-1.5 overflow-hidden rounded-full">
        <div className={cn("h-full rounded-full", className)} style={{ width: `${ratio}%` }} />
      </div>
    </div>
  );
}

function PortraitLayer({ className, compact = false }: { className?: string; compact?: boolean }) {
  const characters = usePlayStore((state) => state.characters);
  const visible = characters.filter((character) => character.kind === "pc" || character.currentExpressionKey);

  return (
    <div className={cn(
      "pointer-events-none absolute inset-x-0 flex items-end justify-center",
      compact ? "top-14 bottom-22 gap-2 px-3" : "bottom-36 gap-6 px-10",
      className,
    )}>
      {visible.map((character) => {
        const portraits = character.portraits ?? [];
        const current =
          portraits.find((item) => item.expressionKey === character.currentExpressionKey) ??
          portraits.find((item) => item.isDefault) ??
          portraits[0];
        const state = parseCocState(character.state);
        return (
          <div
            key={character.characterId}
            className={cn("flex flex-col items-center", compact ? "h-full min-h-0 justify-end gap-1.5" : "gap-2")}
          >
            {current ? (
              <img
                src={mediaUrl(current.portraitAssetId) ?? undefined}
                alt={character.name}
                className={cn(
                  "w-auto object-contain drop-shadow-lg",
                  compact ? "min-h-0 max-w-full flex-1" : "h-[48vh] max-h-[520px]",
                )}
              />
            ) : (
              <div
                role="img"
                aria-label={`${character.name} · 立绘待上传`}
                className={cn(
                  "bg-stage-panel relative flex shrink-0 flex-col items-center justify-end overflow-hidden rounded-t-full rounded-b-xl",
                  compact ? "min-h-0 max-h-full w-20 flex-1" : "h-[48vh] max-h-[520px] w-40",
                )}
              >
                <span
                  aria-hidden
                  className="bg-md-on-surface/15 absolute bottom-0 left-1/2 h-[52%] w-[64%] -translate-x-1/2 rounded-t-full"
                />
                <span
                  aria-hidden
                  className="bg-md-on-surface/15 absolute bottom-[44%] left-1/2 size-[28%] -translate-x-1/2 rounded-full"
                />
                <span
                  className={cn(
                    "text-md-on-surface/85 relative font-serif",
                    compact ? "mb-1 text-title-medium-emph" : "mb-2 text-headline-small-emph",
                  )}
                >
                  {character.name.slice(0, 1)}
                </span>
                <span className={cn("text-md-on-surface-variant relative mb-2 text-label-small", compact && "mb-1")}>
                  立绘待上传
                </span>
              </div>
            )}
            <div
              className={cn(
                "bg-stage-panel/90 shrink-0 rounded-xl backdrop-blur",
                compact ? "w-28 px-2 py-1.5" : "w-40 px-2.5 py-2",
              )}
            >
              <div className={cn("text-md-on-surface text-center", compact ? "text-label-small-emph" : "text-label-medium-emph")}>
                {character.name}
              </div>
              {state ? (
                <div className={cn("flex flex-col", compact ? "mt-1 gap-0.5" : "mt-1.5 gap-1")}>
                  <Bar label="HP" current={state.hp} max={state.maxHp} className="bg-danger" dense={compact} />
                  <Bar label="MP" current={state.mp} max={state.maxMp} className="bg-brand-sora" dense={compact} />
                  <Bar label="SAN" current={state.san} max={state.maxSan} className="bg-brand-fuji" dense={compact} />
                  {state.statuses.length > 0 ? (
                    <div className="text-warning text-label-small">
                      {state.statuses.map((flag) => coc7e.CharacterStatusFlagLabel[flag]).join(" ")}
                    </div>
                  ) : null}
                </div>
              ) : character.kind === "npc" ? (
                <div className="text-foreground-tertiary text-center text-label-small">NPC</div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { PortraitLayer };
