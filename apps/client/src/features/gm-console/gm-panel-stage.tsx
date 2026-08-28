import { ChevronRight, Drama, GripVertical, Image as ImageIcon, LayoutDashboard, Link as LinkIcon, ListVideo, SquarePower, Trash2 } from "lucide-react";
import { Link, useParams } from "@tanstack/react-router";
import { SessionPhaseLabel, SessionStatusLabel, type SessionPhase, type SessionStatus } from "@cogm/shared";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, isApiError, mediaUrl } from "@/lib/api";
import { initialsOf, nextSessionStatus, nextStatusActionLabel, statusTone } from "@/lib/format";
import { sendSessionCommand } from "@/lib/session-socket";
import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";

const SESSION_PHASES: Array<{ key: SessionPhase; desc: string }> = [
  { key: "free_discussion", desc: "全员可发言 · 即时呈现 · 记为场外" },
  { key: "performance_time", desc: "演绎发言 · 放行后呈现" },
  { key: "forced_cg", desc: "全员禁言 · GM 演出" },
  { key: "free_performance", desc: "自由发言 · 角色扮演经放行" },
];

export function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: typeof Drama;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="text-accent-hover size-[13px]" />
      <span className="text-foreground-secondary font-sans text-xs font-semibold tracking-[1px]">{children}</span>
      <span className="flex-1" />
      <ChevronRight className="text-foreground-tertiary size-3.5" />
    </div>
  );
}

export function GmHead() {
  const { sessionId } = useParams({ from: "/gm/session/$sessionId" });
  const status = usePlayStore((state) => state.status);
  const scene = usePlayStore((state) => state.scene);
  const moduleName = usePlayStore((state) => state.moduleName);
  const nextStatus = status ? nextSessionStatus(status) : null;

  async function patchStatus(next: SessionStatus) {
    try {
      await api(`/gm/sessions/${encodeURIComponent(sessionId)}/status`, {
        method: "POST",
        body: JSON.stringify({ status: next }),
      });
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "无法更新团状态");
    }
  }

  return (
    <div className="flex flex-col gap-2 px-4 pt-4 pb-3">
      <div className="flex items-center justify-between">
        <span className="text-foreground-tertiary font-sans text-[11px] font-semibold tracking-[1.5px]">GM 控制台</span>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon-sm" aria-label="返回后台">
            <Link to="/gm">
              <LayoutDashboard />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="复制团链接"
            onClick={() => {
              void navigator.clipboard.writeText(`${location.origin}/join/${encodeURIComponent(sessionId)}`).then(
                () => toast.success("已复制团链接"),
                () => toast.error("复制失败"),
              );
            }}
          >
            <LinkIcon />
          </Button>
        </div>
      </div>
      <span className="text-foreground font-serif text-[17px] font-semibold">{scene?.name ?? moduleName ?? sessionId}</span>
      <div className="flex items-center gap-1.5">
        {status ? (
          <Badge variant="soft" tone={statusTone(status)} size="sm">
            {SessionStatusLabel[status]}
          </Badge>
        ) : null}
        <Badge variant="soft" tone="default" size="sm">{moduleName ?? "模组"}</Badge>
        <span className="flex-1" />
        {nextStatus && nextStatus !== "ended" && status ? (
          <Button variant="tertiary" size="sm" className="h-[26px] px-2.5 text-xs" onClick={() => void patchStatus(nextStatus)}>
            {nextStatusActionLabel(status) ?? "推进"}
          </Button>
        ) : null}
        {status === "active" ? (
          <Button variant="dangerSoft" size="sm" className="h-[26px] px-2.5 text-xs" onClick={() => void patchStatus("ended")}>
            <SquarePower className="size-3.5" />
            结团
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function PhaseSection() {
  const { sessionId } = useParams({ from: "/gm/session/$sessionId" });
  const active = usePlayStore((state) => state.phase);

  return (
    <div className="border-separator flex flex-col gap-2.5 border-t px-4 py-3">
      <SectionTitle icon={Drama}>团内阶段</SectionTitle>
      <div className="grid grid-cols-2 gap-1.5">
        {SESSION_PHASES.map((phase) => {
          const isActive = phase.key === active;
          return (
            <Button
              key={phase.key}
              type="button"
              onClick={() => {
                void api(`/gm/sessions/${encodeURIComponent(sessionId)}/phase`, {
                  method: "POST",
                  body: JSON.stringify({ phase: phase.key }),
                }).catch((error) => toast.error(isApiError(error) ? error.message : "无法切换阶段"));
              }}
              variant={isActive ? "primaryGradient" : "tertiary"}
              className="h-auto flex-col items-start gap-0.5 rounded-[10px] px-2.5 py-2 text-left whitespace-normal"
            >
              <span className={cn("font-sans text-[13px] font-semibold", isActive ? "text-accent-foreground" : "text-foreground")}>{SessionPhaseLabel[phase.key]}</span>
              <span className={cn("font-sans text-[10px]", isActive ? "text-accent-foreground/70" : "text-foreground-tertiary")}>{phase.desc}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export function SpeakQueueSection() {
  const pendingQueue = usePlayStore((state) => state.pendingQueue);
  return (
    <div className="border-separator flex flex-col gap-2 border-t px-4 py-3">
      <div className="bg-surface border-separator-secondary flex flex-col gap-2 rounded-xl border px-2.5 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ListVideo className="text-accent-hover size-3.5" />
            <span className="text-foreground font-sans text-[13px] font-semibold">演绎待呈现队列</span>
          </div>
          <Badge variant="soft" tone="warning" size="sm">{pendingQueue.length} 待放行</Badge>
        </div>
        {pendingQueue.map((item, index) => {
          const name = item.characterName ?? "玩家";
          function reorder(direction: -1 | 1) {
            const ids = pendingQueue.map((entry) => entry.id);
            const next = index + direction;
            if (next < 0 || next >= ids.length) {
              return;
            }
            const swap = ids[index]!;
            ids[index] = ids[next]!;
            ids[next] = swap;
            sendSessionCommand("chat:reorder", { messageIds: ids });
          }
          return (
            <div key={item.id} className="flex items-center gap-1.5">
              <GripVertical className="text-foreground-tertiary size-3.5" />
              <Avatar size="sm" className="bg-default size-[22px]">
                <AvatarFallback className="text-[10px]">{initialsOf(name)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-xs">{name} · {item.content}</span>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="上移" onClick={() => reorder(-1)}>↑</Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="下移" onClick={() => reorder(1)}>↓</Button>
              <Button type="button" variant="primaryGradient" size="sm" className="h-6 px-3 text-xs" onClick={() => sendSessionCommand("chat:release", { messageId: item.id })}>放行</Button>
              <Button variant="ghost" size="icon-sm" aria-label={`丢弃 ${name}`} onClick={() => sendSessionCommand("chat:discard", { messageId: item.id })}>
                <Trash2 className="size-[15px]" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SceneSection() {
  const scenes = usePlayStore((state) => state.catalogScenes);
  const current = usePlayStore((state) => state.scene);
  return (
    <div className="border-separator flex flex-col gap-2.5 border-t px-4 py-3">
      <SectionTitle icon={ImageIcon}>场景切换</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {scenes.map((scene) => {
          const active = scene.id === current?.id;
          return (
            <Button key={scene.id} type="button" variant="ghost" className="h-auto flex-col gap-1 p-0 hover:bg-transparent" onClick={() => sendSessionCommand("scene:switch", { sceneId: scene.id })}>
              <span className={cn("h-[58px] w-full overflow-hidden rounded-lg border-2", active ? "border-accent-hover" : "border-separator-secondary")}>
                {scene.bgAssetId ? <img src={mediaUrl(scene.bgAssetId) ?? undefined} alt={scene.name} className="size-full object-cover" /> : <span className="bg-default block size-full" />}
              </span>
              <span className={cn("text-[11px]", active ? "text-foreground" : "text-foreground-tertiary")}>{scene.name}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
