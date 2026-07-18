import { Check, Package, X } from "lucide-react";
import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const pcCandidates = [
  { id: "mio", name: "远野 澪", role: "侦探" },
  { id: "takuma", name: "白石 拓真", role: "记者" },
  { id: "tsubaki", name: "南 椿", role: "医生" },
  { id: "rui", name: "神谷 累", role: "学生" },
];

const statusOptions = ["等待开始", "准备中", "进行中"] as const;
const statusSegments = statusOptions.map((option) => ({ value: option, label: option }));

function CreateSessionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [selectedPcs, setSelectedPcs] = useState(new Set(["mio", "takuma", "tsubaki"]));
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("等待开始");

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
          <Button variant="ghost" size="icon-sm" aria-label="关闭新建团弹窗" onClick={() => onOpenChange(false)}>
            <X />
          </Button>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-5 py-5">
          <FormField label="团名称" htmlFor="session-name">
            <Input id="session-name" defaultValue="沉没的记忆 · 第三夜" className="border-separator-secondary" />
          </FormField>

          <FormField label="选择模组">
            <Select defaultValue="sunk-memory">
              <SelectTrigger className="h-10 border-separator-secondary">
                <Package className="text-accent-hover" />
                <SelectValue placeholder="选择模组" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sunk-memory">沉没的记忆</SelectItem>
                <SelectItem value="abandoned-mine">无人矿坑</SelectItem>
                <SelectItem value="color-out-of-space">星之彩</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="指定参与 PC">
            <div className="flex flex-col gap-1.5">
              {pcCandidates.map((pc) => {
                const selected = selectedPcs.has(pc.id);
                return (
                  <Label
                    key={pc.id}
                    className={cn(
                      "cursor-pointer items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-left",
                      selected ? "bg-accent-soft border-accent-hover" : "bg-surface-tertiary border-transparent",
                    )}
                  >
                    <Checkbox checked={selected} onCheckedChange={() => togglePc(pc.id)} />
                    <span className="text-foreground font-sans text-[13px] font-semibold">{pc.name}</span>
                    <span className="text-foreground-tertiary flex-1 font-sans text-xs">{pc.role}</span>
                    <Badge variant="soft" tone={selected ? "accent" : "default"} size="sm">
                      {selected ? "已选" : "未选"}
                    </Badge>
                  </Label>
                );
              })}
            </div>
          </FormField>

          <FormField label="初始状态">
            <SegmentedControl
              value={status}
              options={statusSegments}
              onValueChange={setStatus}
              className="h-[38px] rounded-[10px] p-[3px]"
              itemClassName="h-full text-[13px]"
            />
          </FormField>
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
