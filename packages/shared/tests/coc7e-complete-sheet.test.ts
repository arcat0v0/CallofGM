import { describe, expect, it } from "bun:test";
import {
	COC7E_OCCUPATIONS,
	Coc7eCharacterSheet,
	canonicalizeCoc7eSkillKey,
	coc7eAssetRecommendation,
	coc7eDamageBonusAndBuild,
	coc7eMovement,
	coc7eSkillGrowthAllowed,
	coc7eSkillTargetValue,
	deriveCoc7eSheetStats,
	normalizeCoc7eSheet,
	projectPublicCoc7eSheet,
} from "../src/rules/coc7e";

const attributes = {
	str: 50,
	con: 50,
	siz: 50,
	dex: 50,
	app: 50,
	int: 50,
	pow: 50,
	edu: 50,
	luck: 50,
};

function completeSheet() {
	return normalizeCoc7eSheet({
		schemaVersion: 1,
		attributes,
		skills: { 侦查: 55, 格斗: 40, 克苏鲁神话: 4 },
	});
}

describe("CoC 7e complete sheet normalization", () => {
	it("upgrades a v1 sheet without losing values and migrates the brawl alias", () => {
		const sheet = completeSheet();
		expect(sheet.schemaVersion).toBe(2);
		expect(sheet.skills["侦查"]).toBe(55);
		expect(sheet.skills["格斗(斗殴)"]).toBe(40);
		expect(sheet.era).toBe("1920s");
		expect(sheet.age).toBeNull();
		expect(sheet.weapons).toEqual([]);
		expect(sheet.spells).toEqual([]);
		expect(sheet.assets.cash).toBe(0);
	});

	it("accepts official numeric sections and skill values above 100", () => {
		const sheet = Coc7eCharacterSheet.parse({
			...completeSheet(),
			age: 42,
			occupation: {
				presetId: "reporter",
				name: "记者",
				skillPointFormula: [{ attribute: "edu", multiplier: 4 }],
				creditMin: 9,
				creditMax: 30,
				skillKeys: ["历史", "图书馆"],
			},
			customSkills: {
				"语言(法语)": { base: 1 },
				"母语(英语)": { base: 0, formula: "edu" },
			},
			skills: { 侦查: 105, "语言(法语)": 45 },
			weapons: [
				{
					name: "手枪",
					skillKey: "射击(手枪)",
					damage: "1D10",
					range: "15码",
					attacks: "1",
					ammo: 6,
					malfunction: 100,
					impale: false,
					applyDamageBonus: false,
				},
			],
			armor: { name: "皮甲", value: 2, locations: "躯干", penalty: 0 },
			gear: [{ name: "笔记本", quantity: 2 }],
			spells: [
				{
					name: "示例法术",
					mpCost: "1D6",
					sanCost: "1",
					castingTime: "1轮",
					effect: "测试",
				},
			],
			mythosTomes: [
				{
					name: "示例典籍",
					sanLoss: "1D6",
					mythosGain: 2,
					studyHours: 12,
					spells: "示例法术",
				},
			],
			encounters: [
				{
					name: "深潜者",
					sanLoss: "1/1D6",
					mythosGain: 1,
					count: 1,
					notes: "",
				},
			],
			assets: {
				currency: "$",
				spendingLevel: 10,
				cash: 82.5,
				otherAssets: 2050,
				details: [{ category: "residence", name: "公寓", value: 2000 }],
			},
		});
		expect(sheet.skills["侦查"]).toBe(105);
		expect(sheet.weapons[0]?.ammo).toBe(6);
		expect(sheet.assets.details[0]?.category).toBe("residence");
		expect(coc7eSkillTargetValue(sheet, "语言(法语)")).toBe(45);
		expect(coc7eSkillTargetValue(sheet, "母语(英语)")).toBe(50);
	});

	it("rejects invalid attributes, skills, and weapon values", () => {
		expect(() =>
			Coc7eCharacterSheet.parse({
				...completeSheet(),
				attributes: { ...attributes, str: 0 },
			}),
		).toThrow();
		expect(() =>
			Coc7eCharacterSheet.parse({ ...completeSheet(), skills: { 侦查: 1000 } }),
		).toThrow();
		expect(() =>
			Coc7eCharacterSheet.parse({
				...completeSheet(),
				weapons: [{ ...completeSheet().weapons, name: "坏武器" }],
			}),
		).toThrow();
	});

	it("uses custom skill bases and canonical aliases", () => {
		const sheet = normalizeCoc7eSheet({
			...completeSheet(),
			customSkills: { 自定义技艺: { base: 12 } },
		});
		expect(coc7eSkillTargetValue(sheet, "自定义技艺")).toBe(12);
		expect(canonicalizeCoc7eSkillKey("格斗：斗殴")).toBe("格斗(斗殴)");
		expect(canonicalizeCoc7eSkillKey("取悦")).toBe("魅惑");
		expect(canonicalizeCoc7eSkillKey("导航")).toBe("领航");
		expect(canonicalizeCoc7eSkillKey("步枪")).toBe("射击(步枪/霰弹枪)");
		expect(coc7eSkillTargetValue(sheet, "科学(数学)")).toBe(10);
		expect(coc7eSkillTargetValue(sheet, "驾驶(船)")).toBe(1);
	});
});

describe("CoC 7e official derivations", () => {
	it("derives HP, MP, SAN, skill budgets, and major wound threshold", () => {
		const sheet = normalizeCoc7eSheet({
			...completeSheet(),
			attributes: { ...attributes, con: 65, siz: 70, pow: 45, int: 85 },
			skills: { 克苏鲁神话: 4 },
			occupation: {
				...completeSheet().occupation,
				skillPointFormula: [
					{ attribute: "edu", multiplier: 2 },
					{ attribute: "dex", multiplier: 2 },
				],
			},
		});
		const derived = deriveCoc7eSheetStats(sheet);
		expect(derived.maxHp).toBe(13);
		expect(derived.maxMp).toBe(9);
		expect(derived.initialSan).toBe(45);
		expect(derived.maxSan).toBe(95);
		expect(derived.majorWoundThreshold).toBe(6);
		expect(derived.interestSkillPoints).toBe(170);
		expect(derived.occupationSkillPoints).toBe(200);
	});

	it("calculates every damage bonus boundary and continuation", () => {
		expect(coc7eDamageBonusAndBuild(20, 44)).toEqual({
			damageBonus: "-2",
			build: -2,
		});
		expect(coc7eDamageBonusAndBuild(40, 44)).toEqual({
			damageBonus: "-1",
			build: -1,
		});
		expect(coc7eDamageBonusAndBuild(40, 45)).toEqual({
			damageBonus: "0",
			build: 0,
		});
		expect(coc7eDamageBonusAndBuild(80, 84)).toEqual({
			damageBonus: "+1d4",
			build: 1,
		});
		expect(coc7eDamageBonusAndBuild(80, 85)).toEqual({
			damageBonus: "+1d6",
			build: 2,
		});
		expect(coc7eDamageBonusAndBuild(99, 106)).toEqual({
			damageBonus: "+2d6",
			build: 3,
		});
		expect(coc7eDamageBonusAndBuild(150, 375)).toEqual({
			damageBonus: "+6d6",
			build: 7,
		});
		expect(coc7eDamageBonusAndBuild(200, 405)).toEqual({
			damageBonus: "+7d6",
			build: 8,
		});
	});

	it("handles MOV equality, age, and manual modifiers", () => {
		expect(coc7eMovement(attributes, null, 0)).toBe(8);
		expect(coc7eMovement({ ...attributes, str: 51, dex: 50 }, null, 0)).toBe(8);
		expect(coc7eMovement({ ...attributes, str: 51, dex: 51 }, null, 0)).toBe(9);
		expect(coc7eMovement({ ...attributes, str: 40, dex: 40 }, null, 0)).toBe(7);
		expect(coc7eMovement(attributes, 45, 0)).toBe(7);
		expect(coc7eMovement(attributes, 55, 0)).toBe(6);
		expect(coc7eMovement(attributes, 85, -10)).toBe(1);
	});

	it("uses both official asset tables and all credit bands", () => {
		expect(coc7eAssetRecommendation("1920s", 0)).toMatchObject({
			lifestyle: "身无分文",
			cash: 0.5,
			otherAssets: 0,
			spendingLevel: 0.5,
		});
		expect(coc7eAssetRecommendation("1920s", 41)).toMatchObject({
			lifestyle: "标准",
			cash: 82,
			otherAssets: 2050,
			spendingLevel: 10,
		});
		expect(coc7eAssetRecommendation("1920s", 99)).toMatchObject({
			lifestyle: "豪富",
			cash: 50000,
			otherAssets: 5000000,
			spendingLevel: 5000,
		});
		expect(coc7eAssetRecommendation("modern", 41)).toMatchObject({
			cash: 1640,
			otherAssets: 41000,
			spendingLevel: 200,
		});
		expect(coc7eAssetRecommendation("modern", 99)).toMatchObject({
			cash: 1000000,
			otherAssets: 100000000,
			spendingLevel: 100000,
		});
	});

	it("exposes the full occupation reference table", () => {
		expect(COC7E_OCCUPATIONS.length).toBeGreaterThan(200);
		expect(
			COC7E_OCCUPATIONS.find((occupation) => occupation.name === "会计师"),
		).toMatchObject({
			creditMin: 30,
			creditMax: 70,
			skillPointOptions: [[{ attribute: "edu", multiplier: 4 }]],
			fixedSkillKeys: ["会计", "法律", "图书馆", "聆听", "说服", "侦查"],
			anySkillCount: 2,
		});
	});
});

describe("CoC 7e growth and public projection", () => {
	it("rejects bonus-die, credit rating, and mythos growth marks", () => {
		expect(coc7eSkillGrowthAllowed("侦查", 0)).toBe(true);
		expect(coc7eSkillGrowthAllowed("侦查", 1)).toBe(false);
		expect(coc7eSkillGrowthAllowed("信用评级", 0)).toBe(false);
		expect(coc7eSkillGrowthAllowed("克苏鲁神话", 0)).toBe(false);
	});

	it("keeps public summaries while stripping private numeric records", () => {
		const sheet = normalizeCoc7eSheet({
			...completeSheet(),
			weapons: [
				{
					name: "秘密武器",
					skillKey: "格斗(斗殴)",
					damage: "1D8",
					range: "近战",
					attacks: "1",
					ammo: null,
					malfunction: null,
					impale: true,
					applyDamageBonus: true,
				},
			],
			assets: {
				currency: "$",
				spendingLevel: 999,
				cash: 888,
				otherAssets: 777,
				details: [],
			},
			spells: [
				{
					name: "秘密法术",
					mpCost: "10",
					sanCost: "2",
					castingTime: "1轮",
					effect: "",
				},
			],
		});
		const projected = projectPublicCoc7eSheet(sheet);
		expect(projected.attributes).toEqual(sheet.attributes);
		expect(projected.skills).toEqual(sheet.skills);
		expect(projected.weapons).toEqual([]);
		expect(projected.spells).toEqual([]);
		expect(projected.assets.cash).toBe(0);
		expect(projected.armor.value).toBe(0);
	});
});
