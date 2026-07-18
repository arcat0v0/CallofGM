import { Badge } from "@/components/ui/badge";
import { DialogueBox } from "@/features/session-stage/dialogue-box";
import {
  bgmTrackName,
  dialogue,
  portraits,
  sceneImage,
  sessionPhaseLabel,
  sessionStatusLabel,
  sessionTitle,
} from "@/features/session-stage/mock-data";
import { SceneAudioStatus } from "@/features/session-stage/scene-audio-status";

function DesktopScene() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <img src={sceneImage} alt="雨夜的图书馆场景" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-x-0 top-0 h-40 bg-linear-to-b from-stage-scrim to-transparent" />

      <img
        src={portraits.mio}
        alt="远野澪"
        className="absolute top-[308px] left-[236px] h-[592px] w-[300px] object-cover object-top"
      />
      <img
        src={portraits.takuma}
        alt="白石拓真"
        className="absolute top-[340px] left-[556px] h-[560px] w-[284px] object-cover object-top opacity-[0.88]"
      />

      <div className="absolute top-5 left-6 flex items-center gap-2.5">
        <span className="text-foreground font-serif text-lg font-semibold">{sessionTitle}</span>
        <Badge variant="soft" tone="success" size="sm">
          {sessionStatusLabel}
        </Badge>
        <Badge variant="soft" tone="accent" size="sm">
          {sessionPhaseLabel}
        </Badge>
      </div>

      <SceneAudioStatus trackName={bgmTrackName} className="absolute top-5 right-6" />

      <DialogueBox
        speaker={dialogue.speaker}
        roleLabel={dialogue.roleLabel}
        text={dialogue.text}
        className="absolute inset-x-10 bottom-[36px]"
      />
    </div>
  );
}

export { DesktopScene };
