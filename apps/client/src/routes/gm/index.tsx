import { Link, createFileRoute } from "@tanstack/react-router";
import { SessionPhaseLabel, SessionStatusLabel, type CharacterDto, type ModuleDto, type ModuleSummaryDto, type SessionDto, type SessionStatus } from "@cogm/shared";
import { ArrowRight, Ellipsis, FileSpreadsheet, Link as LinkIcon, Package, Pencil, Play, Plus, SquarePower, Users, VenetianMask } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { CreateSessionDialog } from "@/features/gm-admin/dialogs/create-session-dialog";
import { ImportCharacterSheetDialog } from "@/features/gm-admin/dialogs/import-character-sheet-dialog";
import { api, fetchAllPages, isApiError, mediaUrl } from "@/lib/api";
import { formatClock, statusTone } from "@/lib/format";
import { requireGmAuth } from "@/lib/identity";

export const Route = createFileRoute("/gm/")({
  beforeLoad: requireGmAuth,
  component: GmDashboardPage,
});

function GmDashboardPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [modules, setModules] = useState<ModuleDto[]>([]);
  const [summaries, setSummaries] = useState<ModuleSummaryDto[]>([]);
  const [characterCount, setCharacterCount] = useState(0);
  const [endTarget, setEndTarget] = useState<SessionDto | null>(null);
  const [renameTarget, setRenameTarget] = useState<SessionDto | null>(null);
  const [renameName, setRenameName] = useState("");

  async function reload() {
    try {
      const [nextSessions, nextModules, nextCharacters, nextSummaries] = await Promise.all([
        fetchAllPages<SessionDto>("/gm/sessions"),
        fetchAllPages<ModuleDto>("/gm/modules"),
        fetchAllPages<CharacterDto>("/gm/characters"),
        api<ModuleSummaryDto[]>("/gm/modules/summaries"),
      ]);
      setSessions(nextSessions);
      setModules(nextModules);
      setCharacterCount(nextCharacters.length);
      setSummaries(nextSummaries);
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "无法加载后台数据");
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const moduleName = (id: string) => modules.find((module) => module.id === id)?.name ?? id;
  const summaryFor = (id: string) => summaries.find((summary) => summary.moduleId === id);
  const liveCount = sessions.filter((session) => session.status === "active").length;

  async function renameSession(sessionId: string) {
    try {
      await api(`/gm/sessions/${encodeURIComponent(sessionId)}/name`, {
        method: "POST",
        body: JSON.stringify({ name: renameName.trim() || null }),
      });
      setRenameTarget(null);
      toast.success("已更新团名");
      await reload();
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "无法重命名");
    }
  }

  async function patchStatus(sessionId: string, status: SessionStatus) {
    try {
      await api(`/gm/sessions/${encodeURIComponent(sessionId)}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await reload();
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "无法更新状态");
    }
  }

  return (
    <AdminLayout active="sessions">
      <div className="flex flex-col gap-5">
        <PageHeader
          title="团管理"
          description="创建团、指定参与 PC，并控制团状态的流转"
          actions={
            <>
            <Button variant="outline" size="md" className="h-12" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet />
              导入人物卡 Excel
            </Button>
            <Button variant="primary" size="md" className="h-12" onClick={() => setCreateOpen(true)}>
              <Plus />
              新建团
            </Button>
            </>
          }
        />

        <div className="animate-in fade-in slide-in-from-bottom-4 flex gap-3.5 duration-500 ease-standard-default-spatial">
          <MetricCard icon={Play} value={String(liveCount)} label="进行中的团" tone="primary" />
          <MetricCard icon={Package} value={String(modules.length)} label="模组" tone="secondary" />
          <MetricCard icon={VenetianMask} value={String(characterCount)} label="人物卡" tone="tertiary" />
          <MetricCard icon={Users} value={String(sessions.length)} label="全部团" tone="error" />
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 overflow-hidden rounded-2xl bg-md-surface-container delay-75 duration-500 ease-standard-default-spatial">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>团名</TableHead>
              <TableHead className="w-42">模组</TableHead>
              <TableHead className="w-24">状态</TableHead>
              <TableHead className="w-26">团内阶段</TableHead>
              <TableHead className="w-35">编号</TableHead>
              <TableHead className="w-25">更新</TableHead>
              <TableHead className="w-45">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell className="truncate text-label-large-emph">{session.name ?? "未命名团"}</TableCell>
                <TableCell className="text-foreground-secondary text-body-medium">{moduleName(session.moduleId)}</TableCell>
                <TableCell>
                  <Badge variant="soft" tone={statusTone(session.status)} size="sm">
                    {SessionStatusLabel[session.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {session.phase ? (
                  <Badge variant="soft" tone="accent" size="sm">
                    {SessionPhaseLabel[session.phase]}
                  </Badge>
                ) : (
                  <span className="text-foreground-tertiary text-label-large">—</span>
                )}
                </TableCell>
                <TableCell className="text-foreground-secondary text-body-small">{session.id.slice(0, 8)}</TableCell>
                <TableCell className="text-foreground-tertiary text-body-small">{formatClock(session.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {session.status !== "ended" && session.status !== "active" ? (
                      <Button
                        type="button"
                        variant="tertiary"
                        size="sm"
                        className="h-7 px-3"
                        onClick={() => {
                          const next = session.status === "waiting" ? "preparing" : "active";
                          void patchStatus(session.id, next);
                        }}
                      >
                        {session.status === "waiting" ? "进入准备" : "开始进行"}
                      </Button>
                    ) : null}
                    <Button
                      asChild
                      type="button"
                      variant={session.status === "active" ? "primary" : "tertiary"}
                      size="sm"
                      className="h-7 px-3"
                    >
                      <Link to="/gm/session/$sessionId" params={{ sessionId: session.id }}>
                        {session.status === "ended" ? "查看" : "进入控制台"}
                      </Link>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`${session.id} 更多操作`} className="size-7 text-foreground-tertiary">
                          <Ellipsis />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setRenameTarget(session);
                            setRenameName(session.name ?? "");
                          }}
                        >
                          <Pencil />
                          重命名
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            void navigator.clipboard.writeText(`${location.origin}/join/${encodeURIComponent(session.id)}`).then(
                              () => toast.success("已复制团链接"),
                              () => toast.error("复制失败"),
                            );
                          }}
                        >
                          <LinkIcon />
                          复制入团链接
                        </DropdownMenuItem>
                        {session.status === "active" ? (
                          <DropdownMenuItem variant="destructive" onClick={() => setEndTarget(session)}>
                            <SquarePower />
                            结束此团
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 flex items-center justify-between pt-1.5 delay-150 duration-500 ease-standard-default-spatial">
          <h2 className="text-foreground font-serif text-headline-small-emph">模组资源</h2>
          <Button asChild variant="ghost" size="sm" className="text-foreground-secondary">
            <Link to="/gm/modules">
              全部模组
              <ArrowRight />
            </Link>
          </Button>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 flex gap-4 delay-150 duration-500 ease-standard-default-spatial">
          {modules.map((module) => (
            <Card
              key={module.id}
              className="flex-1 gap-0 overflow-hidden rounded-2xl p-0"
            >
              {(() => {
                const summary = summaryFor(module.id);
                const cover = summary?.coverAssetId ? mediaUrl(summary.coverAssetId) : null;
                return cover ? (
                  <img src={cover} alt={`${module.name} 封面`} className="h-[118px] w-full object-cover" />
                ) : (
                  <div className="bg-md-surface-container-highest flex h-[118px] w-full items-center justify-center">
                    <Package className="text-foreground-tertiary size-7" />
                  </div>
                );
              })()}
              <div className="flex flex-col gap-2 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-foreground font-serif text-title-medium-emph">{module.name}</span>
                </div>
                {summaryFor(module.id) ? (
                  <span className="text-foreground-secondary text-label-small">
                    场景 {summaryFor(module.id)!.sceneCount} · 情报 {summaryFor(module.id)!.handoutCount} · 曲目 {summaryFor(module.id)!.trackCount} · 人物 {summaryFor(module.id)!.characterCount}
                  </span>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-foreground-tertiary truncate text-label-small">
                    {summaryFor(module.id)
                      ? `更新 ${new Date(summaryFor(module.id)!.updatedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                      : module.description || module.ruleId}
                  </span>
                  <Button
                    asChild
                    type="button"
                    variant="accentSoft"
                    size="sm"
                    className="h-[26px] px-3"
                  >
                    <Link to="/gm/module/$moduleId" params={{ moduleId: module.id }}>
                      管理
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <CreateSessionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          void reload();
        }}
      />
      <ImportCharacterSheetDialog open={importOpen} onOpenChange={setImportOpen} />
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>重命名团</DialogTitle>
            <DialogDescription>留空则回退显示模组名。当前编号 {renameTarget?.id.slice(0, 8) ?? ""}</DialogDescription>
          </DialogHeader>
          <Input
            value={renameName}
            onChange={(event) => setRenameName(event.target.value)}
            placeholder="例如：灯塔之夜 · 第二场"
            maxLength={60}
            aria-label="团名"
            autoFocus
          />
          <DialogFooter>
            <Button variant="tertiary" size="sm" onClick={() => setRenameTarget(null)}>
              取消
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const id = renameTarget?.id;
                if (id) void renameSession(id);
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={endTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEndTarget(null);
        }}
        icon={SquarePower}
        confirmIcon={SquarePower}
        title="结束此团"
        description={`结团后玩家将无法发言与掷骰，仅可回看记录。团 ${endTarget?.id.slice(0, 8) ?? ""} 确认结团？`}
        confirmLabel="结团"
        onConfirm={() => {
          const id = endTarget?.id;
          setEndTarget(null);
          if (id) {
            void patchStatus(id, "ended");
          }
        }}
      />
    </AdminLayout>
  );
}
