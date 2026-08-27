import { SessionPhaseLabel, SessionStatusLabel } from "@cogm/shared";
import { Volume2, VolumeX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogueBox } from "@/features/session-stage/dialogue-box";
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
  const messages = usePlayStore((state) => state.messages);
  const latest = [...messages].reverse().find((message) => message.tone !== "ooc");
  const sceneSrc = scene?.bgAssetId ? mediaUrl(scene.bgAssetId) : undefined;

  return (
    <div className="relative h-[330px] w-full shrink-0 overflow-hidden bg-background">
      <SceneBackdrop src={sceneSrc} alt={scene?.name ?? "当前场景"} />
      <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-stage-scrim-strong to-transparent" />

      <div className="absolute inset-x-0 top-0 flex h-[52px] items-center justify-between px-3.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-foreground truncate font-serif text-sm font-semibold">{scene?.name ?? "团"}</span>
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
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={muted ? "取消静音" : "本地静音"}
          className="bg-backdrop/25 rounded-full"
          onClick={() => setMuted(!muted)}
        >
          {muted ? <VolumeX className="text-accent-hover size-4" /> : <Volume2 className="text-accent-hover size-4" />}
        </Button>
      </div>

      <PortraitLayer compact className="bottom-[72px]" />

      {latest ? (
        <DialogueBox
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
