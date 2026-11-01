import { Link, createFileRoute } from "@tanstack/react-router";
import type { ModuleDto, ThemeSummaryDto } from "@cogm/shared";
import { Package, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { api, fetchAllPages } from "@/lib/api";
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
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [themeId, setThemeId] = useState("");
  const [themes, setThemes] = useState<ThemeSummaryDto[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function reload() {
    try {
      setModules(await fetchAllPages<ModuleDto>("/gm/modules"));
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

  async function createModule() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error(t("gm.modules.nameRequired"));
      return;
    }
    try {
      await api("/gm/modules", {
        method: "POST",
        body: JSON.stringify({
          name: trimmed,
          description: description.trim(),
          ruleId: "coc7e",
          themeId: themeId || null,
        }),
      });
      setName("");
      setDescription("");
      setThemeId("");
      await reload();
    } catch (error) {
      toast.error(errorText(error, "gm.modules.createFailed"));
    }
  }

  return (
    <AdminLayout active="modules">
      <div className="flex flex-col gap-5">
        <PageHeader
          title={t("gm.modules.title")}
          description={t("gm.modules.description")}
        />
        <Card className="animate-in fade-in slide-in-from-bottom-4 flex flex-col gap-3 rounded-2xl p-4 duration-500 ease-standard-default-spatial">
          <div className="font-serif text-title-medium-emph">{t("gm.modules.createTitle")}</div>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("gm.modules.namePlaceholder")} aria-label={t("gm.modules.namePlaceholder")} />
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("gm.modules.descriptionPlaceholder")} aria-label={t("gm.modules.descriptionPlaceholder")} />
          <Select value={themeId || "default"} onValueChange={(value) => setThemeId(value === "default" ? "" : value)}>
            <SelectTrigger className="h-10" aria-label={t("gm.modules.theme")}>
              <SelectValue placeholder={t("gm.modules.themeDefault")} />
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
          <Button type="button" variant="primary" className="h-12 self-start px-6" onClick={() => void createModule()}>
            <Plus /> {t("gm.modules.create")}
          </Button>
        </Card>
        <div className="grid grid-cols-2 gap-4">
          {modules.map((module, index) => (
            <Card
              key={module.id}
              className={cn(
                "animate-in fade-in slide-in-from-bottom-4 flex-row items-center gap-3 rounded-2xl p-4 duration-500 ease-standard-default-spatial",
                index % 3 === 1 ? "delay-75" : index % 3 === 2 ? "delay-150" : "",
              )}
            >
              <span className="bg-md-secondary-container text-md-on-secondary-container flex size-10 shrink-0 items-center justify-center rounded-full">
                <Package className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-serif text-title-medium-emph">{module.name}</div>
                <div className="text-foreground-tertiary truncate text-body-small">{module.description || module.ruleId}</div>
                <Select value={module.themeId ?? "default"} onValueChange={(value) => void updateTheme(module.id, value === "default" ? "" : value)}>
                  <SelectTrigger className="mt-1 h-7 w-48 text-label-small" aria-label={t("gm.modules.themeAria", { name: module.name })}>
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
              </div>
              <Button asChild size="sm" variant="accentSoft">
                <Link to="/gm/module/$moduleId" params={{ moduleId: module.id }}>{t("gm.modules.manage")}</Link>
              </Button>
              <Button type="button" size="icon-sm" variant="ghost" aria-label={`${t("gm.modules.deleteConfirm")} ${module.name}`} onClick={() => setDeleteId(module.id)}>
                <Trash2 />
              </Button>
            </Card>
          ))}
        </div>
      </div>
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
