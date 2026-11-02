import { useState } from "react";
import { Check, CloudLightning, DoorOpen, ListMusic, Pause, Play, SkipBack, SkipForward, Volume1, Volume2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SelectItem } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { formatDurationMmSs } from "@/lib/format";
import { sendSessionCommand } from "@/lib/session-socket";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { useBgmPlayback } from "./gm-audio";
import { GmField, GmPanelShell, GmSelectField } from "./gm-panel-fields";

const FADE_OPTIONS = [
  { value: "500", labelKey: "gm.workbench.fadeFast" },
  { value: "1000", labelKey: "gm.workbench.fadeNormal" },
  { value: "2000", labelKey: "gm.workbench.fadeSlow" },
  { value: "2500", labelKey: "gm.workbench.fadeSlowest" },
] as const;

const SE_ICONS = [CloudLightning, DoorOpen, Zap];

function AudioPanel({ onClose }: { onClose: () => void }) {
  const {
    bgm,
    bgmTracks,
    soundEffects,
    current,
    durationMs,
    displayPosition,
    setSeekDraft,
    sendBgm,
    playTrack,
    togglePlay,
    previous,
    next,
    seek,
  } = useBgmPlayback();
  const [fadeMs, setFadeMs] = useState("1000");
  const volume = Math.round(bgm?.volume ?? 0);

  return (
    <GmPanelShell
      title={t("gm.workbench.audioTitle")}
      subtitle={t("gm.workbench.audioSubtitle")}
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <Button type="button" variant="tertiary" size="sm" className="bg-md-surface-container-highest h-10" onClick={onClose}>
            {t("gm.workbench.done")}
          </Button>
        </div>
      }
    >
      <div className="bg-md-surface-container border border-md-outline-variant/50 flex flex-col gap-3 rounded-3xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-md-on-surface truncate font-serif text-title-large">
              {current?.name ?? bgm?.name ?? t("gm.console.audioNone")}
            </span>
            <span className="text-md-on-surface-variant text-label-medium">
              {current
                ? bgm?.playing
                  ? t("gm.workbench.bgmSyncing")
                  : t("gm.workbench.bgmPaused")
                : t("gm.workbench.bgmNone")}
            </span>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="tertiary"
                size="icon-sm"
                className="bg-md-surface-container-highest text-md-on-surface-variant size-10 shrink-0"
                aria-label={t("gm.workbench.selectTrack")}
                disabled={bgmTracks.length === 0}
              >
                <ListMusic />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="bg-md-surface-container-high w-80 p-2">
              <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                {bgmTracks.map((track) => {
                  const active = track.id === bgm?.trackId;
                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => playTrack(track.id, active)}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-2 text-left",
                        active ? "bg-md-primary-container text-md-on-primary-container" : "text-md-on-surface hover:bg-md-on-surface/8",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate text-label-large">{track.name}</span>
                      <span className="text-label-small opacity-70">{formatDurationMmSs(track.duration)}</span>
                      {active ? <Check className="size-4 shrink-0" /> : null}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <Slider
          wavy
          value={[displayPosition]}
          min={0}
          max={Math.max(durationMs, 1)}
          playing={Boolean(bgm?.playing)}
          disabled={durationMs <= 0}
          aria-label={t("gm.console.progressAria")}
          className={cn(durationMs <= 0 && "opacity-40", "[&_[data-slot=slider-track]]:bg-md-outline-variant! [&_[data-slot=slider-thumb]]:h-9! [&_[data-slot=slider-thumb]]:w-1! min-h-9!")}
          onValueChange={(value) => setSeekDraft(value[0] ?? 0)}
          onValueCommit={(value) => seek(value[0] ?? 0)}
        />
        <div className="flex items-center justify-between">
          <span className="text-md-on-surface-variant font-mono text-label-medium tabular-nums">
            {formatDurationMmSs(displayPosition)}
          </span>
          <span className="text-md-on-surface-variant font-mono text-label-medium tabular-nums">
            {formatDurationMmSs(durationMs)}
          </span>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="tertiary"
            size="icon-sm"
            className="bg-md-surface-container-highest size-12"
            aria-label={t("gm.workbench.previousTrack")}
            disabled={bgmTracks.length === 0}
            onClick={previous}
          >
            <SkipBack />
          </Button>
          <Button
            type="button"
            variant="primary"
            size="icon-sm"
            className="size-14"
            aria-label={bgm?.playing ? t("gm.console.audioPause") : t("gm.console.audioPlay")}
            disabled={bgmTracks.length === 0}
            onClick={togglePlay}
          >
            {bgm?.playing ? <Pause className="size-6" /> : <Play className="size-6" />}
          </Button>
          <Button
            type="button"
            variant="tertiary"
            size="icon-sm"
            className="bg-md-surface-container-highest size-12"
            aria-label={t("gm.console.audioNext")}
            disabled={bgmTracks.length === 0}
            onClick={next}
          >
            <SkipForward />
          </Button>
        </div>
      </div>

      <div className="flex items-stretch gap-4">
        <GmField label={t("gm.workbench.loop")} className="h-16 justify-center">
          <span className="text-md-on-surface text-label-large whitespace-nowrap">
            {bgm?.loop ? t("gm.workbench.loopOn") : t("gm.workbench.loopOff")}
          </span>
          <Switch
            checked={Boolean(bgm?.loop)}
            aria-label={t("gm.console.audioLoop")}
            onCheckedChange={(checked) => sendBgm("loop", { loop: Boolean(checked) })}
          />
        </GmField>
        <GmSelectField
          label={t("gm.workbench.fade")}
          value={fadeMs}
          onValueChange={setFadeMs}
          className="h-16 flex-1 justify-center"
        >
          {FADE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {t(option.labelKey)}
            </SelectItem>
          ))}
        </GmSelectField>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          className="h-10 flex-1"
          onClick={() => sendBgm("volume", { volume: 80, transitionMs: Number(fadeMs) })}
        >
          {t("gm.console.fadeIn")}
        </Button>
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          className="h-10 flex-1"
          onClick={() => sendBgm("volume", { volume: 0, transitionMs: Number(fadeMs) })}
        >
          {t("gm.console.fadeOut")}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-md-on-surface text-label-large">{t("gm.workbench.groupVolume")}</span>
          <span className="text-md-on-surface-variant font-mono text-label-medium tabular-nums">{volume}%</span>
        </div>
        <div className="flex items-center gap-3">
          <Volume1 className="text-md-on-surface-variant size-5 shrink-0" />
          <Slider
            value={[volume]}
            min={0}
            max={100}
            aria-label={t("gm.console.volumeAria")}
            className="[&_[data-slot=slider-track]]:bg-md-surface-container-highest! [&_[data-slot=slider-thumb]]:h-9! [&_[data-slot=slider-thumb]]:w-1!"
            onValueChange={(value) => sendBgm("volume", { volume: value[0] ?? 0 })}
          />
          <Volume2 className="text-md-on-surface-variant size-5 shrink-0" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-md-on-surface text-label-large-emph">{t("gm.workbench.soundEffects")}</span>
        {soundEffects.length === 0 ? (
          <p className="text-md-on-surface-variant text-label-small">{t("gm.workbench.noSoundEffects")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {soundEffects.map((effect, index) => {
              const Icon = SE_ICONS[index % SE_ICONS.length] ?? Zap;
              return (
                <Button
                  key={effect.id}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-11 justify-center"
                  onClick={() => sendSessionCommand("audio:se", { trackId: effect.id })}
                >
                  <Icon className="size-4" />
                  {effect.name}
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </GmPanelShell>
  );
}

export { AudioPanel };