import { cn } from "@/lib/utils";
import { AudioSection, CharactersSection, HandoutSection, OnlineSection, RulesSection } from "./gm-panel-controls";
import { GmHead, PhaseSection, SceneSection, SpeakQueueSection } from "./gm-panel-stage";

function GmPanel({ className }: { className?: string }) {
  return (
    <div className={cn("bg-background-secondary border-separator flex h-full flex-col overflow-y-auto border-r", className)}>
      <GmHead />
      <PhaseSection />
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
