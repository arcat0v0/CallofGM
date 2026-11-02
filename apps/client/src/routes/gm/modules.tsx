import { Link, createFileRoute } from "@tanstack/react-router";
import type { ModuleDto, ModuleSummaryDto, ThemeSummaryDto } from "@cogm/shared";
import { ArrowRight, Ellipsis, Package, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { CreateModuleDialog } from "@/features/gm-admin/dialogs/create-module-dialog";
import { api, fetchAllPages, mediaUrl } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { t, useI18nVersion } from "@/i18n";
import { requireGmAuth } from "@/lib/identity";
import { cn } from "@/lib/utils";
import { listThemes } from "@/themes/themes-api";

export const Route = createFileRoute("/gm/modules")({
  beforeLoad: requireGmAuth,
  component: GmModulesPage,
});

function GmModulesPage() {
  useI18nVersion();
  const [modules, setModules] = useState<ModuleDto[]>([]);
  const [themes, setThemes] = useState<ThemeSummaryDto[]>([]);
  const [summaries, setSummaries] = useState<ModuleSummaryDto[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function reload() {
    try {
      const [nextModules, nextSummaries] = await Promise.all([
        fetchAllPages<ModuleDto>("/gm/modules"),
        api<ModuleSummaryDto[]>("/gm/modules/summaries"),
      ]);
      setModules(nextModules);
      setSummaries(nextSummaries);
    } catch (error) {
      toast.error(errorText(error, "gm.modules.loadFailed"));
    }
  }

  useEffect(() => {
    void reload();
    void listThemes()
      .then(setThemes)
      .catch(() => undefined);
  }, []);

  async function updateTheme(moduleId: string, nextThemeId: string): Promise<void> {
    try {
      await api(`/gm/modules/${encodeURIComponent(moduleId)}`, {
        method: "PATCH",
        body: JSON.stringify({ themeId: nextThemeId || null }),
      });
      await reload();
    } catch (error) {
      toast.error(errorText(error, "gm.modules.themeUpdateFailed"));
    }
  }

  const summaryFor = (id: string) => summaries.find((summary) => summary.moduleId === id);

  return (
    <AdminLayout>
      <div className="flex flex-col gap-5">
        <PageHeader
          title={t("gm.modules.title")}
          description={t("gm.modules.description")}
          actions={
            <Button variant="primary" size="md" className="h-12" onClick={() => setCreateOpen(true)}>
              <Plus />
              {t("gm.modules.new")}
            </Button>
          }
        />

        {modules.length === 0 ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 flex min-h-72 flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-md-outline-variant/60 bg-md-surface-container/40 px-6 py-16 text-center duration-500 ease-standard-default-spatial">
            <span className="bg-md-surface-container-highest text-md-on-surface-variant grid size-16 place-items-center rounded-full">
              <Package className="size-7" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-foreground font-serif text-title-large-emph">{t("gm.modules.empty")}</h2>
              <p className="text-foreground-secondary text-body-medium">{t("gm.modules.emptyHint")}</p>
            </div>
            <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus />
              {t("gm.modules.new")}
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {modules.map((module, index) => {
              const summary = summaryFor(module.id);
              const cover = summary?.coverAssetId ? mediaUrl(summary.coverAssetId) : null;
              return (
                <Card
                  key={module.id}
                  className={cn(
                    "animate-in fade-in slide-in-from-bottom-4 group gap-0 overflow-hidden rounded-3xl p-0 duration-500 ease-standard-default-spatial",
                    index % 3 === 1 ? "delay-75" : index % 3 === 2 ? "delay-150" : "",
                  )}
                >
                  <div className="bg-md-surface-container-highest relative aspect-[16/9] w-full overflow-hidden">
                    {cover ? (
                      <img
                        src={cover}
                        alt={t("gm.modules.coverAlt", { name: module.name })}
                        className="size-full object-cover transition-transform duration-500 ease-standard-default-spatial group-hover:scale-[1.03]"
                      />
                    ) : (
                      <Package className="text-foreground-tertiary absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2" />
                    )}
                    <div className="from-md-surface-container absolute inset-x-0 bottom-0 h-16 bg-linear-to-t to-transparent" />
                    <Badge variant="soft" tone="default" size="sm" className="absolute top-3 left-3 font-mono uppercase">
                      {module.ruleId}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="bg-md-surface-container-lowest/70 text-foreground-secondary hover:bg-md-surface-container-highest absolute top-2.5 right-2.5 size-8 backdrop-blur-md"
                          aria-label={t("gm.modules.moreActions", { name: module.name })}
                        >
                          <Ellipsis />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem variant="destructive" onClick={() => setDeleteId(module.id)}>
                          <Trash2 />
                          {t("gm.modules.deleteTitle")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="flex min-w-0 flex-col gap-1">
                      <h3 className="text-foreground truncate font-serif text-title-large-emph">{module.name}</h3>
                      <p className="text-foreground-secondary line-clamp-2 min-h-10 text-body-small">
                        {module.description || t("gm.modules.noDescription")}
                      </p>
                    </div>

                    {summary ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {([
                          ["gm.module.tabScene", summary.sceneCount],
                          ["gm.module.tabCharacters", summary.characterCount],
                          ["gm.module.tabHandout", summary.handoutCount],
                          ["gm.module.tabMusic", summary.trackCount],
                        ] as const).map(([key, count]) => (
                          <Badge key={key} variant="soft" tone="default" size="sm">
                            {t(key, { count })}
                          </Badge>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-auto flex items-center justify-between gap-2 border-separator-secondary/40 border-t pt-3">
                      <Select
                        value={module.themeId ?? "default"}
                        onValueChange={(value) => void updateTheme(module.id, value === "default" ? "" : value)}
                      >
                        <SelectTrigger
                          className="text-foreground-secondary hover:bg-md-on-surface/8 h-8 w-auto max-w-40 gap-1 border-0 bg-transparent px-1.5 text-label-small"
                          aria-label={t("gm.modules.themeAria", { name: module.name })}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">{t("gm.modules.themeDefault")}</SelectItem>
                          {themes.map((theme) => (
                            <SelectItem key={theme.id} value={theme.id}>
                              {theme.name} ({theme.version})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button asChild size="sm" variant="tertiary" className="h-8 shrink-0 px-3">
                        <Link to="/gm/module/$moduleId" params={{ moduleId: module.id }}>
                          {t("gm.modules.manage")}
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    </div>

                    {summary ? (
                      <span className="text-foreground-tertiary text-label-small">
                        {t("gm.dashboard.moduleUpdated", {
                          time: new Date(summary.updatedAt).toLocaleString("zh-CN", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          }),
                        })}
                      </span>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <CreateModuleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        themes={themes}
        onCreated={() => void reload()}
      />
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        icon={Trash2}
        confirmIcon={Trash2}
        title={t("gm.modules.deleteTitle")}
        description={t("gm.modules.deleteDescription")}
        confirmLabel={t("gm.modules.deleteConfirm")}
        onConfirm={() => {
          const id = deleteId;
          setDeleteId(null);
          if (!id) return;
          void api(`/gm/modules/${encodeURIComponent(id)}`, { method: "DELETE" })
            .then(() => reload())
            .catch((error) => toast.error(errorText(error, "gm.modules.deleteFailed")));
        }}
      />
    </AdminLayout>
  );
}
