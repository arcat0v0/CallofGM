import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";
import { AudioSection, CharactersSection, HandoutSection, OnlineSection, RulesSection, SessionSettingsSection } from "./gm-panel-controls";
import { GmHead, PhaseSection, SceneSection, SpeakQueueSection } from "./gm-panel-stage";

function GmPanel({ className }: { className?: string }) {
  const ended = usePlayStore((state) => state.status === "ended");

  return (
    <div className={cn("bg-md-surface-container-low flex h-full flex-col overflow-y-auto", className)}>
      <GmHead />
      {ended ? (
        <p className="text-warning px-4 pb-2 text-label-small">
          已结团 · 仅「在线玩家」的踢出与拉黑仍可用，其余控场操作已停用
        </p>
      ) : null}
      <OnlineSection />
      <div inert={ended} className={cn(ended && "pointer-events-none opacity-45")}>
        <PhaseSection />
        <SessionSettingsSection />
        <SpeakQueueSection />
        <SceneSection />
        <CharactersSection />
        <AudioSection />
        <RulesSection />
        <HandoutSection />
      </div>
    </div>
  );
}

export { GmPanel };
