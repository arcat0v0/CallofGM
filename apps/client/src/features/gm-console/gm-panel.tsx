import {
  AudioLines,
  ChevronDown,
  ChevronRight,
  Drama,
  GripVertical,
  Image as ImageIcon,
  LayoutDashboard,
  Link as LinkIcon,
  ListVideo,
  Pause,
  Repeat,
  ShieldBan,
  SkipForward,
  SquarePower,
  Trash2,
  Users,
  VenetianMask,
  Volume2,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  bgmState,
  onlinePlayers,
  phases,
  scenes,
  soundEffects,
  speakQueue,
  stageCharacters,
} from "./mock-data";

function SectionTitle({
  icon: Icon,
  children,
  onMore,
}: {
  icon: typeof Drama;
  children: React.ReactNode;
  onMore?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="text-accent-hover size-[13px]" />
      <span className="text-foreground-secondary font-sans text-xs font-semibold tracking-[1px]">{children}</span>
      <span className="flex-1" />
      {onMore && <ChevronRight className="text-foreground-tertiary size-3.5" />}
    </div>
  );
}

function GmHead() {
  return (
    <div className="flex flex-col gap-2 px-4 pt-4 pb-3">
      <div className="flex items-center justify-between">
        <span className="text-foreground-tertiary font-sans text-[11px] font-semibold tracking-[1.5px]">
          GM 控制台
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="返回后台">
            <LayoutDashboard />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="复制团链接">
            <LinkIcon />
          </Button>
        </div>
      </div>
      <span className="text-foreground font-serif text-[17px] font-semibold">沉没的记忆 · 第三夜</span>
      <div className="flex items-center gap-1.5">
        <Badge variant="soft" tone="success" size="sm">
          进行中
        </Badge>
        <Badge variant="soft" tone="default" size="sm">
          模组 · 沉没的记忆
        </Badge>
        <span className="flex-1" />
        <Button variant="dangerSoft" size="sm" className="h-[26px] px-2.5 text-xs">
          <SquarePower className="size-3.5" />
          结团
        </Button>
      </div>
    </div>
  );
}

function PhaseSection() {
  const [active, setActive] = useState("performance_time");

  return (
    <div className="border-separator flex flex-col gap-2.5 border-t px-4 py-3">
      <SectionTitle icon={Drama}>团内阶段</SectionTitle>
      <div className="grid grid-cols-2 gap-1.5">
        {phases.map((phase) => {
          const isActive = phase.key === active;
          return (
            <Button
              key={phase.key}
              type="button"
              onClick={() => setActive(phase.key)}
              variant={isActive ? "primaryGradient" : "tertiary"}
              aria-pressed={isActive}
              className="h-auto flex-col items-start gap-0.5 rounded-[10px] px-2.5 py-2 text-left whitespace-normal"
            >
              <span className={cn("font-sans text-[13px] font-semibold", isActive ? "text-accent-foreground" : "text-foreground")}>
                {phase.label}
              </span>
              <span className={cn("font-sans text-[10px]", isActive ? "text-accent-foreground/70" : "text-foreground-tertiary")}>
                {phase.desc}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function SpeakQueueSection() {
  return (
    <div className="border-separator flex flex-col gap-2 border-t px-4 py-3">
      <div className="bg-surface border-separator-secondary flex flex-col gap-2 rounded-xl border px-2.5 py-2.5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <ListVideo className="text-accent-hover size-3.5" />
              <span className="text-foreground font-sans text-[13px] font-semibold">演绎待呈现队列</span>
            </div>
            <Badge variant="soft" tone="warning" size="sm">
              {speakQueue.length} 待放行
            </Badge>
          </div>
          <p className="text-foreground-tertiary font-sans text-[10px] leading-[1.4]">
            仅你可见 · 放行后按此顺序上场；PC 场外消息即时呈现、不入队
          </p>
        </div>

        <div className="flex flex-col gap-1">
          {speakQueue.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                "flex flex-col gap-1 rounded-[10px] px-2.5 py-1.5",
                index === 0 && "bg-default border-l-[3px] border-accent-hover",
              )}
            >
              <div className="flex items-center gap-1.5">
                <GripVertical className="text-foreground-tertiary size-3.5 shrink-0" />
                <Avatar size="sm" className="bg-default size-[22px]">
                  <AvatarFallback className="text-foreground font-sans text-[10px]">
                    {item.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-foreground min-w-0 truncate font-sans text-xs font-semibold">
                  {item.name}
                </span>
                <Badge variant="soft" tone={item.kindTone} size="sm">
                  {item.kindLabel}
                </Badge>
                <span className="flex-1" />
                <Button
                  type="button"
                  variant="primaryGradient"
                  size="sm"
                  className="h-6 px-3 text-xs"
                >
                  放行
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`丢弃 ${item.name} 的待呈现发言`} className="text-danger-soft-foreground size-[26px]">
                  <Trash2 className="size-[15px]" />
                </Button>
              </div>
              <div className="flex items-center gap-1.5 pl-5">
                <span className="text-foreground-secondary min-w-0 flex-1 truncate font-sans text-xs">
                  {item.preview}
                </span>
                {item.emotion && (
                  <Badge variant="soft" tone="accent" size="sm" className="text-[10px]">
                    {item.emotion}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SceneSection() {
  return (
    <div className="border-separator flex flex-col gap-2.5 border-t px-4 py-3">
      <SectionTitle icon={ImageIcon} onMore>
        场景切换
      </SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {scenes.map((scene) => (
          <Button
            key={scene.id}
            type="button"
            variant="ghost"
            aria-pressed={scene.active}
            className="h-auto flex-col gap-1 rounded-lg p-0 hover:bg-transparent"
          >
            <span
              className={cn(
                "h-[58px] w-full overflow-hidden rounded-lg border-2 bg-cover bg-center",
                scene.active ? "border-accent-hover" : "border-separator-secondary border",
              )}
            >
              <img src={scene.thumb} alt={scene.name} className="size-full object-cover" />
            </span>
            <span className="flex items-center justify-center gap-1">
              {scene.active && <span className="bg-accent-hover size-1.5 rounded-full" />}
              <span className={cn("font-sans text-[11px]", scene.active ? "text-foreground" : "text-foreground-tertiary")}>
                {scene.name}
              </span>
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}

function CharactersSection() {
  return (
    <div className="border-separator flex flex-col gap-2.5 border-t px-4 py-3">
      <SectionTitle icon={VenetianMask} onMore>
        立绘控制
      </SectionTitle>
      <div className="flex flex-col gap-2.5">
        {stageCharacters.map((char) => (
          <div key={char.id} className="flex items-center gap-2">
            <Avatar size="sm" className="bg-default">
              <AvatarFallback className="text-foreground font-sans text-xs">{char.initials}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-foreground truncate font-sans text-[13px] font-medium">{char.name}</span>
              <span className="text-foreground-tertiary font-chip text-[10px]">{char.kindLabel}</span>
            </div>
            <Button type="button" variant="tertiary" size="sm" className="h-[26px] gap-1 px-2.5 text-[11px]">
              {char.expression}
              <ChevronDown className="text-foreground-tertiary size-3" />
            </Button>
            <Switch checked={char.visible} size="sm" aria-label={`${char.name}立绘可见性`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function AudioSection() {
  return (
    <div className="border-separator flex flex-col gap-2.5 border-t px-4 py-3">
      <SectionTitle icon={AudioLines} onMore>
        音频 · GM 全局控制
      </SectionTitle>

      <div className="bg-surface border-separator-secondary flex flex-col gap-2 rounded-xl border px-2.5 py-2.5">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="primaryGradient"
            size="icon-sm"
            aria-label="暂停背景音乐"
            className="size-7 bg-linear-to-br"
          >
            <Pause className="text-accent-foreground size-[13px]" />
          </Button>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-foreground truncate font-sans text-xs font-semibold">{bgmState.name}</span>
            <span className="text-foreground-tertiary font-chip text-[10px]">{bgmState.meta}</span>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="切换循环播放" className="text-accent-hover">
            <Repeat />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="下一首背景音乐">
            <SkipForward />
          </Button>
        </div>
        <div className="flex items-center gap-2.5">
          <Volume2 className="text-foreground-secondary size-[13px] shrink-0" />
          <Slider value={[bgmState.volume]} size="sm" aria-label="背景音乐音量" className="flex-1 py-1" />
          <span className="text-foreground-secondary w-6 shrink-0 text-right font-chip text-[11px]">
            {bgmState.volume}
          </span>
          <Button type="button" variant="tertiary" size="sm" className="h-6 px-2.5 text-[11px]">
            淡出
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-foreground-tertiary font-chip text-[11px] font-semibold">SE</span>
        {soundEffects.map((se) => (
          <Button
            key={se}
            type="button"
            variant="outline"
            size="sm"
            className="border-separator-tertiary h-[26px] gap-1 px-2.5"
          >
            <Zap className="text-warning size-[11px]" />
            <span className="text-foreground font-sans text-[11px]">{se}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

function OnlineSection() {
  return (
    <div className="border-separator flex flex-col gap-2.5 border-t px-4 py-3">
      <SectionTitle icon={Users}>在线玩家 · {onlinePlayers.length}</SectionTitle>
      <div className="flex flex-col gap-2.5">
        {onlinePlayers.map((player) => (
          <div key={player.id} className="flex items-center gap-2">
            <span className="bg-success size-[7px] shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-foreground truncate font-sans text-[13px] font-medium">{player.name}</span>
              <span className="text-foreground-tertiary font-mono text-[10px]">{player.fingerprint}</span>
            </div>
            <Badge variant="soft" tone="accent" size="sm" className="shrink-0">
              {player.roleLabel}
            </Badge>
            <Button variant="ghost" size="icon-sm" aria-label={`踢出 ${player.name}`} className="text-danger-soft-foreground size-7 shrink-0">
              <Users className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`拉黑 ${player.name}`} className="text-foreground-tertiary size-7 shrink-0">
              <ShieldBan className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function GmPanel({ className }: { className?: string }) {
  return (
    <div className={cn("bg-background-secondary border-separator flex h-full flex-col overflow-y-auto border-r", className)}>
      <GmHead />
      <PhaseSection />
      <SpeakQueueSection />
      <SceneSection />
      <CharactersSection />
      <AudioSection />
      <OnlineSection />
    </div>
  );
}

export { GmPanel };
