import { useEffect, useMemo, useState } from "react";
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
import { t } from "@/i18n";
import { parseCocSheet, parseCocState, skillKeysFor, skillValue } from "@/lib/coc-live";
import { sendSessionCommand } from "@/lib/session-socket";
import { useIdentityStore } from "@/stores/identity-store";
import { useBlockingDialog } from "@/stores/modal-store";
import { usePlayStore } from "@/stores/play-store";

export function CharacterSheetPanel({
  open,
  onOpenChange,
  initialCharacterId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCharacterId?: string | null;
}) {
  const playerId = useIdentityStore((state) => state.playerId);
  const isGm = usePlayStore((state) => state.viewer.isGm);
  const characters = usePlayStore((state) => state.characters);
  const claimed = characters.find((character) => character.claim?.playerId === playerId && character.claim.role === "pc");
  const options = characters.filter((character) => character.sheet != null);
  const [selectedId, setSelectedId] = useState(initialCharacterId ?? "");

  useEffect(() => {
    if (open && initialCharacterId) {
      setSelectedId(initialCharacterId);
    }
  }, [open, initialCharacterId]);

  const dialog = useBlockingDialog("sheet", open, onOpenChange);
  const target = options.find((character) => character.characterId === selectedId) ?? options[0];
  const sheet = parseCocSheet(target?.sheet);
  const state = parseCocState(target?.state);
  const canPerform = isGm || (claimed !== undefined && target?.characterId === claimed.characterId);
  const skillKeys = useMemo(
    () => skillKeysFor(target).filter((key) => !(key in (sheet?.attributes ?? {}))),
    [target, sheet],
  );

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
      toast.error(t("chat.notConnected"));
      return;
    }
    toast.success(t("check.submitted", { skill: coc7e.coc7eSkillLabel(skillKey) }));
  }

  return (
    <Dialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{target?.name ?? t("sheet.titleFallback")}</DialogTitle>
          <DialogDescription>
            {canPerform ? t("sheet.description") : t("sheet.descriptionTeammate")}
          </DialogDescription>
        </DialogHeader>
        {options.length > 1 ? (
          <Select value={target?.characterId ?? ""} onValueChange={setSelectedId}>
            <SelectTrigger className="h-8 text-label-medium"><SelectValue placeholder={t("sheet.selectCharacter")} /></SelectTrigger>
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
          <p className="text-foreground-tertiary text-body-medium">{t("sheet.empty")}</p>
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
                <Button key={key} type="button" variant="ghost" className="h-7 justify-between px-2 text-body-medium" disabled={!canPerform} onClick={() => perform(key)}>
                  <span>{coc7e.coc7eSkillLabel(key)}</span>
                  <span>{value}</span>
                </Button>
              ))}
            </div>
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {skillKeys.map((key) => {
                const value = skillValue(target, key);
                return (
                  <Button
                    key={key}
                    type="button"
                    variant="ghost"
                    className="h-7 justify-between px-2 text-body-medium"
                    disabled={!canPerform || value === null}
                    onClick={() => perform(key)}
                  >
                    <span>{coc7e.coc7eSkillLabel(key)}</span>
                    <span>{value ?? "—"}</span>
                  </Button>
                );
              })}
            </div>
            {state && state.growthMarks.length > 0 ? (
              <p className="text-foreground-tertiary text-label-small">
                {t("sheet.growthMarks", {
                  marks: state.growthMarks.map((key) => coc7e.coc7eSkillLabel(key)).join(t("common.listSeparator")),
                })}
              </p>
            ) : null}
            {state && state.statuses.length > 0 ? (
              <p className="text-warning text-label-small">
                {state.statuses.map((flag) => coc7e.CharacterStatusFlagLabel[flag]).join(t("common.listSeparator"))}
              </p>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
