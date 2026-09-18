import { Check, Package, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { CharacterDto, CreateSessionResponse, ModuleDto } from "@cogm/shared";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, fetchAllPages, isApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const statusOptions = ["等待开始", "准备中", "进行中"] as const;
const statusSegments = statusOptions.map((option) => ({ value: option, label: option }));

function kindLabel(kind: string): "PC" | "NPC" {
  return kind.toLowerCase() === "npc" ? "NPC" : "PC";
}

function CreateSessionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const [modules, setModules] = useState<ModuleDto[]>([]);
  const [characters, setCharacters] = useState<CharacterDto[]>([]);
  const [moduleId, setModuleId] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("等待开始");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    void (async () => {
      try {
        const nextModules = await fetchAllPages<ModuleDto>("/gm/modules");
        setModules(nextModules);
        setModuleId((current) => current || nextModules[0]?.id || "");
      } catch (error) {
        toast.error(isApiError(error) ? error.message : "无法加载模组");
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open || !moduleId) {
      setCharacters([]);
      return;
    }
    setSelectedIds(new Set());
    void fetchAllPages<CharacterDto>(`/gm/modules/${encodeURIComponent(moduleId)}/characters`)
      .then(setCharacters)
      .catch((error) => toast.error(isApiError(error) ? error.message : "无法加载模组人物"));
  }, [open, moduleId]);

  function toggleCharacter(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (!moduleId || pending) {
      return;
    }
    setPending(true);
    try {
      const created = await api<CreateSessionResponse>("/gm/sessions", {
        method: "POST",
        body: JSON.stringify({
          moduleId,
          characterIds: [...selectedIds],
        }),
      });
      if (status === "准备中") {
        await api(`/gm/sessions/${encodeURIComponent(created.session.id)}/status`, {
          method: "POST",
          body: JSON.stringify({ status: "preparing" }),
        });
      }
      if (status === "进行中") {
        await api(`/gm/sessions/${encodeURIComponent(created.session.id)}/status`, {
          method: "POST",
          body: JSON.stringify({ status: "preparing" }),
        });
        await api(`/gm/sessions/${encodeURIComponent(created.session.id)}/status`, {
          method: "POST",
          body: JSON.stringify({ status: "active" }),
        });
      }
      onOpenChange(false);
      onCreated?.();
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "创建失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-140 gap-0 p-0" showCloseButton={false}>
        <DialogHeader className="flex-row items-center justify-between px-5 py-[18px]">
          <div className="flex flex-col gap-0.5">
            <DialogTitle>新建团</DialogTitle>
            <DialogDescription>从当前模组已关联的人物中选择 PC / NPC。</DialogDescription>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="关闭新建团弹窗" onClick={() => onOpenChange(false)}>
            <X />
          </Button>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-5 py-5">
          <FormField label="选择模组">
            <Select value={moduleId} onValueChange={setModuleId}>
              <SelectTrigger className="h-10 border-separator-secondary">
                <Package className="text-accent-hover" />
                <SelectValue placeholder="选择模组" />
              </SelectTrigger>
              <SelectContent>
                {modules.map((module) => (
                  <SelectItem key={module.id} value={module.id}>
                    {module.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="指定参与人物">
            <div className="flex flex-col gap-1.5">
              {characters.length === 0 ? (
                <p className="text-foreground-tertiary text-body-small">
                  当前模组尚未关联人物。可在模组页关联 PC / NPC 后再选，也可以先创建空团。
                  {moduleId ? (
                    <>
                      {" "}
                      <Link to="/gm/module/$moduleId" params={{ moduleId }} className="text-accent">
                        去模组页关联
                      </Link>
                    </>
                  ) : null}
                </p>
              ) : (
                characters.map((character) => {
                  const selected = selectedIds.has(character.id);
                  const kind = kindLabel(character.kind);
                  return (
                    <Label
                      key={character.id}
                      className={cn(
                        "cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left",
                        selected ? "bg-accent-soft" : "bg-surface-tertiary",
                      )}
                    >
                      <Checkbox checked={selected} onCheckedChange={() => toggleCharacter(character.id)} />
                      <span className="text-foreground font-sans text-label-large-emph">{character.name}</span>
                      <span className="flex-1" />
                      <Badge variant="soft" tone={kind === "NPC" ? "warning" : "accent"} size="sm">
                        {kind}
                      </Badge>
                      <Badge variant="soft" tone={selected ? "accent" : "default"} size="sm">
                        {selected ? "已选" : "未选"}
                      </Badge>
                    </Label>
                  );
                })
              )}
            </div>
          </FormField>

          <FormField label="初始状态">
            <SegmentedControl
              value={status}
              options={statusSegments}
              onValueChange={setStatus}
              className="h-[38px] rounded-md p-[3px]"
              itemClassName="h-full text-label-large"
            />
          </FormField>
        </div>

        <DialogFooter className="bg-md-surface-container-low flex-row items-center justify-between rounded-b-xl px-5 py-4 sm:justify-between">
          <span className="text-foreground-tertiary font-sans text-label-small">创建后可在团管理中继续调整</span>
          <div className="flex items-center gap-2.5">
            <Button variant="tertiary" size="sm" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button variant="primary" size="sm" disabled={!moduleId || pending} onClick={() => void handleCreate()}>
              <Check className="size-4" />
              创建团
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { CreateSessionDialog };
