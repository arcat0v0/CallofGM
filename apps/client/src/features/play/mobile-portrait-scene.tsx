import { SessionPhaseLabel, SessionStatusLabel } from "@cogm/shared";
import { Volume2, VolumeX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogueBox } from "@/features/session-stage/dialogue-box";
import { LocalVolumeControl } from "@/features/session-stage/local-volume-control";
import { PortraitLayer } from "@/features/session-stage/portrait-layer";
import { SceneBackdrop } from "@/features/session-stage/scene-backdrop";
import { mediaUrl } from "@/lib/api";
import { usePlayStore } from "@/stores/play-store";

function MobilePortraitScene() {
  const status = usePlayStore((state) => state.status);
  const phase = usePlayStore((state) => state.phase);
  const scene = usePlayStore((state) => state.scene);
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
    <div className="relative h-[clamp(340px,48dvh,440px)] w-full shrink-0 overflow-hidden bg-background">
      <SceneBackdrop src={sceneSrc} alt={scene?.name ?? "当前场景"} />
      <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-stage-scrim-strong to-transparent" />

      <div className="absolute inset-x-0 top-0 flex flex-col gap-1 px-3.5 pt-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-foreground min-w-0 flex-1 truncate font-serif text-title-large-emph">
            {scene?.name ?? "团"}
          </span>
          <Button
            type="button"
            variant="tertiary"
            size="icon-sm"
            aria-label={muted ? "取消静音" : "本地静音"}
            className="bg-md-surface-container-high/80 shrink-0 backdrop-blur"
            onClick={() => setMuted(!muted)}
          >
            {muted ? (
              <VolumeX className="size-4" />
            ) : (
              <Volume2 className="size-4" />
            )}
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
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
          <LocalVolumeControl
            value={localVolume}
            onChange={setLocalVolume}
            compact
          />
        </div>
      </div>

      <PortraitLayer compact className="top-[78px] bottom-[88px]" />

      {latest ? (
        <DialogueBox
          key={latest.id}
          speaker={latest.speakerName}
          roleLabel={latest.speakerRoleLabel}
          text={latest.body}
          size="sm"
          className="absolute inset-x-3 bottom-2"
        />
      ) : null}
    </div>
  );
}

export { MobilePortraitScene };
