import { expect, test, describe } from "bun:test";
import { Coc7eRuleSystem } from "@/rules/coc7e";
import type { RandomSource } from "@/platform/ports";
import type { coc7e } from "@cogm/shared";

/** 确定性随机源：按队列吐出 0-9 的骰位值（或 1-100 的 SAN 骰值） */
class FakeRandomSource implements RandomSource {
  private queue: number[];
  constructor(values: number[]) {
    this.queue = [...values];
  }
  random(): number {
    return 0.5;
  }
  randomInt(min: number, max: number): number {
    if (this.queue.length === 0) {
      throw new Error("FakeRandomSource exhausted");
    }
    return this.queue.shift()!;
  }
}

const rule = new Coc7eRuleSystem();

const baseSheet: coc7e.Coc7eCharacterSheet = {
  schemaVersion: 1,
  attributes: { str: 50, con: 60, siz: 70, dex: 50, app: 50, int: 60, pow: 60, edu: 50, luck: 50 },
  skills: { 侦查: 60, 图书馆: 45 },
};

const baseState: coc7e.CharacterSessionState = {
  schemaVersion: 1,
  sessionId: "s1",
  characterId: "c1",
  hp: 13,
  maxHp: 13,
  mp: 12,
  maxMp: 12,
  san: 60,
  maxSan: 99,
  statuses: [],
  tags: [],
  growthMarks: [],
  hiddenGrowthMarks: [],
};

function check(roll: { tens: number[]; units: number }, opts?: Partial<Parameters<Coc7eRuleSystem["evaluateSkillCheck"]>[0]>) {
  const random = new FakeRandomSource([roll.units, ...roll.tens]);
  return rule.evaluateSkillCheck(
    {
      characterId: "c1",
      skillKey: "侦查",
      targetValue: 60,
      difficulty: "regular",
      bonusDice: 0,
      penaltyDice: 0,
      ...opts,
    },
    random
  ) as coc7e.SkillCheckResult;
}

describe("CoC 7e evaluateSkillCheck 判级边界", () => {
  test("掷出 1 = 大成功", () => {
    const result = check({ tens: [0], units: 1 });
    expect(result.roll).toBe(1);
    expect(result.outcome).toBe("critical");
    expect(result.success).toBe(true);
  });

  test("极难成功边界：roll == floor(目标/5)", () => {
    // 目标 60：/5 = 12
    expect(check({ tens: [1], units: 2 }).outcome).toBe("extreme_success");
    expect(check({ tens: [1], units: 3 }).outcome).toBe("hard_success");
  });

  test("困难成功边界：roll == floor(目标/2)", () => {
    expect(check({ tens: [3], units: 0 }).outcome).toBe("hard_success");
    expect(check({ tens: [3], units: 1 }).outcome).toBe("regular_success");
  });

  test("常规成功边界：roll == 目标值", () => {
    expect(check({ tens: [6], units: 0 }).outcome).toBe("regular_success");
    expect(check({ tens: [6], units: 1 }).outcome).toBe("failure");
  });

  test("目标值 >= 50 时 100 为大失败", () => {
    expect(check({ tens: [0], units: 0 }).outcome).toBe("fumble");
  });

  test("目标值 < 50 时 96-100 为大失败", () => {
    const lowTarget = { targetValue: 40 };
    expect(check({ tens: [9], units: 6 }, lowTarget).outcome).toBe("fumble");
    expect(check({ tens: [9], units: 5 }, lowTarget).outcome).toBe("failure");
  });

  test("奖励骰取较小值", () => {
    // 1 奖励骰：两个十位 3 和 5，个位 4 → min(34, 54) = 34；目标 60 为常规成功
    const result = check({ tens: [3, 5], units: 4 }, { bonusDice: 1 });
    expect(result.roll).toBe(34);
    expect(result.outcome).toBe("regular_success");
  });

  test("惩罚骰取较大值", () => {
    // 1 惩罚骰：两个十位 3 和 5，个位 4 → max(34, 54) = 54
    const result = check({ tens: [3, 5], units: 4 }, { penaltyDice: 1 });
    expect(result.roll).toBe(54);
    expect(result.outcome).toBe("regular_success");
  });

  test("难度等级影响判定，成长仍按常规成功及以上", () => {
    // roll 34，目标 60：掷出常规成功等级；hard 难度下未达到 = 失败
    const hard = check({ tens: [3], units: 4 }, { difficulty: "hard" });
    expect(hard.outcome).toBe("regular_success");
    expect(hard.success).toBe(false);
    expect(hard.growthEligible).toBe(true);
    const regular = check({ tens: [3], units: 4 }, { difficulty: "regular" });
    expect(regular.outcome).toBe("regular_success");
    expect(regular.success).toBe(true);
    expect(regular.growthEligible).toBe(true);
    const extreme = check({ tens: [1], units: 2 }, { difficulty: "extreme" });
    expect(extreme.outcome).toBe("extreme_success");
    expect(extreme.success).toBe(true);
    const hardLevel = check({ tens: [3], units: 0 }, { difficulty: "extreme" });
    expect(hardLevel.outcome).toBe("hard_success");
    expect(hardLevel.success).toBe(false);
    expect(hardLevel.growthEligible).toBe(true);
    const fail = check({ tens: [9], units: 0 });
    expect(fail.growthEligible).toBe(false);
  });

  test("奖励骰与惩罚骰互相抵消", () => {
    const cancelled = check({ tens: [3], units: 4 }, { bonusDice: 1, penaltyDice: 1 });
    expect(cancelled.tensCandidates).toHaveLength(1);
    expect(cancelled.roll).toBe(34);
    const netPenalty = check({ tens: [3, 5], units: 4 }, { bonusDice: 1, penaltyDice: 2 });
    expect(netPenalty.tensCandidates).toHaveLength(2);
    expect(netPenalty.roll).toBe(54);
  });
});

describe("CoC 7e evaluateSanCheck", () => {
  test("成功按成功表达式扣减", () => {
    // roll 30 <= 60 成功，成功损失 "1d3" 掷出 2
    const random = new FakeRandomSource([30, 2]);
    const result = rule.evaluateSanCheck(
      { characterId: "c1", sanCurrent: 60, successLoss: "1d3", failureLoss: "1d6" },
      random
    ) as coc7e.SanCheckResult;
    expect(result.success).toBe(true);
    expect(result.lossExpression).toBe("1d3");
    expect(result.loss).toBe(2);
    expect(result.sanAfter).toBe(58);
  });

  test("失败按失败表达式扣减，SAN 不为负", () => {
    // roll 80 > 60 失败，失败损失 "1d6" 掷出 6
    const random = new FakeRandomSource([80, 6]);
    const result = rule.evaluateSanCheck(
      { characterId: "c1", sanCurrent: 4, successLoss: "0", failureLoss: "1d6" },
      random
    ) as coc7e.SanCheckResult;
    expect(result.success).toBe(false);
    expect(result.loss).toBe(6);
    expect(result.sanAfter).toBe(0);
  });
});

describe("CoC 7e 状态变更", () => {
  test("初始化：HP=(con+siz)/10, MP=pow/5, SAN=pow", () => {
    const state = rule.initializeSessionState(baseSheet);
    expect(state.maxHp).toBe(13);
    expect(state.hp).toBe(13);
    expect(state.maxMp).toBe(12);
    expect(state.san).toBe(60);
  });

  test("GM 编辑钳制与阈值提示", () => {
    const edited = rule.applyGmStateEdit(baseState, { hpDelta: -7 });
    expect(edited.state.hp).toBe(6);
    // 单次伤害 7 >= 13/2 → 重伤提示
    expect(edited.hints.some((h) => h.includes("重伤"))).toBe(true);
  });

  test("HP 归零提示濒死/死亡", () => {
    const edited = rule.applyGmStateEdit(baseState, { hpDelta: -13 });
    expect(edited.state.hp).toBe(0);
    expect(edited.hints.some((h) => h.includes("濒死"))).toBe(true);
  });

  test("单次 SAN 损失 >= 5 提示临时疯狂", () => {
    const edited = rule.applyGmStateEdit(baseState, { sanDelta: -5 });
    expect(edited.state.san).toBe(55);
    expect(edited.hints.some((h) => h.includes("临时疯狂"))).toBe(true);
  });

  test("状态标记与自定义标签增删", () => {
    const edited = rule.applyGmStateEdit(baseState, {
      addStatuses: ["major_wound", "dead"],
      addTags: ["中毒"],
    });
    expect(edited.state.statuses).toContain("major_wound");
    expect(edited.state.statuses).toContain("dead");
    expect(edited.state.tags).toContain("中毒");

    const removed = rule.applyGmStateEdit(edited.state, {
      removeStatuses: ["dead"],
      removeTags: ["中毒"],
    });
    expect(removed.state.statuses).not.toContain("dead");
    expect(removed.state.tags).not.toContain("中毒");
  });

  test("成长标记去重", () => {
    const once = rule.markSkillGrowth(baseState, "侦查");
    expect(once.growthMarks).toEqual(["侦查"]);
    const twice = rule.markSkillGrowth(once, "侦查");
    expect(twice.growthMarks).toEqual(["侦查"]);
  });

  test("技能目标值查找", () => {
    expect(rule.getSkillTargetValue(baseSheet, "侦查")).toBe(60);
    expect(rule.getSkillTargetValue(baseSheet, "pow")).toBe(60);
    expect(rule.getSkillTargetValue(baseSheet, "不存在的技能")).toBeNull();
  });

  test("Excel 解析覆盖完整技能目录与派生技能", async () => {
    const xlsx = await import("xlsx");
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet([
      ["姓名", "李四"],
      ["力量", 50],
      ["体质", 60],
      ["体型", 55],
      ["敏捷", 70],
      ["外貌", 45],
      ["智力", 80],
      ["意志", 65],
      ["教育", 75],
      ["幸运", 40],
      ["侦查", 80],
      ["聆听", 45],
      ["克苏鲁神话", 5],
      ["格斗：斗殴", 55],
    ]);
    xlsx.utils.book_append_sheet(workbook, sheet, "Sheet1");
    const buffer = xlsx.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const preview = await rule.parseCharacterSheet(buffer);
    expect(preview.errors).toEqual([]);
    expect(preview.characterName).toBe("李四");
    expect(preview.sheetData.skills["侦查"]).toBe(80);
    expect(preview.sheetData.skills["聆听"]).toBe(45);
    expect(preview.sheetData.skills["克苏鲁神话"]).toBe(5);
    expect(preview.sheetData.skills["格斗"]).toBe(55);
    expect(preview.sheetData.skills["闪避"]).toBe(35);
    expect(preview.sheetData.skills["母语"]).toBe(75);
    expect(preview.sheetData.skills["会计"]).toBe(5);
  });

  test("缺属性会记入错误而不是静默当成功", async () => {
    const xlsx = await import("xlsx");
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet([
      ["姓名", "王五"],
      ["体质", 50],
      ["体型", 50],
      ["意志", 50],
    ]);
    xlsx.utils.book_append_sheet(workbook, sheet, "Sheet1");
    const buffer = xlsx.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const preview = await rule.parseCharacterSheet(buffer);
    expect(preview.errors.some((error) => error.cell === "LUCK")).toBe(true);
    expect(preview.errors.some((error) => error.cell === "STR")).toBe(true);
    expect(preview.sheetData.attributes.luck).toBe(50);
  });
});

describe("CoC 7e getSkillTargetValue", () => {
  function emptySheet(): coc7e.Coc7eCharacterSheet {
    return { schemaVersion: 1, attributes: baseSheet.attributes, skills: {} };
  }

  test("卡上无技能时回退技能目录基础值", () => {
    expect(rule.getSkillTargetValue(emptySheet(), "侦查")).toBe(25);
    expect(rule.getSkillTargetValue(emptySheet(), "聆听")).toBe(20);
    expect(rule.getSkillTargetValue(emptySheet(), "母语")).toBe(50);
  });

  test("属性目标值仍从卡读取，目录外的技能返回 null", () => {
    expect(rule.getSkillTargetValue(emptySheet(), "str")).toBe(50);
    expect(rule.getSkillTargetValue(emptySheet(), "非目录技能")).toBe(null);
  });

  test("人物卡已有技能值优先于目录基础值", () => {
    expect(rule.getSkillTargetValue(baseSheet, "侦查")).toBe(60);
    expect(rule.getSkillTargetValue(baseSheet, "聆听")).toBe(20);
  });
});
