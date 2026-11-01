import { Link, createFileRoute } from "@tanstack/react-router";
import type { CharacterDto, ModuleDto, SessionDto, SessionStatus } from "@cogm/shared";
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
import { api, fetchAllPages } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { sessionPhaseLabel, sessionStatusLabel } from "@/i18n/labels";
import { t, useI18nVersion } from "@/i18n";
import { formatClock, statusTone } from "@/lib/format";
import { requireGmAuth } from "@/lib/identity";

export const Route = createFileRoute("/gm/")({
  beforeLoad: requireGmAuth,
  component: GmDashboardPage,
});

function GmDashboardPage() {
  useI18nVersion();
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
      toast.error(errorText(error, "gm.dashboard.loadFailed"));
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
      toast.error(errorText(error, "gm.dashboard.statusUpdateFailed"));
    }
  }

  return (
    <AdminLayout active="sessions">
      <div className="flex flex-col gap-5">
        <PageHeader
          title={t("gm.dashboard.title")}
          description={t("gm.dashboard.description")}
          actions={
            <>
            <Button variant="outline" size="md" className="h-12" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet />
              {t("gm.dashboard.importExcel")}
            </Button>
            <Button variant="primary" size="md" className="h-12" onClick={() => setCreateOpen(true)}>
              <Plus />
              {t("gm.dashboard.createSession")}
            </Button>
            </>
          }
        />

        <div className="animate-in fade-in slide-in-from-bottom-4 flex gap-3.5 duration-500 ease-standard-default-spatial">
          <MetricCard icon={Play} value={String(liveCount)} label={t("gm.dashboard.liveSessions")} tone="primary" />
          <MetricCard icon={Package} value={String(modules.length)} label={t("gm.dashboard.modules")} tone="secondary" />
          <MetricCard icon={VenetianMask} value={String(characterCount)} label={t("gm.dashboard.characters")} tone="tertiary" />
          <MetricCard icon={Users} value={String(sessions.length)} label={t("gm.dashboard.allSessions")} tone="error" />
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 overflow-hidden rounded-2xl bg-md-surface-container delay-75 duration-500 ease-standard-default-spatial">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>{t("gm.dashboard.sessionName")}</TableHead>
              <TableHead className="w-42">{t("gm.dashboard.module")}</TableHead>
              <TableHead className="w-24">{t("gm.dashboard.status")}</TableHead>
              <TableHead className="w-26">{t("gm.dashboard.phase")}</TableHead>
              <TableHead className="w-35">{t("gm.dashboard.code")}</TableHead>
              <TableHead className="w-25">{t("gm.dashboard.updated")}</TableHead>
              <TableHead className="w-45">{t("gm.dashboard.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell className="truncate text-label-large-emph">{session.id}</TableCell>
                <TableCell className="text-foreground-secondary text-body-medium">{moduleName(session.moduleId)}</TableCell>
                <TableCell>
                  <Badge variant="soft" tone={statusTone(session.status)} size="sm">
                    {sessionStatusLabel(session.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {session.phase ? (
                  <Badge variant="soft" tone="accent" size="sm">
                    {sessionPhaseLabel(session.phase)}
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
                        {session.status === "waiting" ? t("gm.dashboard.startPreparing") : t("gm.dashboard.startActive")}
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
                        {session.status === "ended" ? t("gm.dashboard.view") : t("gm.dashboard.enterConsole")}
                      </Link>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={t("gm.dashboard.moreActions", { id: session.id })} className="size-7 text-foreground-tertiary">
                          <Ellipsis />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            void navigator.clipboard.writeText(`${location.origin}/join/${encodeURIComponent(session.id)}`).then(
                              () => toast.success(t("play.copied")),
                              () => toast.error(t("play.copyFailed")),
                            );
                          }}
                        >
                          <LinkIcon />
                          {t("gm.dashboard.copyLink")}
                        </DropdownMenuItem>
                        {session.status === "active" ? (
                          <DropdownMenuItem variant="destructive" onClick={() => setEndTarget(session)}>
                            <SquarePower />
                            {t("gm.dashboard.endSession")}
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
          <h2 className="text-foreground font-serif text-headline-small-emph">{t("gm.dashboard.moduleResources")}</h2>
          <Button asChild variant="ghost" size="sm" className="text-foreground-secondary">
            <Link to="/gm/modules">
              {t("gm.dashboard.allModules")}
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
              <div className="bg-md-surface-container-highest h-[118px] w-full rounded-t-2xl" />
              <div className="flex flex-col gap-2 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-foreground font-serif text-title-medium-emph">{module.name}</span>
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
                      {t("gm.dashboard.manage")}
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
        title={t("gm.dashboard.endTitle")}
        description={t("gm.dashboard.endDescription", { id: endTarget?.id.slice(0, 8) ?? "" })}
        confirmLabel={t("gm.dashboard.endConfirm")}
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
