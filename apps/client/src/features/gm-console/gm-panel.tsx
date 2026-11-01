import { cn } from "@/lib/utils";
import { AudioSection, CharactersSection, HandoutSection, OnlineSection, RulesSection, SessionSettingsSection } from "./gm-panel-controls";
import { GmHead, PhaseSection, SceneSection, SpeakQueueSection } from "./gm-panel-stage";

function GmPanel({ className }: { className?: string }) {
  return (
    <div className={cn("bg-md-surface-container-low flex h-full flex-col overflow-y-auto", className)}>
      <GmHead />
      <PhaseSection />
      <SessionSettingsSection />
      <SpeakQueueSection />
      <SceneSection />
      <CharactersSection />
      <AudioSection />
      <RulesSection />
      <HandoutSection />
      <OnlineSection />
    </div>
  );
}

export { GmPanel };
