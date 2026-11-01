import { Drama, GripVertical, Image as ImageIcon, LayoutDashboard, Link as LinkIcon, ListVideo, SquarePower, Trash2 } from "lucide-react";
import { Link, useParams } from "@tanstack/react-router";
import type { SessionPhase, SessionStatus } from "@cogm/shared";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, mediaUrl } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { sessionPhaseLabel, sessionStatusLabel } from "@/i18n/labels";
import { t } from "@/i18n";
import { initialsOf, nextSessionStatus, nextStatusActionLabel, statusTone } from "@/lib/format";
import { sendSessionCommand } from "@/lib/session-socket";
import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";

const SESSION_PHASES: Array<{ key: SessionPhase; descKey: string }> = [
  { key: "free_discussion", descKey: "gm.console.phase.free_discussion" },
  { key: "performance_time", descKey: "gm.console.phase.performance_time" },
  { key: "forced_cg", descKey: "gm.console.phase.forced_cg" },
  { key: "free_performance", descKey: "gm.console.phase.free_performance" },
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
  const nextStatus = status ? nextSessionStatus(status) : null;

  async function patchStatus(next: SessionStatus) {
    try {
      await api(`/gm/sessions/${encodeURIComponent(sessionId)}/status`, {
        method: "POST",
        body: JSON.stringify({ status: next }),
      });
    } catch (error) {
      toast.error(errorText(error, "play.statusUpdateFailed"));
    }
  }

  return (
    <div className="flex flex-col gap-2 px-4 pt-4 pb-3">
      <div className="flex items-center justify-between">
        <span className="text-md-on-surface-variant font-sans text-label-small-emph">{t("play.gmConsole")}</span>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon-sm" aria-label={t("play.backstage")}>
            <Link to="/gm">
              <LayoutDashboard />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("play.copyLink")}
            onClick={() => {
              void navigator.clipboard.writeText(`${location.origin}/join/${encodeURIComponent(sessionId)}`).then(
                () => toast.success(t("play.copied")),
                () => toast.error(t("play.copyFailed")),
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
            {sessionStatusLabel(status)}
          </Badge>
        ) : null}
        <Badge variant="soft" tone="default" size="sm">{moduleName ?? t("play.moduleFallback")}</Badge>
        <span className="flex-1" />
        {nextStatus && nextStatus !== "ended" && status ? (
          <Button variant="tertiary" size="sm" className="h-[26px] px-2.5" onClick={() => void patchStatus(nextStatus)}>
            {nextStatusActionLabel(status) ?? t("play.advance")}
          </Button>
        ) : null}
        {status === "active" ? (
          <Button variant="dangerSoft" size="sm" className="h-[26px] px-2.5" onClick={() => void patchStatus("ended")}>
            <SquarePower className="size-3.5" />
            {t("play.endSession")}
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
    <div className="animate-in fade-in slide-in-from-bottom-4 ease-standard-default-spatial flex flex-col gap-2.5 px-4 py-3 duration-500">
      <SectionTitle icon={Drama}>{t("gm.console.phaseTitle")}</SectionTitle>
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
                }).catch((error) => toast.error(errorText(error, "play.phaseUpdateFailed")));
              }}
              className={cn(
                "animate-in fade-in slide-in-from-bottom-4 ease-standard-default-spatial animation-duration-500 flex flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-200 ease-standard-default-effects",
                index === 1 ? "delay-75" : index === 2 ? "delay-150" : index === 3 ? "delay-225" : "",
                isActive
                  ? "bg-md-secondary-container text-md-on-secondary-container"
                  : "text-md-on-surface hover:bg-md-on-surface/8 active:bg-md-on-surface/12",
              )}
            >
              <span className="font-sans text-label-large-emph">{sessionPhaseLabel(phase.key)}</span>
              <span className={cn("font-sans text-label-small", isActive ? "text-md-on-secondary-container/80" : "text-md-on-surface-variant")}>{t(phase.descKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SpeakQueueSection() {
  const pendingQueue = usePlayStore((state) => state.pendingQueue);
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 ease-standard-default-spatial flex flex-col gap-2 px-4 py-3 duration-500 delay-75">
      <div className="bg-md-surface-container flex flex-col gap-2 rounded-xl px-2.5 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ListVideo className="text-md-on-surface-variant size-3.5" />
            <span className="text-foreground font-sans text-label-large-emph">{t("gm.console.queueTitle")}</span>
          </div>
          <Badge variant="soft" tone="warning" size="sm">{t("gm.console.queuePending", { count: pendingQueue.length })}</Badge>
        </div>
        {pendingQueue.map((item, index) => {
          const name = item.characterName ?? t("chat.playerFallback");
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
              <GripVertical className="text-md-on-surface-variant size-3.5" />
              <Avatar size="sm" className="bg-default size-[22px]">
                <AvatarFallback className="text-label-small">{initialsOf(name)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-label-medium">{name} · {item.content}</span>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={t("gm.console.queueUp")} onClick={() => reorder(-1)}>↑</Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={t("gm.console.queueDown")} onClick={() => reorder(1)}>↓</Button>
              <Button type="button" variant="primary" size="sm" className="h-6 px-3" onClick={() => sendSessionCommand("chat:release", { messageId: item.id })}>{t("gm.console.release")}</Button>
              <Button variant="ghost" size="icon-sm" aria-label={t("gm.console.discard", { name })} onClick={() => sendSessionCommand("chat:discard", { messageId: item.id })}>
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
    <div className="animate-in fade-in slide-in-from-bottom-4 ease-standard-default-spatial flex flex-col gap-2.5 px-4 py-3 duration-500 delay-75">
      <SectionTitle icon={ImageIcon}>{t("gm.console.sceneSwitch")}</SectionTitle>
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
