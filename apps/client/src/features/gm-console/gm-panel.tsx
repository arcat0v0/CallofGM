import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";
import { t } from "@/i18n";
import { AudioSection, CharactersSection, HandoutSection, OnlineSection, RulesSection, SessionSettingsSection } from "./gm-panel-controls";
import { GmHead, PhaseSection, SceneSection, SpeakQueueSection } from "./gm-panel-stage";

function GmPanel({ className }: { className?: string }) {
  const ended = usePlayStore((state) => state.status === "ended");

  return (
    <div className={cn("bg-md-surface-container-low flex h-full flex-col overflow-y-auto", className)}>
      <GmHead />
      {ended ? (
        <p className="text-warning px-4 pb-2 text-label-small">
          {t("gm.console.endedLockout")}
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
