import { coc7e } from "@cogm/shared";
import { mediaUrl } from "@/lib/api";
import { parseCocState } from "@/lib/coc-live";
import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";

function Bar({ label, current, max, className }: { label: string; current: number; max: number; className?: string }) {
  const ratio = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between text-[10px] text-white/80">
        <span>{label}</span>
        <span>{current}/{max}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
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
      compact ? "bottom-14 gap-2 px-3" : "bottom-24 gap-6 px-10",
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
          <div key={character.characterId} className="flex flex-col items-center gap-2">
            {current ? (
              <img
                src={mediaUrl(current.portraitAssetId)}
                alt={character.name}
                className={cn("w-auto object-contain drop-shadow-lg", compact ? "h-[18vh] max-h-[140px]" : "h-[48vh] max-h-[520px]")}
              />
            ) : (
              <div className={cn("bg-stage-panel text-foreground flex items-center justify-center rounded-xl", compact ? "h-20 w-14 text-sm" : "h-40 w-28 text-lg")}>
                {character.name.slice(-1)}
              </div>
            )}
            <div className={cn("bg-stage-panel/90 rounded-xl px-2.5 py-2 backdrop-blur", compact ? "w-28" : "w-40")}>
              <div className="text-center text-xs font-semibold text-white">{character.name}</div>
              {state ? (
                <div className="mt-1.5 flex flex-col gap-1">
                  <Bar label="HP" current={state.hp} max={state.maxHp} className="bg-danger" />
                  <Bar label="MP" current={state.mp} max={state.maxMp} className="bg-brand-sora" />
                  <Bar label="SAN" current={state.san} max={state.maxSan} className="bg-brand-fuji" />
                  {state.statuses.length > 0 ? (
                    <div className="text-warning text-[10px]">
                      {state.statuses.map((flag) => coc7e.CharacterStatusFlagLabel[flag]).join(" ")}
                    </div>
                  ) : null}
                </div>
              ) : character.kind === "npc" ? (
                <div className="text-foreground-tertiary text-center text-[10px]">NPC</div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { PortraitLayer };
