import {
  ArrowLeft,
  Check,
  CircleCheck,
  Database,
  FileSpreadsheet,
  RefreshCw,
  TriangleAlert,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const previewFields = [
  { key: "姓名", value: "远野 澪" },
  { key: "职业", value: "私家侦探" },
  { key: "力量 / 敏捷 / 智力", value: "55 / 70 / 80" },
  { key: "HP / MP / SAN", value: "11 / 14 / 58" },
  { key: "侦查 / 图书馆 / 心理学", value: "65 / 70 / 60" },
];

const steps = [
  { label: "上传文件", state: "done" as const },
  { label: "核对映射", state: "current" as const },
  { label: "确认入库", state: "upcoming" as const },
];

function ImportCharacterSheetDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-160 gap-0 p-0" showCloseButton={false}>
        <DialogHeader className="border-separator flex-row items-center justify-between border-b px-5 py-[18px]">
          <div className="flex flex-col gap-0.5">
            <DialogTitle>导入人物卡 Excel</DialogTitle>
            <DialogDescription>按 CoC 7e 模板解析 · 确认无误后入库</DialogDescription>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)}>
            <X />
          </Button>
        </DialogHeader>

        <div className="border-separator flex items-center border-b px-5 py-3.5">
          {steps.map((step, index) => (
            <div key={step.label} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2 px-2.5">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full font-chip text-xs font-bold",
                    step.state === "upcoming" ? "bg-default text-foreground-tertiary" : "from-accent to-accent-hover bg-gradient-to-br text-accent-foreground",
                  )}
                >
                  {step.state === "done" ? <Check className="size-3" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "font-sans text-xs",
                    step.state === "current" ? "text-foreground font-semibold" : step.state === "done" ? "text-foreground" : "text-foreground-tertiary",
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <span className={cn("h-0.5 flex-1 rounded-full", step.state === "done" ? "bg-accent-hover" : "bg-separator-tertiary")} />
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          <div className="border-success-soft-foreground bg-success-soft flex items-center gap-3 rounded-xl border px-3 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-black/25">
              <FileSpreadsheet className="text-success-soft-foreground size-[18px]" />
            </span>
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-foreground font-sans text-[13px] font-semibold">远野澪_CoC7e.xlsx</span>
              <span className="text-success-soft-foreground font-sans text-[11px]">
                32 KB · 解析成功 · 匹配 CoC 7e 模板
              </span>
            </div>
            <Button variant="ghost" size="icon-sm">
              <RefreshCw />
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-foreground font-sans text-[13px] font-semibold">解析预览</span>
            <Badge variant="soft" tone="success" size="sm">
              9 项属性 · 24 项技能 已识别
            </Badge>
          </div>

          <div className="flex flex-col gap-1.5">
            {previewFields.map((field) => (
              <div key={field.key} className="bg-surface-tertiary flex items-center gap-3 rounded-lg px-3 py-2">
                <span className="text-foreground-secondary w-50 shrink-0 font-sans text-xs">{field.key}</span>
                <span className="text-foreground flex-1 font-mono text-xs font-semibold">{field.value}</span>
                <CircleCheck className="text-success-soft-foreground size-[15px] shrink-0" />
              </div>
            ))}
          </div>

          <div className="bg-warning-soft flex items-start gap-2.5 rounded-[10px] px-3 py-3">
            <TriangleAlert className="text-warning mt-0.5 size-[15px] shrink-0" />
            <span className="text-warning font-sans text-xs">
              「克苏鲁神话」技能列为自定义技能，将按原值导入
            </span>
          </div>
        </div>

        <div className="bg-background-secondary border-separator flex items-center justify-end gap-2.5 border-t px-5 py-4">
          <Button variant="tertiary" size="sm">
            <ArrowLeft className="size-4" />
            上一步
          </Button>
          <Button variant="primary" size="sm" onClick={() => onOpenChange(false)}>
            <Database className="size-4" />
            确认入库
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { ImportCharacterSheetDialog };
