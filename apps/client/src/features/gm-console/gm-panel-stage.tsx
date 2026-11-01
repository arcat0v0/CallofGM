import { Drama, Image as ImageIcon, LayoutDashboard, Link as LinkIcon, ListVideo, SquarePower, Trash2 } from "lucide-react";
import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { SessionPhaseLabel, SessionStatusLabel, type ChatMessageDto, type SessionPhase, type SessionStatus } from "@cogm/shared";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, isApiError, mediaUrl } from "@/lib/api";
import { speakerInitialsOf, speakerNameOf, speakerRoleLabelOf } from "@/lib/chat-map";
import { nextSessionStatus, nextStatusActionLabel, statusTone } from "@/lib/format";
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
      <Icon className="text-md-on-surface-variant size-4" />
      <span className="text-md-on-surface-variant font-sans text-label-large-emph">{children}</span>
    </div>
  );
}

export function GmHead() {
  const { sessionId } = useParams({ from: "/gm/session/$sessionId" });
  const status = usePlayStore((state) => state.status);
  const scene = usePlayStore((state) => state.scene);
  const moduleName = usePlayStore((state) => state.moduleName);
  const sessionName = usePlayStore((state) => state.sessionName);
  const nextStatus = status ? nextSessionStatus(status) : null;
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);

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
        <span className="text-md-on-surface-variant font-sans text-label-small-emph">GM 控制台</span>
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
      <span className="text-md-on-surface font-serif text-title-large-emph">{scene?.name ?? moduleName ?? sessionId}</span>
      <div className="flex items-center gap-1.5">
        {status ? (
          <Badge variant="soft" tone={statusTone(status)} size="sm">
            {SessionStatusLabel[status]}
          </Badge>
        ) : null}
        <Badge variant="soft" tone="default" size="sm">{sessionName ?? moduleName ?? "模组"}</Badge>
        <span className="flex-1" />
        {nextStatus && nextStatus !== "ended" && status ? (
          <Button variant="tertiary" size="sm" className="h-[26px] px-2.5" onClick={() => void patchStatus(nextStatus)}>
            {nextStatusActionLabel(status) ?? "推进"}
          </Button>
        ) : null}
        {status === "active" ? (
          <Button variant="dangerSoft" size="sm" className="h-[26px] px-2.5" onClick={() => setEndConfirmOpen(true)}>
            <SquarePower className="size-3.5" />
            结团
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={endConfirmOpen}
        onOpenChange={setEndConfirmOpen}
        icon={SquarePower}
        title="确认结团？"
        description="结团不可撤销：玩家只能回看聊天记录与情报，控场、阶段、掷骰与情报发放将全部停止，仅保留踢出与拉黑。"
        confirmLabel="确认结团"
        variant="danger"
        onConfirm={() => {
          setEndConfirmOpen(false);
          void patchStatus("ended");
        }}
      />
    </div>
  );
}

export function PhaseSection() {
  const { sessionId } = useParams({ from: "/gm/session/$sessionId" });
  const active = usePlayStore((state) => state.phase);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 ease-standard-default-spatial flex flex-col gap-2.5 px-4 py-3 duration-500">
      <SectionTitle icon={Drama}>团内阶段</SectionTitle>
      <div className="flex flex-col gap-1">
        {SESSION_PHASES.map((phase, index) => {
          const isActive = phase.key === active;
          return (
            <button
              key={phase.key}
              type="button"
              onClick={() => {
                void api(`/gm/sessions/${encodeURIComponent(sessionId)}/phase`, {
                  method: "POST",
                  body: JSON.stringify({ phase: phase.key }),
                }).catch((error) => toast.error(isApiError(error) ? error.message : "无法切换阶段"));
              }}
              className={cn(
                "animate-in fade-in slide-in-from-bottom-4 ease-standard-default-spatial animation-duration-500 flex flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-200 ease-standard-default-effects",
                index === 1 ? "delay-75" : index === 2 ? "delay-150" : index === 3 ? "delay-225" : "",
                isActive
                  ? "bg-md-secondary-container text-md-on-secondary-container"
                  : "text-md-on-surface hover:bg-md-on-surface/8 active:bg-md-on-surface/12",
              )}
            >
              <span className="font-sans text-label-large-emph">{SessionPhaseLabel[phase.key]}</span>
              <span className={cn("font-sans text-label-small", isActive ? "text-md-on-secondary-container/80" : "text-md-on-surface-variant")}>{phase.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function QueueRow({
  item,
  index,
  total,
  onReorder,
}: {
  item: ChatMessageDto;
  index: number;
  total: number;
  onReorder: (direction: -1 | 1) => void;
}) {
  const name = speakerNameOf(item);
  return (
    <div className="bg-md-surface-container-high flex flex-col gap-1.5 rounded-lg px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <Avatar size="sm" className="bg-default size-[22px]">
          <AvatarFallback className="text-label-small">{speakerInitialsOf(item)}</AvatarFallback>
        </Avatar>
        <span className="text-foreground min-w-0 flex-1 truncate font-sans text-label-medium">{name}</span>
        <Badge variant="soft" tone="accent" size="sm" className="shrink-0">
          {speakerRoleLabelOf(item)}
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-md-on-surface-variant h-3 min-h-6 px-2 text-label-small"
          aria-label={`上移「${name}」的发言`}
          title="上移"
          disabled={index === 0}
          onClick={() => onReorder(-1)}
        >
          上移
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-md-on-surface-variant h-3 min-h-6 px-2 text-label-small"
          aria-label={`下移「${name}」的发言`}
          title="下移"
          disabled={index === total - 1}
          onClick={() => onReorder(1)}
        >
          下移
        </Button>
      </div>
      <p className="text-md-on-surface font-sans text-body-small whitespace-pre-wrap break-words">{item.content}</p>
      <div className="flex items-center justify-end gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-md-on-surface-variant h-3 min-h-6 px-2 text-label-small"
          aria-label={`丢弃「${name}」的发言`}
          title="丢弃"
          onClick={() => sendSessionCommand("chat:discard", { messageId: item.id })}
        >
          <Trash2 className="size-3.5" />
          丢弃
        </Button>
        <Button
          type="button"
          variant="primary"
          size="xs"
          className="h-3 min-h-6 px-2.5 text-label-small"
          aria-label={`放行「${name}」的发言`}
          title="放行"
          onClick={() => sendSessionCommand("chat:release", { messageId: item.id })}
        >
          放行
        </Button>
      </div>
    </div>
  );
}

export function SpeakQueueSection() {
  const pendingQueue = usePlayStore((state) => state.pendingQueue);
  const discardedQueue = usePlayStore((state) => state.discardedQueue);

  function reorder(index: number, direction: -1 | 1) {
    const ids = pendingQueue.map((entry) => entry.id);
    const next = index + direction;
    const currentId = ids[index];
    const targetId = ids[next];
    if (!currentId || !targetId) {
      return;
    }
    ids[index] = targetId;
    ids[next] = currentId;
    sendSessionCommand("chat:reorder", { messageIds: ids });
  }
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 ease-standard-default-spatial flex flex-col gap-2 px-4 py-3 duration-500 delay-75">
      <div className="bg-md-surface-container flex flex-col gap-2 rounded-xl px-2.5 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ListVideo className="text-md-on-surface-variant size-3.5" />
            <span className="text-foreground font-sans text-label-large-emph">演绎待呈现队列</span>
          </div>
          <Badge variant="soft" tone="warning" size="sm">
            {pendingQueue.length} 待放行
          </Badge>
        </div>
        <div className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto pr-0.5">
          {pendingQueue.map((item, index) => (
            <QueueRow
              key={item.id}
              item={item}
              index={index}
              total={pendingQueue.length}
              onReorder={(direction) => reorder(index, direction)}
            />
          ))}
        </div>
        {pendingQueue.length === 0 ? (
          <p className="text-md-on-surface-variant text-label-small">队列为空</p>
        ) : null}
        <div className="flex items-center justify-between border-t border-separator-secondary pt-2">
          <span className="text-md-on-surface-variant font-sans text-label-small-emph">已丢弃 · {discardedQueue.length}</span>
        </div>
        {discardedQueue.length === 0 ? (
          <p className="text-md-on-surface-variant text-label-small">暂无已丢弃消息</p>
        ) : (
          discardedQueue.map((item) => {
            const name = item.characterName ?? "玩家";
            return (
              <div key={item.id} className="flex items-center gap-1.5">
                <span className="text-md-on-surface-variant size-3.5 shrink-0 text-center text-label-small">×</span>
                <span className="text-md-on-surface-variant min-w-0 flex-1 truncate text-label-medium">{name} · {item.content}</span>
                <Button
                  type="button"
                  variant="accentSoft"
                  size="sm"
                  className="h-6 px-2.5"
                  onClick={() => sendSessionCommand("chat:restore", { messageId: item.id })}
                >
                  恢复
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function SceneSection() {
  const scenes = usePlayStore((state) => state.catalogScenes);
  const current = usePlayStore((state) => state.scene);
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 ease-standard-default-spatial flex flex-col gap-2.5 px-4 py-3 duration-500 delay-75">
      <SectionTitle icon={ImageIcon}>场景切换</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {scenes.map((scene) => {
          const active = scene.id === current?.id;
          return (
            <Button key={scene.id} type="button" variant="ghost" className="group h-auto flex-col gap-1 p-0 hover:bg-transparent" onClick={() => sendSessionCommand("scene:switch", { sceneId: scene.id })}>
              <span className={cn("relative h-[58px] w-full overflow-hidden rounded-xl", active ? "ring-2 ring-md-primary" : "")}>
                {scene.bgAssetId ? <img src={mediaUrl(scene.bgAssetId) ?? undefined} alt={scene.name} className="size-full object-cover" /> : <span className="bg-md-surface-container-high block size-full" />}
                <span className="bg-md-on-surface/0 group-hover:bg-md-on-surface/8 absolute inset-0 transition-colors duration-200 ease-standard-default-effects" />
              </span>
              <span className={cn("text-label-small", active ? "text-md-on-surface" : "text-md-on-surface-variant")}>{scene.name}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
