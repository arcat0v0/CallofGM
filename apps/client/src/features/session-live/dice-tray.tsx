import { Dices } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { coc7e } from "@cogm/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { attrLabel } from "@/lib/format";
import { t } from "@/i18n";
import { skillKeysFor, skillValue } from "@/lib/coc-live";
import { sendSessionCommand } from "@/lib/session-socket";
import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";

const DICE_PRESETS = ["1d100", "1d6", "1d4", "1d8", "1d10", "3d6"];

function DiceTray({
  characterId,
  className,
  gm = false,
  disabled = false,
}: {
  characterId?: string | null;
  className?: string;
  gm?: boolean;
  disabled?: boolean;
}) {
  const characters = usePlayStore((state) => state.characters);
  const [selectedId, setSelectedId] = useState(characterId ?? "");
  const resolvedId = gm ? selectedId || characterId || characters[0]?.characterId : characterId;
  const character = characters.find((item) => item.characterId === resolvedId);
  const skills = useMemo(() => skillKeysFor(character), [character]);
  const [expression, setExpression] = useState("1d100");
  const [comment, setComment] = useState("");
  const [skillKey, setSkillKey] = useState(skills[0] ?? "侦查");
  const [difficulty, setDifficulty] = useState<"regular" | "hard" | "extreme">("regular");
  const [bonusDice, setBonusDice] = useState(0);
  const [penaltyDice, setPenaltyDice] = useState(0);
  const [hidden, setHidden] = useState(false);
  const value = skillValue(character, skillKey);

  function roll() {
    const sent = sendSessionCommand("dice:roll", {
      expression,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
      ...(gm && hidden ? { hidden: true } : {}),
    });
    if (!sent) toast.error(t("chat.notConnected"));
  }

  function check() {
    if (!resolvedId) {
      toast.error(t("dice.noCharacter"));
      return;
    }
    const sent = sendSessionCommand("check:perform", {
      characterId: resolvedId,
      skillKey,
      difficulty,
      bonusDice,
      penaltyDice,
      ...(gm && hidden ? { hidden: true } : {}),
    });
    if (!sent) toast.error(t("chat.notConnected"));
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {gm ? (
        <Select value={resolvedId ?? ""} onValueChange={setSelectedId}>
          <SelectTrigger className="h-8 text-label-medium">
            <SelectValue placeholder={t("dice.target")} />
          </SelectTrigger>
          <SelectContent>
            {characters.map((item) => (
              <SelectItem key={item.characterId} value={item.characterId}>
                {item.name} · {item.kind === "npc" ? "NPC" : "PC"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <div className="bg-md-surface-container-high flex rounded-full p-0.5">
        {DICE_PRESETS.map((preset) => {
          const active = expression === preset;
          return (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => setExpression(preset)}
              className={cn(
                "h-6 flex-1 rounded-full px-2 transition-all duration-350 ease-expressive-fast-spatial disabled:opacity-50",
                active
                  ? "bg-md-secondary-container text-md-on-secondary-container text-label-small-emph"
                  : "text-label-small text-md-on-surface-variant hover:bg-md-surface-container-highest",
              )}
            >
              {preset}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5">
        <Input value={expression} onChange={(event) => setExpression(event.target.value)} aria-label={t("dice.expression")} disabled={disabled} className="h-8 flex-1 text-label-medium" />
        <Input value={comment} onChange={(event) => setComment(event.target.value)} placeholder={t("dice.comment")} aria-label={t("dice.comment")} disabled={disabled} className="h-8 flex-1 text-label-medium" />
        <Button type="button" size="sm" variant="tertiary" className="h-8 px-2.5" disabled={disabled} onClick={roll}>
          <Dices className="size-3.5" />
          {t("dice.roll")}
        </Button>
      </div>
      <div className="flex items-center gap-1.5">
        <Select value={skillKey} onValueChange={setSkillKey} disabled={disabled}>
          <SelectTrigger className="h-8 flex-1 text-label-medium">
            <SelectValue placeholder={t("dice.skill")} />
          </SelectTrigger>
          <SelectContent>
            {skills.map((skill) => (
              <SelectItem key={skill} value={skill}>
                {attrLabel(skill)}
                {skillValue(character, skill) !== null ? ` ${skillValue(character, skill)}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={difficulty} onValueChange={(next) => setDifficulty(next as typeof difficulty)} disabled={disabled}>
          <SelectTrigger className="h-8 w-[88px] text-label-medium"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(["regular", "hard", "extreme"] as const).map((item) => (
              <SelectItem key={item} value={item}>{coc7e.CheckDifficultyLabel[item]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" variant="tertiary" className="h-8 px-2.5" onClick={check} disabled={disabled || !resolvedId}>
          {value !== null ? t("dice.checkWithValue", { value }) : t("dice.check")}
        </Button>
      </div>
      <div className="flex items-center gap-1.5">
        <Button type="button" size="sm" variant={bonusDice ? "accentSoft" : "tertiary"} className="h-6 px-2 text-label-small" disabled={disabled} onClick={() => setBonusDice((n) => (n + 1) % 3)}>
          {t("dice.bonus", { count: bonusDice })}
        </Button>
        <Button type="button" size="sm" variant={penaltyDice ? "dangerSoft" : "tertiary"} className="h-6 px-2 text-label-small" disabled={disabled} onClick={() => setPenaltyDice((n) => (n + 1) % 3)}>
          {t("dice.penalty", { count: penaltyDice })}
        </Button>
        {gm ? (
          <Button type="button" size="sm" variant={hidden ? "dangerSoft" : "tertiary"} className="h-6 px-2.5 text-label-small" disabled={disabled} onClick={() => setHidden((value) => !value)}>
            {hidden ? t("dice.hidden") : t("dice.public")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export { DiceTray };
