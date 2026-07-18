import { DialogueBox } from "@/features/session-stage/dialogue-box";
import { bgmTrackName, dialogue, portraits, sceneImage, sessionTitle } from "@/features/session-stage/mock-data";
import { SceneAudioStatus } from "@/features/session-stage/scene-audio-status";

function MobileLandscapeScene() {
  return (
    <div className="relative h-full min-w-0 flex-1 overflow-hidden">
      <img
        src={sceneImage}
        alt="雨夜的图书馆场景"
        className="absolute top-[-40px] left-[-30px] h-[470px] w-[620px] max-w-none object-cover"
      />
      <img
        src={portraits.mio}
        alt="远野澪"
        className="absolute top-9 left-[70px] h-[454px] w-[230px] object-cover object-top"
      />
      <img
        src={portraits.takuma}
        alt="白石拓真"
        className="absolute top-[70px] left-[300px] h-[420px] w-[210px] object-cover object-top opacity-85"
      />
      <div className="absolute inset-x-0 top-0 h-20 bg-linear-to-b from-stage-scrim to-transparent" />

      <div className="absolute inset-x-0 top-0 flex h-12 items-center justify-between px-3.5">
        <span className="text-foreground truncate font-serif text-sm font-semibold">{sessionTitle}</span>
        <SceneAudioStatus trackName={bgmTrackName.replace("BGM · ", "")} compact />
      </div>

      <DialogueBox
        speaker={dialogue.speaker}
        roleLabel={dialogue.roleLabel}
        text={dialogue.text}
        size="sm"
        className="absolute inset-x-4 top-[290px]"
      />
    </div>
  );
}

export { MobileLandscapeScene };
