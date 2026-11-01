import { SessionPhaseLabel, SessionStatusLabel } from "@cogm/shared";
import { Badge } from "@/components/ui/badge";
import { DialogueBox } from "@/features/session-stage/dialogue-box";
import { PortraitLayer } from "@/features/session-stage/portrait-layer";
import { SceneBackdrop } from "@/features/session-stage/scene-backdrop";
import { mediaUrl } from "@/lib/api";
import { SceneAudioStatus } from "@/features/session-stage/scene-audio-status";
import { usePlayStore } from "@/stores/play-store";

function DesktopScene() {
  const status = usePlayStore((state) => state.status);
  const phase = usePlayStore((state) => state.phase);
  const scene = usePlayStore((state) => state.scene);
  const bgm = usePlayStore((state) => state.bgm);
  const muted = usePlayStore((state) => state.muted);
  const setMuted = usePlayStore((state) => state.setMuted);
  const localVolume = usePlayStore((state) => state.localVolume);
  const setLocalVolume = usePlayStore((state) => state.setLocalVolume);
  const messages = usePlayStore((state) => state.messages);
  const latest = [...messages].reverse().find((message) => message.tone !== "ooc");
  const sceneSrc = mediaUrl(scene?.bgAssetId) ?? undefined;

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <SceneBackdrop src={sceneSrc} alt={scene?.name ?? "当前场景"} />
      <div className="absolute inset-x-0 top-0 h-40 bg-linear-to-b from-stage-scrim to-transparent" />

      <div className="absolute top-5 left-6 flex items-center gap-2.5">
        <span className="text-foreground font-serif text-headline-medium-emph">{scene?.name ?? "团"}</span>
        {status ? (
          <Badge variant="soft" tone="success" size="sm">
            {SessionStatusLabel[status]}
          </Badge>
        ) : null}
        {phase ? (
          <Badge variant="soft" tone="accent" size="sm">
            {SessionPhaseLabel[phase]}
          </Badge>
        ) : null}
      </div>

      <SceneAudioStatus
        trackName={bgm?.playing ? (bgm.name ?? "BGM 播放中") : "未播放"}
        volume={muted ? 0 : (bgm?.volume ?? 0)}
        muted={muted}
        onMuteToggle={() => setMuted(!muted)}
        localVolume={localVolume}
        onLocalVolumeChange={setLocalVolume}
        className="absolute top-5 right-6"
      />

      <PortraitLayer />

      {latest ? (
        <DialogueBox
          key={latest.id}
          speaker={latest.speakerName}
          roleLabel={latest.speakerRoleLabel}
          text={latest.body}
          className="absolute inset-x-10 bottom-[36px]"
        />
      ) : null}
    </div>
  );
}

export { DesktopScene };
