import { Link, createFileRoute } from "@tanstack/react-router";
import { SessionPhaseLabel, SessionStatusLabel, type SessionPhase, type SessionStatus } from "@cogm/shared";
import { ArrowRight, Ellipsis, FileSpreadsheet, Package, Play, Plus, Users, VenetianMask } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { CreateSessionDialog } from "@/features/gm-admin/dialogs/create-session-dialog";
import { ImportCharacterSheetDialog } from "@/features/gm-admin/dialogs/import-character-sheet-dialog";
import { api, fetchAllPages, isApiError } from "@/lib/api";
import { formatClock } from "@/lib/chat-map";
import { requireGmAuth } from "@/lib/identity";

export const Route = createFileRoute("/gm/")({
  beforeLoad: requireGmAuth,
  component: GmDashboardPage,
});

type Tone = "success" | "accent" | "warning" | "default";

type SessionRow = {
  id: string;
  moduleId: string;
  status: SessionStatus;
  phase: SessionPhase;
  createdAt: number;
};

type ModuleRow = {
  id: string;
  name: string;
  description: string;
  ruleId: string;
  createdAt: number;
};

type CharacterRow = {
  id: string;
  kind: string;
};

function statusTone(status: SessionStatus): Tone {
  if (status === "active") return "success";
  if (status === "preparing") return "warning";
  if (status === "waiting") return "default";
  return "default";
}

function GmDashboardPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [characterCount, setCharacterCount] = useState(0);

  async function reload() {
    try {
      const [nextSessions, nextModules, nextCharacters] = await Promise.all([
        fetchAllPages<SessionRow>("/gm/sessions"),
        fetchAllPages<ModuleRow>("/gm/modules"),
        fetchAllPages<CharacterRow>("/gm/characters"),
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
            <Button variant="primaryGradient" size="md" onClick={() => setCreateOpen(true)}>
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
                <TableCell className="truncate text-[13px] font-semibold">{session.id}</TableCell>
                <TableCell className="text-foreground-secondary text-[13px]">{moduleName(session.moduleId)}</TableCell>
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
                  <span className="text-foreground-tertiary font-chip text-[13px]">—</span>
                )}
                </TableCell>
                <TableCell className="text-foreground-secondary text-xs">{session.id.slice(0, 8)}</TableCell>
                <TableCell className="text-foreground-tertiary font-chip text-xs">{formatClock(session.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {session.status !== "ended" && session.status !== "active" ? (
                      <Button
                        type="button"
                        variant="tertiary"
                        size="sm"
                        className="h-7 px-3 text-xs font-semibold"
                        onClick={() => {
                          const next = session.status === "waiting" ? "preparing" : "active";
                          void api(`/gm/sessions/${encodeURIComponent(session.id)}/status`, {
                            method: "POST",
                            body: JSON.stringify({ status: next }),
                          })
                            .then(() => reload())
                            .catch((error) => toast.error(isApiError(error) ? error.message : "无法更新状态"));
                        }}
                      >
                        {session.status === "waiting" ? "进入准备" : "开始进行"}
                      </Button>
                    ) : null}
                    <Button
                      asChild
                      type="button"
                      variant={session.status === "active" ? "primaryGradient" : "tertiary"}
                      size="sm"
                      className="h-7 px-3 text-xs font-semibold"
                    >
                      <Link to="/gm/session/$sessionId" params={{ sessionId: session.id }}>
                        {session.status === "ended" ? "查看" : "进入控制台"}
                      </Link>
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`${session.id} 更多操作`} className="size-7 text-foreground-tertiary">
                      <Ellipsis />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between pt-1.5">
          <h2 className="text-foreground font-serif text-[17px] font-bold">模组资源</h2>
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
              className="border-separator flex-1 gap-0 overflow-hidden rounded-[14px] border p-0"
            >
              <div className="bg-default h-[118px] w-full" />
              <div className="flex flex-col gap-2 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-foreground text-sm font-semibold">{module.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground-tertiary truncate text-[11px]">{module.description || module.ruleId}</span>
                  <Button
                    asChild
                    type="button"
                    variant="accentSoft"
                    size="sm"
                    className="h-[26px] px-3 text-[11px] font-semibold"
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
    </AdminLayout>
  );
}
