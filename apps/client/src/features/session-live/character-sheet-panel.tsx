import { useMemo, useState } from "react";
import { toast } from "sonner";
import { coc7e } from "@cogm/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ATTR_LABELS } from "@/lib/format";
import { parseCocSheet, parseCocState } from "@/lib/coc-live";
import { sendSessionCommand } from "@/lib/session-socket";
import { useIdentityStore } from "@/stores/identity-store";
import { usePlayStore } from "@/stores/play-store";

export function CharacterSheetPanel({
  open,
  onOpenChange,
  browseAll = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  browseAll?: boolean;
}) {
  const playerId = useIdentityStore((state) => state.playerId);
  const characters = usePlayStore((state) => state.characters);
  const claimed = characters.find((character) => character.claim?.playerId === playerId && character.claim.role === "pc");
  const options = browseAll ? characters : claimed ? [claimed] : [];
  const [selectedId, setSelectedId] = useState("");
  const target = options.find((character) => character.characterId === selectedId) ?? options[0];
  const sheet = parseCocSheet(target?.sheet);
  const state = parseCocState(target?.state);
  const skills = useMemo(() => Object.entries(sheet?.skills ?? {}), [sheet]);

  function perform(skillKey: string) {
    if (!target?.characterId) {
      return;
    }
    const sent = sendSessionCommand("check:perform", {
      characterId: target.characterId,
      skillKey,
      difficulty: "regular",
      bonusDice: 0,
      penaltyDice: 0,
    });
    if (!sent) {
      toast.error("尚未连接到团");
      return;
    }
    toast.success(`已提交「${ATTR_LABELS[skillKey]?.label ?? skillKey}」鉴定`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{target?.name ?? "人物卡"}</DialogTitle>
          <DialogDescription>点击技能或属性即可发起鉴定；目标值由服务端从人物卡读取。</DialogDescription>
        </DialogHeader>
        {browseAll && options.length > 1 ? (
          <Select value={target?.characterId ?? ""} onValueChange={setSelectedId}>
            <SelectTrigger className="h-8 text-label-medium"><SelectValue placeholder="选择人物" /></SelectTrigger>
            <SelectContent>
              {options.map((character) => (
                <SelectItem key={character.characterId} value={character.characterId}>
                  {character.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {!target || !sheet ? (
          <p className="text-foreground-tertiary text-body-medium">未认领 PC，或人物卡尚未同步。</p>
        ) : (
          <div className="flex flex-col gap-3">
            {state ? (
              <div className="grid grid-cols-3 gap-2 text-center text-label-medium">
                <div className="bg-md-error-container text-md-on-error-container rounded-lg py-1.5">HP {state.hp}/{state.maxHp}</div>
                <div className="bg-md-secondary-container text-md-on-secondary-container rounded-lg py-1.5">MP {state.mp}/{state.maxMp}</div>
                <div className="bg-md-tertiary-container text-md-on-tertiary-container rounded-lg py-1.5">SAN {state.san}/{state.maxSan}</div>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              {Object.entries(sheet.attributes).map(([key, value]) => (
                <Button key={key} type="button" variant="ghost" className="h-7 justify-between px-2 text-body-medium" onClick={() => perform(key)}>
                  <span>{ATTR_LABELS[key]?.label ?? key}</span>
                  <span>{value}</span>
                </Button>
              ))}
            </div>
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {skills.map(([key, value]) => (
                <Button key={key} type="button" variant="ghost" className="h-7 justify-between px-2 text-body-medium" onClick={() => perform(key)}>
                  <span>{key}</span>
                  <span>{value}</span>
                </Button>
              ))}
            </div>
            {state && state.growthMarks.length > 0 ? (
              <p className="text-foreground-tertiary text-label-small">成长标记：{state.growthMarks.join("、")}</p>
            ) : null}
            {state && state.statuses.length > 0 ? (
              <p className="text-warning text-label-small">
                {state.statuses.map((flag) => coc7e.CharacterStatusFlagLabel[flag]).join("、")}
              </p>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
