import { describe, expect, test } from "bun:test";
import { coc7e } from "@cogm/shared";
import type { WorkSheet } from "xlsx";
import { AppError } from "@/platform/errors/app-error";
import type { RandomSource } from "@/platform/ports";
import { Coc7eRuleSystem } from "@/rules/coc7e";

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

const baseSheet: coc7e.Coc7eCharacterSheet = coc7e.normalizeCoc7eSheet({
	attributes: {
		str: 50,
		con: 60,
		siz: 70,
		dex: 50,
		app: 50,
		int: 60,
		pow: 60,
		edu: 50,
		luck: 50,
	},
	skills: { 侦查: 60, 图书馆: 45 },
});

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

function check(
	roll: { tens: number[]; units: number },
	opts?: Partial<Parameters<Coc7eRuleSystem["evaluateSkillCheck"]>[0]>,
) {
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
		random,
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
		const cancelled = check(
			{ tens: [3], units: 4 },
			{ bonusDice: 1, penaltyDice: 1 },
		);
		expect(cancelled.tensCandidates).toHaveLength(1);
		expect(cancelled.roll).toBe(34);
		const netPenalty = check(
			{ tens: [3, 5], units: 4 },
			{ bonusDice: 1, penaltyDice: 2 },
		);
		expect(netPenalty.tensCandidates).toHaveLength(2);
		expect(netPenalty.roll).toBe(54);
	});
});

describe("CoC 7e evaluateSanCheck", () => {
	test("成功按成功表达式扣减", () => {
		// roll 30 <= 60 成功，成功损失 "1d3" 掷出 2
		const random = new FakeRandomSource([30, 2]);
		const result = rule.evaluateSanCheck(
			{
				characterId: "c1",
				sanCurrent: 60,
				successLoss: "1d3",
				failureLoss: "1d6",
			},
			random,
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
			{
				characterId: "c1",
				sanCurrent: 4,
				successLoss: "0",
				failureLoss: "1d6",
			},
			random,
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

	test("超出 0–99 的上限写入被稳定拒绝", () => {
		for (const edit of [{ maxHp: 999 }, { maxMp: 999 }, { maxSan: 999 }]) {
			let caught: unknown;
			try {
				rule.applyGmStateEdit(baseState, edit);
			} catch (error) {
				caught = error;
			}
			expect(caught).toBeInstanceOf(AppError);
			expect((caught as AppError).code).toBe("STATE_EDIT_OUT_OF_RANGE");
			expect((caught as AppError).statusCode).toBe(400);
		}
	});

	test("上限 99 被接受，当前值钳制到上限之内", () => {
		const accepted = rule.applyGmStateEdit(baseState, {
			maxHp: 99,
			maxMp: 99,
			maxSan: 99,
		});
		expect(accepted.state.maxHp).toBe(99);
		expect(accepted.state.maxMp).toBe(99);
		expect(accepted.state.maxSan).toBe(99);

		const clamped = rule.applyGmStateEdit(baseState, { maxSan: 40, san: 999 });
		expect(clamped.state.maxSan).toBe(40);
		expect(clamped.state.san).toBe(40);

		const legacy = rule.applyGmStateEdit(
			{ ...baseState, hp: 150, maxHp: 150, san: 120, maxSan: 120 },
			{},
		);
		expect(legacy.state.maxHp).toBe(99);
		expect(legacy.state.hp).toBe(99);
		expect(legacy.state.maxSan).toBe(99);
		expect(legacy.state.san).toBe(99);
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
		const buffer = xlsx.write(workbook, {
			type: "array",
			bookType: "xlsx",
		}) as ArrayBuffer;
		const preview = await rule.parseCharacterSheet(buffer);
		expect(preview.errors).toEqual([]);
		expect(preview.characterName).toBe("李四");
		expect(preview.sheetData.skills["侦查"]).toBe(80);
		expect(preview.sheetData.skills["聆听"]).toBe(45);
		expect(preview.sheetData.skills["克苏鲁神话"]).toBe(5);
		expect(preview.sheetData.skills["格斗(斗殴)"]).toBe(55);
		expect(preview.sheetData.skills["闪避"]).toBe(35);
		expect(preview.sheetData.skills["母语"]).toBe(75);
		expect(preview.sheetData.skills["会计"]).toBe(5);
	});

	test("缺关键属性记入错误，外貌/幸运等非关键属性静默补 50", async () => {
		const xlsx = await import("xlsx");
		const workbook = xlsx.utils.book_new();
		const sheet = xlsx.utils.aoa_to_sheet([
			["姓名", "王五"],
			["体质", 50],
			["体型", 50],
			["意志", 50],
		]);
		xlsx.utils.book_append_sheet(workbook, sheet, "Sheet1");
		const buffer = xlsx.write(workbook, {
			type: "array",
			bookType: "xlsx",
		}) as ArrayBuffer;
		const preview = await rule.parseCharacterSheet(buffer);
		expect(preview.errors.some((error) => error.cell === "LUCK")).toBe(false);
		expect(preview.errors.some((error) => error.cell === "STR")).toBe(true);
		expect(preview.errors.some((error) => error.cell === "DEX")).toBe(true);
		expect(preview.sheetData.attributes.luck).toBe(50);
		expect(preview.sheetData.attributes.app).toBe(50);
	});

	test("读取人物卡/简化卡模板的固定坐标、专攻与明确字段", async () => {
		const xlsx = await import("xlsx");
		const workbook = xlsx.utils.book_new();
		const cells: Record<string, { t: string; v: string | number }> = {};
		const put = (address: string, value: string | number) => {
			cells[address] = { t: typeof value === "number" ? "n" : "s", v: value };
		};
		put("E3", "七海莲");
		put("E4", 42);
		put("E5", "黑客");
		put("M4", "现代");
		put("U3", 55);
		put("U5", 60);
		put("U7", 70);
		put("AA3", 65);
		put("AA5", 50);
		put("AA7", 70);
		put("AG3", 60);
		put("AG5", 75);
		put("AG7", 45);
		put("F20", "技艺①");
		put("H20", "小提琴");
		put("J20", 5);
		put("L20", 10);
		put("R20", 15);
		put("AB35", "侦查");
		put("AF35", 25);
		put("AJ35", 33);
		put("AN35", 58);
		put("B54", "蝴蝶刀");
		put("M54", "斗殴");
		put("W54", "1D4+DB");
		put("AA54", "接触");
		put("AC54", "×");
		put("AE54", "1");
		put("AG54", "——");
		put("AJ54", "——");
		put("S62", "$");
		put("I62", "200");
		put("O62", 800);
		put("L62", "2万");
		put("F79", "小提琴");
		put("N79", "笔记本");
		put("Y114", "灰色束缚");
		put("AC114", "8mp 1d6san 1h");
		put("AH114", "控制死者");
		put("W98", "米-戈");
		put("AA98", "克苏鲁+3，SAN-6");
		put("AK98", "第一次接触");
		const worksheet = {
			"!ref": "A1:CI181",
			...cells,
		} as unknown as WorkSheet;
		xlsx.utils.book_append_sheet(workbook, worksheet, "人物卡");
		const buffer = xlsx.write(workbook, {
			type: "array",
			bookType: "xlsx",
		}) as ArrayBuffer;

		const preview = await rule.parseCharacterSheet(buffer);
		expect(preview.errors).toEqual([]);
		expect(preview.characterName).toBe("七海莲");
		expect(preview.sheetData.attributes).toMatchObject({
			str: 55,
			con: 60,
			siz: 70,
			dex: 65,
			app: 50,
			int: 70,
			pow: 60,
			edu: 75,
			luck: 45,
		});
		expect(preview.sheetData.age).toBe(42);
		expect(preview.sheetData.era).toBe("modern");
		expect(preview.sheetData.occupation.presetId).toBe("occ-25");
		expect(preview.sheetData.occupation.name).toBe("黑客/骇客（现代）");
		expect(preview.sheetData.occupation.skillKeys).toContain("计算机使用");
		expect(preview.sheetData.skills["技艺(小提琴)"]).toBe(15);
		expect(preview.sheetData.customSkills["技艺(小提琴)"]).toEqual({ base: 5 });
		expect(preview.sheetData.skills["侦查"]).toBe(58);
		expect(preview.sheetData.weapons[0]).toMatchObject({
			name: "蝴蝶刀",
			skillKey: "格斗(斗殴)",
			damage: "1D4+DB",
			applyDamageBonus: true,
		});
		expect(preview.sheetData.assets).toMatchObject({
			currency: "$",
			spendingLevel: 200,
			cash: 800,
			otherAssets: 20000,
		});
		expect(preview.sheetData.gear.map((item) => item.name)).toEqual([
			"小提琴",
			"笔记本",
		]);
		expect(preview.sheetData.spells[0]).toMatchObject({
			name: "灰色束缚",
			mpCost: "8",
			sanCost: "1d6",
			castingTime: "1h",
		});
		expect(preview.sheetData.encounters[0]).toMatchObject({
			name: "米-戈",
			mythosGain: 3,
			sanLoss: "6",
		});
		expect(preview.providedFields).toContain("attributes.str");
		expect(preview.providedFields).toContain("skills.侦查");
		expect(preview.providedFields).toContain("assets");
		expect(preview.patch).toMatchObject({
			attributes: {
				str: 55,
				con: 60,
				siz: 70,
				dex: 65,
				int: 70,
				pow: 60,
				edu: 75,
			},
			skills: { 侦查: 58, "技艺(小提琴)": 15 },
		});
	});

	test("更新导入允许模板缺少部分属性且只记录明确出现的字段", async () => {
		const xlsx = await import("xlsx");
		const workbook = xlsx.utils.book_new();
		xlsx.utils.book_append_sheet(
			workbook,
			{
				"!ref": "A1:CI181",
				E3: { t: "s", v: "局部更新" },
				U3: { t: "n", v: 66 },
				F16: { t: "s", v: "会计" },
				R16: { t: "n", v: 7 },
			} as unknown as WorkSheet,
			"人物卡",
		);
		const buffer = xlsx.write(workbook, {
			type: "array",
			bookType: "xlsx",
		}) as ArrayBuffer;
		const preview = await rule.parseCharacterSheet(buffer, { partial: true });
		expect(preview.errors).toEqual([]);
		expect(preview.patch).toMatchObject({
			attributes: { str: 66 },
			skills: { 会计: 7 },
		});
		expect(
			(preview.patch as { skills: Record<string, number> }).skills,
		).not.toHaveProperty("图书馆");
	});

	test("更新合并只覆盖导入明确提供的字段", async () => {
		const { mergeCoc7eSheetPatch } = await import("@/rules/coc7e/merge-patch");
		const base = coc7e.normalizeCoc7eSheet({
			attributes: { ...baseSheet.attributes, str: 10, con: 12 },
			skills: { 侦查: 25 },
			weapons: [
				{
					name: "旧枪",
					skillKey: "射击(手枪)",
					damage: "1d10",
					range: "15",
					attacks: "1",
					ammo: 6,
					malfunction: 100,
					impale: false,
					applyDamageBonus: false,
				},
			],
			armor: { name: "旧甲", value: 3, locations: "躯干", penalty: 1 },
			assets: {
				currency: "$",
				spendingLevel: 10,
				cash: 100,
				otherAssets: 2000,
				details: [{ category: "residence", name: "公寓", value: 2000 }],
			},
			spells: [
				{
					name: "旧法术",
					mpCost: "1",
					sanCost: "1",
					castingTime: "1 轮",
					effect: "保留",
				},
			],
		});
		const merged = mergeCoc7eSheetPatch(base, {
			attributes: { str: 60 },
			skills: { 侦查: 58 },
			armor: { name: "新甲" },
			assets: { cash: 800 },
		});
		expect(merged.attributes.str).toBe(60);
		expect(merged.attributes.con).toBe(12);
		expect(merged.skills["侦查"]).toBe(58);
		expect(merged.weapons[0]?.name).toBe("旧枪");
		expect(merged.spells[0]?.effect).toBe("保留");
		expect(merged.assets.cash).toBe(800);
		expect(merged.assets.otherAssets).toBe(2000);
		expect(merged.assets.details[0]?.name).toBe("公寓");
		expect(merged.armor).toEqual({
			name: "新甲",
			value: 3,
			locations: "躯干",
			penalty: 1,
		});
	});
});

describe("CoC 7e getSkillTargetValue", () => {
	function emptySheet(): coc7e.Coc7eCharacterSheet {
		return coc7e.normalizeCoc7eSheet({
			attributes: baseSheet.attributes,
			skills: {},
		});
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
