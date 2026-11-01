import { Volume2, VolumeX } from "lucide-react";
import type { PlayViewport } from "@cogm/theme-sdk";
import { Button } from "@/components/ui/button";
import { usePlayStore } from "@/stores/play-store";
import { SceneAudioStatus } from "./scene-audio-status";
import { t } from "@/i18n";

function SceneAudioControl({ variant }: { variant: PlayViewport }) {
  const bgm = usePlayStore((state) => state.bgm);
  const muted = usePlayStore((state) => state.muted);
  const setMuted = usePlayStore((state) => state.setMuted);
  const label = muted ? t("stage.unmute") : t("stage.mute");

  if (variant === "portrait") {
    return (
      <Button
        type="button"
        variant="tertiary"
        size="icon-sm"
        aria-label={label}
        className="bg-md-surface-container-high/80 backdrop-blur"
        onClick={() => setMuted(!muted)}
      >
        {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </Button>
    );
  }

  return (
    <SceneAudioStatus
      trackName={bgm?.playing ? (bgm.name ?? t("stage.bgmPlaying")) : t("stage.bgmNone")}
      compact={variant !== "desktop"}
      volume={muted ? 0 : (bgm?.volume ?? 0)}
      muted={muted}
      onMuteToggle={() => setMuted(!muted)}
    />
  );
}

export { SceneAudioControl };