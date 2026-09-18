import { Link, createFileRoute } from "@tanstack/react-router";
import { SessionPhaseLabel, SessionStatusLabel, type CharacterDto, type ModuleDto, type SessionDto, type SessionStatus } from "@cogm/shared";
import { ArrowRight, Ellipsis, FileSpreadsheet, Link as LinkIcon, Package, Play, Plus, SquarePower, Users, VenetianMask } from "lucide-react";
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
import { api, fetchAllPages, isApiError } from "@/lib/api";
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
  const [characterCount, setCharacterCount] = useState(0);
  const [endTarget, setEndTarget] = useState<SessionDto | null>(null);

  async function reload() {
    try {
      const [nextSessions, nextModules, nextCharacters] = await Promise.all([
        fetchAllPages<SessionDto>("/gm/sessions"),
        fetchAllPages<ModuleDto>("/gm/modules"),
        fetchAllPages<CharacterDto>("/gm/characters"),
      ]);
      setSessions(nextSessions);
      setModules(nextModules);
      setCharacterCount(nextCharacters.length);
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "无法加载后台数据");
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const moduleName = (id: string) => modules.find((module) => module.id === id)?.name ?? id;
  const liveCount = sessions.filter((session) => session.status === "active").length;

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
            <Button variant="outline" size="md" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet />
              导入人物卡 Excel
            </Button>
            <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
              <Plus />
              新建团
            </Button>
            </>
          }
        />

        <div className="flex gap-3.5">
          <MetricCard icon={Play} value={String(liveCount)} label="进行中的团" iconContainerClassName="bg-brand-moegi/15" iconClassName="text-brand-moegi" />
          <MetricCard icon={Package} value={String(modules.length)} label="模组" iconContainerClassName="bg-brand-sora/15" iconClassName="text-brand-sora" />
          <MetricCard icon={VenetianMask} value={String(characterCount)} label="人物卡" iconContainerClassName="bg-brand-fuji/15" iconClassName="text-brand-fuji" />
          <MetricCard icon={Users} value={String(sessions.length)} label="全部团" iconContainerClassName="bg-brand-yamabuki/15" iconClassName="text-brand-yamabuki" />
        </div>

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
                <TableCell className="truncate text-label-large-emph">{session.id}</TableCell>
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

        <div className="flex items-center justify-between pt-1.5">
          <h2 className="text-foreground font-serif text-title-medium-emph">模组资源</h2>
          <Button asChild variant="ghost" size="sm" className="text-foreground-secondary">
            <Link to="/gm/modules">
              全部模组
              <ArrowRight />
            </Link>
          </Button>
        </div>

        <div className="flex gap-4">
          {modules.map((module) => (
            <Card
              key={module.id}
              className="border-separator flex-1 gap-0 overflow-hidden border p-0"
            >
              <div className="bg-default h-[118px] w-full" />
              <div className="flex flex-col gap-2 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-foreground text-body-medium-emph">{module.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground-tertiary truncate text-label-small">{module.description || module.ruleId}</span>
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
