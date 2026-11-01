import { Volume2, VolumeX } from "lucide-react";
import type { PlayViewport } from "@cogm/theme-sdk";
import { Button } from "@/components/ui/button";
import { usePlayStore } from "@/stores/play-store";
import { bgmShowsProgress, bgmStatusLabel } from "@/lib/audio-status";
import { LocalVolumeControl } from "./local-volume-control";
import { SceneAudioStatus } from "./scene-audio-status";
import { t } from "@/i18n";

function SceneAudioControl({ variant }: { variant: PlayViewport }) {
  const bgm = usePlayStore((state) => state.bgm);
  const muted = usePlayStore((state) => state.muted);
  const setMuted = usePlayStore((state) => state.setMuted);
  const localVolume = usePlayStore((state) => state.localVolume);
  const setLocalVolume = usePlayStore((state) => state.setLocalVolume);
  const label = muted ? t("stage.unmute") : t("stage.mute");

  if (variant === "portrait") {
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          variant="tertiary"
          size="icon-sm"
          aria-label={label}
          className="bg-md-surface-container-high/80 shrink-0 backdrop-blur"
          onClick={() => setMuted(!muted)}
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </Button>
        <LocalVolumeControl
          value={localVolume}
          onChange={setLocalVolume}
          compact
          className="bg-stage-panel rounded-full px-2 backdrop-blur"
        />
      </div>
    );
  }

  return (
    <SceneAudioStatus
      trackName={bgmStatusLabel(bgm)}
      volume={muted ? 0 : (bgm?.volume ?? 0)}
      showProgress={bgmShowsProgress(bgm)}
      compact={variant !== "desktop"}
      muted={muted}
      onMuteToggle={() => setMuted(!muted)}
      localVolume={localVolume}
      onLocalVolumeChange={setLocalVolume}
    />
  );
}

export { SceneAudioControl };
