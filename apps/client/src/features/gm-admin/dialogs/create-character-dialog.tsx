import { useState } from "react";
import { toast } from "sonner";
import { coc7e } from "@cogm/shared";
import { Button } from "@/components/ui/button";
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
import { SegmentedControl } from "@/components/shared/segmented-control";
import { api, isApiError } from "@/lib/api";

const DEFAULT_SHEET: coc7e.Coc7eCharacterSheet = {
  schemaVersion: 1,
  attributes: { str: 50, con: 50, siz: 50, dex: 50, app: 50, int: 50, pow: 50, edu: 50, luck: 50 },
  skills: {},
};

export function CreateCharacterDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"pc" | "npc">("pc");
  const [pending, setPending] = useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("请填写姓名");
      return;
    }
    setPending(true);
    try {
      await api("/gm/characters", {
        method: "POST",
        body: JSON.stringify({
          name: trimmed,
          kind,
          ruleId: "coc7e",
          sheetData: DEFAULT_SHEET,
        }),
      });
      onOpenChange(false);
      setName("");
      onCreated?.();
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "创建人物失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建人物</DialogTitle>
          <DialogDescription>先建立空白 CoC 卡，再用 Excel 导入覆盖数值，或稍后补立绘。</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="character-name">姓名</Label>
            <Input id="character-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <SegmentedControl
            value={kind}
            options={[
              { value: "pc", label: "PC" },
              { value: "npc", label: "NPC" },
            ]}
            onValueChange={(value) => setKind(value as "pc" | "npc")}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="tertiary" onClick={() => onOpenChange(false)}>取消</Button>
          <Button type="button" variant="primaryGradient" disabled={pending} onClick={() => void submit()}>
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
