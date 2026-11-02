import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";
import { AudioMiniCard, CharacterStateCard, PhaseCard, QueueCard } from "./gm-panel-stage";
import { useGmTool } from "./gm-tool-context";

function GmPanel({ className }: { className?: string }) {
  const ended = usePlayStore((state) => state.status === "ended");
  const { activeTool } = useGmTool();
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col gap-2 overflow-y-auto 2xl:gap-3",
        ended && "pointer-events-none opacity-45",
        className,
      )}
    >
      <PhaseCard />
      <div className="min-h-20 flex-1">
        <QueueCard className="h-full" />
      </div>
      <CharacterStateCard />
      {activeTool !== "audio" ? <AudioMiniCard /> : null}
    </div>
  );
}

export { GmPanel };