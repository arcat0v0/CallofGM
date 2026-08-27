import {
  ArrowLeft,
  Check,
  CircleCheck,
  FileSpreadsheet,
  TriangleAlert,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertIcon } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, isApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

type Preview = {
  importToken: string;
  preview: {
    characterName: string;
    sheetData: {
      attributes?: Record<string, number>;
      skills?: Record<string, number>;
    };
    errors: Array<{ cell?: string; message: string }>;
  };
};

function ImportCharacterSheetDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [kind, setKind] = useState<"pc" | "npc">("pc");
  const [pending, setPending] = useState(false);

  async function uploadPreview(next: File) {
    setPending(true);
    try {
      const body = new FormData();
      body.append("file", next);
      body.append("ruleId", "coc7e");
      const result = await api<Preview>("/gm/characters/import/preview", { method: "POST", body });
      setFile(next);
      setPreview(result);
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "解析失败");
    } finally {
      setPending(false);
    }
  }

  async function confirm() {
    if (!preview) {
      return;
    }
    if (preview.preview.errors.length > 0) {
      toast.error("存在解析错误，无法入库");
      return;
    }
    setPending(true);
    try {
      await api("/gm/characters/import/confirm", {
        method: "POST",
        body: JSON.stringify({ importToken: preview.importToken, kind }),
      });
      toast.success("人物卡已入库");
      onOpenChange(false);
      setPreview(null);
      setFile(null);
      onImported?.();
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "入库失败");
    } finally {
      setPending(false);
    }
  }

  const attributes = preview?.preview.sheetData.attributes ?? {};
  const skills = Object.entries(preview?.preview.sheetData.skills ?? {}).slice(0, 6);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-160 gap-0 p-0" showCloseButton={false}>
        <DialogHeader className="border-separator flex-row items-center justify-between border-b px-5 py-[18px]">
          <div className="flex flex-col gap-0.5">
            <DialogTitle>导入人物卡 Excel</DialogTitle>
            <DialogDescription>按 CoC 7e 模板解析 · 确认无误后入库</DialogDescription>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="关闭导入弹窗" onClick={() => onOpenChange(false)}>
            <X />
          </Button>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-5 py-5">
          <Input
            type="file"
            accept=".xlsx,.xls"
            aria-label="选择人物卡 Excel"
            onChange={(event) => {
              const next = event.target.files?.[0];
              if (next) {
                void uploadPreview(next);
              }
            }}
          />
          {file ? (
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="text-accent-hover size-4" />
              <span className="text-foreground text-sm">{file.name}</span>
            </div>
          ) : null}
          {preview ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-foreground font-serif text-lg font-semibold">{preview.preview.characterName}</span>
                <Badge variant="soft" tone={kind === "pc" ? "accent" : "default"} size="sm">
                  {kind.toUpperCase()}
                </Badge>
                <Button type="button" size="sm" variant="tertiary" className="h-7" onClick={() => setKind(kind === "pc" ? "npc" : "pc")}>
                  切换为 {kind === "pc" ? "NPC" : "PC"}
                </Button>
              </div>
              <p className="text-foreground-secondary text-xs">
                STR {attributes.str ?? "—"} / DEX {attributes.dex ?? "—"} / INT {attributes.int ?? "—"}
              </p>
              <p className="text-foreground-secondary text-xs">
                {skills.map(([name, value]) => `${name} ${value}`).join(" · ")}
              </p>
              {preview.preview.errors.length > 0 ? (
                <Alert>
                  <AlertIcon>
                    <TriangleAlert />
                  </AlertIcon>
                  <AlertDescription>
                    {preview.preview.errors.map((error) => error.message).join("；")}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertIcon>
                    <CircleCheck />
                  </AlertIcon>
                  <AlertDescription>映射无错误，可以入库。</AlertDescription>
                </Alert>
              )}
            </>
          ) : null}
        </div>
        <div className="border-separator flex items-center justify-between border-t px-5 py-4">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            <ArrowLeft />
            取消
          </Button>
          <Button variant="primary" size="sm" disabled={!preview || pending} onClick={() => void confirm()}>
            <Check className={cn("size-4", pending && "opacity-50")} />
            确认入库
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { ImportCharacterSheetDialog };
