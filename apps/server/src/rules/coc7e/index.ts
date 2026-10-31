import { type RuleId } from "@cogm/shared";
import { type RandomSource } from "@/platform/ports";
import {
  RuleSystem,
  type CharacterSheetPreview,
  type SkillCheckInput,
  type SanCheckInput,
  type StateMutationResult,
  type RuleCommandDefinition,
} from "@/rules/rule-system";
import { evaluateLossExpression } from "@/rules/dice-engine";
import { coc7e } from "@cogm/shared";
import { parseCoc7eCharacterSheet } from "./excel-parser";

export class Coc7eRuleSystem extends RuleSystem<coc7e.Coc7eCharacterSheet, coc7e.CharacterSessionState> {
  readonly id: RuleId = "coc7e";
  readonly characterSheetSchema = coc7e.Coc7eCharacterSheet;
  readonly sessionStateSchema = coc7e.CharacterSessionState;

  async parseCharacterSheet(input: ArrayBuffer): Promise<CharacterSheetPreview<coc7e.Coc7eCharacterSheet>> {
    return parseCoc7eCharacterSheet(input);
  }

  initializeSessionState(sheet: coc7e.Coc7eCharacterSheet): coc7e.CharacterSessionState {
    const con = sheet.attributes.con;
    const siz = sheet.attributes.siz;
    const pow = sheet.attributes.pow;
    const maxHp = Math.floor((con + siz) / 10);
    const maxMp = Math.floor(pow / 5);
    const maxSan = 99;

    return {
      schemaVersion: 1,
      sessionId: "",
      characterId: "",
      hp: maxHp,
      maxHp,
      mp: maxMp,
      maxMp,
      san: pow,
      maxSan,
      statuses: [],
      tags: [],
      growthMarks: [],
      hiddenGrowthMarks: [],
    };
  }

  evaluateSkillCheck(input: SkillCheckInput, random: RandomSource): coc7e.SkillCheckResult {
    const { characterId, skillKey, targetValue, difficulty, bonusDice, penaltyDice } = input;
    const unitsDigit = random.randomInt(0, 9);
    const netBonus = Math.max(0, bonusDice - penaltyDice);
    const netPenalty = Math.max(0, penaltyDice - bonusDice);
    const numTensDice = Math.max(netBonus, netPenalty) + 1;
    const tensCandidates: number[] = [];
    for (let i = 0; i < numTensDice; i++) {
      tensCandidates.push(random.randomInt(0, 9));
    }

    const rollValues = tensCandidates.map(tensDigit => {
      if (tensDigit === 0 && unitsDigit === 0) {
        return 100;
      }
      return tensDigit * 10 + unitsDigit;
    });

    let selectedValue = rollValues[0] ?? 100;
    if (netBonus > 0) {
      selectedValue = Math.min(...rollValues);
    } else if (netPenalty > 0) {
      selectedValue = Math.max(...rollValues);
    }

    let outcome: coc7e.CheckOutcome;
    const isFumble = targetValue >= 50 ? selectedValue === 100 : selectedValue >= 96;

    if (selectedValue === 1) {
      outcome = "critical";
    } else if (isFumble) {
      outcome = "fumble";
    } else if (selectedValue <= Math.floor(targetValue / 5)) {
      outcome = "extreme_success";
    } else if (selectedValue <= Math.floor(targetValue / 2)) {
      outcome = "hard_success";
    } else if (selectedValue <= targetValue) {
      outcome = "regular_success";
    } else {
      outcome = "failure";
    }

    // 判定是否达到 GM 指定的难度等级：常规需常规成功及以上，困难需困难成功及以上，极难需极难成功及以上
    let success: boolean;
    switch (outcome) {
      case "critical":
      case "extreme_success":
        success = true;
        break;
      case "hard_success":
        success = difficulty !== "extreme";
        break;
      case "regular_success":
        success = difficulty === "regular";
        break;
      default:
        success = false;
    }

    return {
      characterId,
      skillKey,
      targetValue,
      difficulty,
      bonusDice,
      penaltyDice,
      tensCandidates,
      roll: selectedValue,
      outcome,
      success,
      growthEligible:
        outcome === "critical" ||
        outcome === "extreme_success" ||
        outcome === "hard_success" ||
        outcome === "regular_success",
    };
  }

  evaluateSanCheck(input: SanCheckInput, random: RandomSource): coc7e.SanCheckResult {
    const { characterId, sanCurrent, successLoss, failureLoss } = input;
    const roll = random.randomInt(1, 100);
    const success = roll <= sanCurrent;
    const lossExpression = success ? successLoss : failureLoss;
    const loss = Math.max(0, evaluateLossExpression(lossExpression, random));
    const sanAfter = Math.max(0, sanCurrent - loss);

    return {
      characterId,
      sanBefore: sanCurrent,
      roll,
      success,
      lossExpression,
      loss,
      sanAfter,
    };
  }

  getSkillTargetValue(sheet: coc7e.Coc7eCharacterSheet, skillKey: string): number | null {
    const normalized = skillKey.trim();
    const skillValue = sheet.skills[normalized];
    if (skillValue !== undefined) {
      return skillValue;
    }
    const attributeValue = (sheet.attributes as Record<string, number>)[normalized];
    if (attributeValue !== undefined) {
      return attributeValue;
    }
    return null;
  }

  getSanCurrent(state: coc7e.CharacterSessionState): number {
    return state.san;
  }

  applyGmStateEdit(
    state: coc7e.CharacterSessionState,
    edit: Record<string, unknown>
  ): StateMutationResult<coc7e.CharacterSessionState> {
    const next: coc7e.CharacterSessionState = {
      ...state,
      statuses: [...state.statuses],
      tags: [...state.tags],
      growthMarks: [...state.growthMarks],
      hiddenGrowthMarks: [...state.hiddenGrowthMarks],
    };
    const hints: string[] = [];

    const readInt = (key: string): number | undefined => {
      const value = edit[key];
      return typeof value === "number" && Number.isInteger(value) ? value : undefined;
    };
    const readStringArray = (key: string): string[] => {
      const value = edit[key];
      return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
    };

    const maxHp = readInt("maxHp") ?? next.maxHp;
    const maxMp = readInt("maxMp") ?? next.maxMp;
    const maxSan = readInt("maxSan") ?? next.maxSan;
    next.maxHp = Math.max(1, maxHp);
    next.maxMp = Math.max(0, maxMp);
    next.maxSan = Math.max(0, maxSan);

    const hpDelta = readInt("hpDelta") ?? 0;
    const mpDelta = readInt("mpDelta") ?? 0;
    const sanDelta = readInt("sanDelta") ?? 0;

    const hpBefore = next.hp;
    const sanBefore = next.san;

    next.hp = this.clamp(readInt("hp") ?? next.hp + hpDelta, 0, next.maxHp);
    next.mp = this.clamp(readInt("mp") ?? next.mp + mpDelta, 0, next.maxMp);
    next.san = this.clamp(readInt("san") ?? next.san + sanDelta, 0, next.maxSan);

    const hpLoss = hpBefore - next.hp;
    if (hpLoss > 0 && hpLoss * 2 >= next.maxHp) {
      hints.push(`单次伤害 ${hpLoss} 达到 HP 上限一半，考虑标记「重伤」`);
    }
    if (next.hp === 0 && hpBefore > 0) {
      hints.push("HP 归零，考虑标记「濒死」或「死亡」");
    }
    const sanLoss = sanBefore - next.san;
    if (sanLoss >= 5) {
      hints.push(`单次 SAN 损失 ${sanLoss} ≥ 5，考虑标记「临时疯狂」`);
    }

    for (const status of readStringArray("addStatuses")) {
      const parsed = coc7e.CharacterStatusFlag.safeParse(status);
      if (parsed.success && !next.statuses.includes(parsed.data)) {
        next.statuses.push(parsed.data);
      }
    }
    const removeStatuses = new Set(readStringArray("removeStatuses"));
    if (removeStatuses.size > 0) {
      next.statuses = next.statuses.filter((s) => !removeStatuses.has(s));
    }

    for (const tag of readStringArray("addTags")) {
      if (tag.trim() !== "" && !next.tags.includes(tag)) {
        next.tags.push(tag);
      }
    }
    const removeTags = new Set(readStringArray("removeTags"));
    if (removeTags.size > 0) {
      next.tags = next.tags.filter((t) => !removeTags.has(t));
    }

    const validated = this.sessionStateSchema.parse(next);
    return { state: validated, hints };
  }

  applySanLoss(
    state: coc7e.CharacterSessionState,
    loss: number
  ): StateMutationResult<coc7e.CharacterSessionState> {
    const hints: string[] = [];
    const next: coc7e.CharacterSessionState = {
      ...state,
      san: Math.max(0, state.san - Math.max(0, loss)),
    };
    if (loss >= 5) {
      hints.push(`单次 SAN 损失 ${loss} ≥ 5，考虑标记「临时疯狂」`);
    }
    const validated = this.sessionStateSchema.parse(next);
    return { state: validated, hints };
  }

  markSkillGrowth(
    state: coc7e.CharacterSessionState,
    skillKey: string
  ): coc7e.CharacterSessionState {
    if (state.growthMarks.includes(skillKey)) {
      return state;
    }
    return this.sessionStateSchema.parse({
      ...state,
      growthMarks: [...state.growthMarks, skillKey],
    });
  }

  markSkillGrowthHidden(
    state: coc7e.CharacterSessionState,
    skillKey: string
  ): coc7e.CharacterSessionState {
    if (state.hiddenGrowthMarks.includes(skillKey)) {
      return state;
    }
    return this.sessionStateSchema.parse({
      ...state,
      hiddenGrowthMarks: [...state.hiddenGrowthMarks, skillKey],
    });
  }

  viewSessionState(
    state: coc7e.CharacterSessionState,
    viewer: { hidden: boolean }
  ): coc7e.CharacterSessionState {
    if (viewer.hidden) {
      return state;
    }
    return {
      ...state,
      hiddenGrowthMarks: [],
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  getChatCommands(): readonly RuleCommandDefinition[] {
    return [
      {
        name: ".ra",
        alias: ["ra"],
        description: "Skill check (e.g. .ra 侦查)",
      },
      {
        name: ".sc",
        alias: ["sc"],
        description: "Sanity check (e.g. .sc 1d3/1d6)",
      },
    ];
  }
}
