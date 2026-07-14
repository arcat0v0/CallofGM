import { createFileRoute } from "@tanstack/react-router";
import {
  CloudLightning,
  CloudUpload,
  Disc3,
  DoorOpen,
  Ear,
  Ellipsis,
  Footprints,
  HeartPulse,
  type LucideIcon,
  Pause,
  Play,
  Repeat,
  TriangleAlert,
  Upload,
  Zap,
} from "lucide-react";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gm/music")({
  component: MusicResourcesPage,
});

type BgmTrack = {
  id: string;
  name: string;
  duration: string;
  playing?: boolean;
  loop?: boolean;
  progress: number;
};

type SoundEffect = {
  id: string;
  name: string;
  icon: LucideIcon;
};

const WAVE_HEIGHTS = [
  6, 11, 7, 14, 9, 5, 12, 8, 15, 7, 10, 6, 13, 9, 4, 11, 8, 14, 6, 10, 7, 12, 5, 9, 13, 8, 6, 11, 15, 7, 9, 5, 12, 8,
  10, 6, 14, 7, 11, 9,
];

const bgmTracks: BgmTrack[] = [
  { id: "rainy-library", name: "雨夜的图书馆", duration: "04:10", playing: true, loop: true, progress: 16 },
  { id: "manor-whisper", name: "洋馆的低语", duration: "03:22", loop: true, progress: 0 },
  { id: "lake-pulse", name: "湖底の胎动", duration: "05:48", progress: 0 },
  { id: "final-rite", name: "最后的仪式", duration: "06:15", progress: 0 },
];

const soundEffects: SoundEffect[] = [
  { id: "thunder", name: "雷声", icon: CloudLightning },
  { id: "door", name: "开门", icon: DoorOpen },
  { id: "heartbeat", name: "心跳", icon: HeartPulse },
  { id: "whisper", name: "低语", icon: Ear },
  { id: "footsteps", name: "脚步", icon: Footprints },
  { id: "glass", name: "玻璃碎", icon: TriangleAlert },
];

function Waveform({ progress }: { progress: number }) {
  return (
    <div className="flex h-4 items-center gap-0.5">
      {WAVE_HEIGHTS.map((height, index) => (
        <span
          key={index}
          style={{ height }}
          className={cn("w-0.5 rounded-full", index < progress ? "bg-accent-hover" : "bg-separator-tertiary")}
        />
      ))}
    </div>
  );
}

function BgmRow({ track }: { track: BgmTrack }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5",
        track.playing ? "bg-accent-soft border-accent-hover" : "bg-surface border-separator",
      )}
    >
      <button
        type="button"
        className={cn(
          "flex size-[34px] shrink-0 items-center justify-center rounded-full",
          track.playing ? "from-accent to-accent-hover bg-linear-to-br" : "bg-default",
        )}
      >
        {track.playing ? (
          <Pause className="text-accent-foreground size-3.5" />
        ) : (
          <Play className="text-foreground size-3.5" />
        )}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <div className="flex items-center gap-1.5">
          <span className="text-foreground text-[13px] font-semibold">{track.name}</span>
          {track.playing && (
            <Badge variant="soft" tone="success" size="sm" className="font-sans font-normal">
              播放中
            </Badge>
          )}
        </div>
        <Waveform progress={track.progress} />
      </div>

      <div className="flex items-center gap-2">
        {track.loop && <Repeat className="text-foreground-tertiary size-[13px]" />}
        <span className="text-foreground-tertiary font-mono text-xs">{track.duration}</span>
        <Button variant="ghost" size="icon-sm" className="text-foreground-tertiary size-7">
          <Ellipsis />
        </Button>
      </div>
    </div>
  );
}

function SeTile({ effect }: { effect: SoundEffect }) {
  const Icon = effect.icon;
  return (
    <button
      type="button"
      className="border-separator bg-surface flex flex-1 items-center gap-2.5 rounded-[10px] border px-3 py-2.5"
    >
      <span className="bg-warning-soft flex size-[30px] shrink-0 items-center justify-center rounded-lg">
        <Icon className="text-warning size-[15px]" />
      </span>
      <span className="text-foreground flex-1 truncate text-left text-[13px] font-medium">{effect.name}</span>
      <Play className="text-foreground-tertiary size-3.5 shrink-0" />
    </button>
  );
}

function MusicResourcesPage() {
  const seRows: SoundEffect[][] = [];
  for (let index = 0; index < soundEffects.length; index += 2) {
    seRows.push(soundEffects.slice(index, index + 2));
  }

  return (
    <AdminLayout active="music">
      <div className="flex h-full min-h-0 flex-col gap-5">
        <header className="flex items-start justify-between">
          <div className="flex flex-col gap-[3px]">
            <h1 className="text-foreground font-serif text-[22px] font-bold">音乐资源</h1>
            <p className="text-foreground-secondary text-[13px]">
              归属模组「沉没的记忆」· 团进行中由 GM 全局控制播放
            </p>
          </div>
          <Button className="from-accent to-accent-hover bg-linear-to-b font-semibold">
            <Upload />
            上传音频
          </Button>
        </header>

        <div className="flex min-h-0 flex-1 gap-5">
          <section className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex items-center gap-2">
              <Disc3 className="text-accent-hover size-4" />
              <span className="text-foreground text-sm font-semibold">BGM · 循环长音频</span>
              <Badge variant="soft" size="sm" className="font-sans font-normal">
                5 首 · 全员进度同步
              </Badge>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              {bgmTracks.map((track) => (
                <BgmRow key={track.id} track={track} />
              ))}
            </div>
          </section>

          <section className="flex w-[400px] min-h-0 shrink-0 flex-col gap-3">
            <div className="flex items-center gap-2">
              <Zap className="text-warning size-4" />
              <span className="text-foreground text-sm font-semibold">SE · 音效</span>
              <Badge variant="soft" size="sm" className="font-sans font-normal">
                7 个 · 广播即播
              </Badge>
            </div>
            <div className="flex flex-col gap-2">
              {seRows.map((row, index) => (
                <div key={index} className="flex gap-2">
                  {row.map((effect) => (
                    <SeTile key={effect.id} effect={effect} />
                  ))}
                </div>
              ))}
            </div>
            <div className="border-separator-tertiary flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed">
              <CloudUpload className="text-foreground-tertiary size-6" />
              <span className="text-foreground-secondary text-xs">拖入音频文件上传</span>
              <span className="text-foreground-tertiary text-[11px]">MP3 / OGG / WAV · 单文件 ≤ 20MB</span>
            </div>
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}
