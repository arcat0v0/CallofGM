import { DialogueBox } from "@/features/session-stage/dialogue-box";
import { PortraitLayer } from "@/features/session-stage/portrait-layer";
import { SceneAudioStatus } from "@/features/session-stage/scene-audio-status";
import { SceneBackdrop } from "@/features/session-stage/scene-backdrop";
import { mediaUrl } from "@/lib/api";
import { bgmShowsProgress, bgmStatusLabel } from "@/lib/audio-status";
import { usePlayStore } from "@/stores/play-store";

function MobileLandscapeScene() {
  const scene = usePlayStore((state) => state.scene);
  const bgm = usePlayStore((state) => state.bgm);
  const muted = usePlayStore((state) => state.muted);
  const setMuted = usePlayStore((state) => state.setMuted);
  const localVolume = usePlayStore((state) => state.localVolume);
  const setLocalVolume = usePlayStore((state) => state.setLocalVolume);
  const messages = usePlayStore((state) => state.messages);
  const latest = [...messages]
    .reverse()
    .find((message) => message.tone !== "ooc");
  const sceneSrc = mediaUrl(scene?.bgAssetId) ?? undefined;

  return (
    <div className="relative h-full min-w-0 flex-1 overflow-hidden bg-background">
      <SceneBackdrop src={sceneSrc} alt={scene?.name ?? "当前场景"} />
      <div className="absolute inset-x-0 top-0 h-20 bg-linear-to-b from-stage-scrim to-transparent" />

      <div className="absolute inset-x-0 top-0 flex h-12 items-center justify-between gap-2 px-3 py-1">
        <h1 className="text-foreground line-clamp-2 min-w-0 flex-1 font-serif text-title-small-emph">
          {scene?.name ?? "团"}
        </h1>
        <SceneAudioStatus
          trackName={bgmStatusLabel(bgm)}
          showProgress={bgmShowsProgress(bgm)}
          compact
          muted={muted}
          onMuteToggle={() => setMuted(!muted)}
          localVolume={localVolume}
          onLocalVolumeChange={setLocalVolume}
        />
      </div>

      <PortraitLayer compact className="top-[44px] bottom-[96px]" />

      {latest ? (
        <DialogueBox
          key={latest.id}
          speaker={latest.speakerName}
          roleLabel={latest.speakerRoleLabel}
          text={latest.body}
          size="sm"
          className="absolute inset-x-4 bottom-3"
        />
      ) : null}
    </div>
  );
}

export { MobileLandscapeScene };
