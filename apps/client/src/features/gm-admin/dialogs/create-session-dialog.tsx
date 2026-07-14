import { Check, ChevronDown, Package, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const pcCandidates = [
  { id: "mio", name: "远野 澪", role: "侦探" },
  { id: "takuma", name: "白石 拓真", role: "记者" },
  { id: "tsubaki", name: "南 椿", role: "医生" },
  { id: "rui", name: "神谷 累", role: "学生" },
];

const statusOptions = ["等待开始", "准备中", "进行中"];

function CreateSessionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [selectedPcs, setSelectedPcs] = useState(new Set(["mio", "takuma", "tsubaki"]));
  const [status, setStatus] = useState(statusOptions[0]);

  function togglePc(id: string) {
    setSelectedPcs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-140 gap-0 p-0" showCloseButton={false}>
        <DialogHeader className="border-separator flex-row items-center justify-between border-b px-5 py-[18px]">
          <div className="flex flex-col gap-0.5">
            <DialogTitle>新建团</DialogTitle>
            <DialogDescription>每个团对应一个模组，创建时指定参与的 PC</DialogDescription>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)}>
            <X />
          </Button>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-5 py-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-foreground font-sans text-[13px] font-semibold">团名称</span>
            <div className="border-separator-secondary bg-field flex h-10 items-center rounded-[10px] border px-3.5">
              <input
                defaultValue="沉没的记忆 · 第三夜"
                className="text-field-foreground w-full bg-transparent font-sans text-sm outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-foreground font-sans text-[13px] font-semibold">选择模组</span>
            <button
              type="button"
              className="border-separator-secondary bg-field flex h-10 items-center gap-2.5 rounded-[10px] border px-3.5"
            >
              <Package className="text-accent-hover size-[15px]" />
              <span className="text-field-foreground flex-1 text-left font-sans text-sm">沉没的记忆</span>
              <ChevronDown className="text-foreground-tertiary size-4" />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-foreground font-sans text-[13px] font-semibold">指定参与 PC</span>
            <div className="flex flex-col gap-1.5">
              {pcCandidates.map((pc) => {
                const selected = selectedPcs.has(pc.id);
                return (
                  <button
                    key={pc.id}
                    type="button"
                    onClick={() => togglePc(pc.id)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-left",
                      selected ? "bg-accent-soft border-accent-hover" : "bg-surface-tertiary border-transparent",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-[18px] shrink-0 items-center justify-center rounded-md",
                        selected ? "bg-accent" : "border-separator-tertiary border-[1.5px]",
                      )}
                    >
                      {selected && <Check className="text-accent-foreground size-3" />}
                    </span>
                    <span className="text-foreground font-sans text-[13px] font-semibold">{pc.name}</span>
                    <span className="text-foreground-tertiary flex-1 font-sans text-xs">{pc.role}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 font-chip text-[11px] font-medium",
                        selected ? "bg-accent-soft text-accent-soft-foreground" : "bg-default text-foreground",
                      )}
                    >
                      {selected ? "已选" : "未选"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-foreground font-sans text-[13px] font-semibold">初始状态</span>
            <div className="bg-default flex h-[38px] items-center gap-0.5 rounded-[10px] p-[3px]">
              {statusOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStatus(option)}
                  className={cn(
                    "flex h-full flex-1 items-center justify-center rounded-lg font-sans text-[13px]",
                    option === status ? "bg-segment text-foreground font-semibold" : "text-foreground-secondary",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="bg-background-secondary border-separator flex-row items-center justify-between border-t px-5 py-4 sm:justify-between">
          <span className="text-foreground-tertiary font-sans text-[11px]">创建后可在团管理中继续调整</span>
          <div className="flex items-center gap-2.5">
            <Button variant="tertiary" size="sm" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button variant="primary" size="sm" onClick={() => onOpenChange(false)}>
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
