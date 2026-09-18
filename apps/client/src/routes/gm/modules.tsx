import { Link, createFileRoute } from "@tanstack/react-router";
import type { ModuleDto } from "@cogm/shared";
import { Package, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { api, fetchAllPages, isApiError } from "@/lib/api";
import { requireGmAuth } from "@/lib/identity";

export const Route = createFileRoute("/gm/modules")({
  beforeLoad: requireGmAuth,
  component: GmModulesPage,
});

function GmModulesPage() {
  const [modules, setModules] = useState<ModuleDto[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function reload() {
    try {
      setModules(await fetchAllPages<ModuleDto>("/gm/modules"));
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "无法加载模组");
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function createModule() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("请填写模组名称");
      return;
    }
    try {
      await api("/gm/modules", {
        method: "POST",
        body: JSON.stringify({ name: trimmed, description: description.trim(), ruleId: "coc7e" }),
      });
      setName("");
      setDescription("");
      await reload();
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "创建失败");
    }
  }

  return (
    <AdminLayout active="modules">
      <div className="flex flex-col gap-5">
        <PageHeader
          title="模组管理"
          description="模组是场景、音乐、情报与人物的资源容器"
        />
        <Card className="flex flex-col gap-3 p-4">
          <div className="text-title-medium-emph">新建模组</div>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="模组名称" aria-label="模组名称" />
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="简介" aria-label="模组简介" />
          <Button type="button" variant="primary" className="self-start" onClick={() => void createModule()}>
            <Plus /> 创建
          </Button>
        </Card>
        <div className="grid grid-cols-2 gap-4">
          {modules.map((module) => (
            <Card key={module.id} className="flex items-center gap-3 p-4">
              <Package className="text-brand-sora size-5" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-body-large-emph">{module.name}</div>
                <div className="text-foreground-tertiary truncate text-body-small">{module.description || module.ruleId}</div>
              </div>
              <Button asChild size="sm" variant="accentSoft">
                <Link to="/gm/module/$moduleId" params={{ moduleId: module.id }}>管理</Link>
              </Button>
              <Button type="button" size="icon-sm" variant="ghost" aria-label={`删除 ${module.name}`} onClick={() => setDeleteId(module.id)}>
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
        title="删除模组"
        description="将同时删除其场景、曲目与情报元数据。"
        confirmLabel="删除"
        onConfirm={() => {
          const id = deleteId;
          setDeleteId(null);
          if (!id) return;
          void api(`/gm/modules/${encodeURIComponent(id)}`, { method: "DELETE" })
            .then(() => reload())
            .catch((error) => toast.error(isApiError(error) ? error.message : "删除失败"));
        }}
      />
    </AdminLayout>
  );
}
