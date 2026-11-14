import { describe, expect, it } from "bun:test";
import {
	coc7eAgeCreationGuidance,
	coc7eSkillBaseValue,
	deriveCoc7eCreationLedger,
	deriveCoc7eSplitLedger,
	normalizeCoc7eSheet,
	projectPublicCoc7eSheet,
	rollAllCoc7eAttributes,
	rollCoc7eAttribute,
	serializeCoc7eBackground,
} from "../src/rules/coc7e";

const attributes = {
	str: 50,
	con: 50,
	siz: 50,
	dex: 60,
	app: 50,
	int: 70,
	pow: 50,
	edu: 80,
	luck: 50,
};

function sheetWith(
	skills: Record<string, number>,
	occupationSkillKeys: string[] = [],
	customSkills: Record<
		string,
		{ base: number; formula?: "halfDex" | "edu" }
	> = {},
) {
	return normalizeCoc7eSheet({
		attributes,
		skills,
		customSkills,
		occupation: {
			presetId: null,
			name: "自定义职业",
			skillPointFormula: [{ attribute: "edu", multiplier: 4 }],
			creditMin: 9,
			creditMax: 60,
			skillKeys: occupationSkillKeys,
		},
	});
}

describe("CoC 7e creation skill ledger", () => {
	it("separates occupation and interest spending from dynamic bases", () => {
		const ledger = deriveCoc7eCreationLedger(
			sheetWith(
				{
					侦查: 55,
					闪避: 40,
					"技艺(摄影)": 20,
					信用评级: 41,
					图书馆: 30,
					克苏鲁神话: 4,
				},
				["侦查", "闪避", "技艺(摄影)"],
			),
		);
		expect(ledger.occupation).toEqual({
			budget: 320,
			spent: 96,
			remaining: 224,
		});
		expect(ledger.interest).toEqual({ budget: 140, spent: 10, remaining: 130 });
		expect(ledger.excludedPoints).toBe(4);
		expect(ledger.entries).toEqual([
			{ key: "侦查", base: 25, value: 55, spent: 30, source: "occupation" },
			{ key: "闪避", base: 30, value: 40, spent: 10, source: "occupation" },
			{
				key: "技艺(摄影)",
				base: 5,
				value: 20,
				spent: 15,
				source: "occupation",
			},
			{ key: "信用评级", base: 0, value: 41, spent: 41, source: "occupation" },
			{ key: "图书馆", base: 20, value: 30, spent: 10, source: "interest" },
			{ key: "克苏鲁神话", base: 0, value: 4, spent: 4, source: "excluded" },
		]);
	});

	it("does not refund reductions below base values", () => {
		const ledger = deriveCoc7eCreationLedger(
			sheetWith({ 侦查: 10, 图书馆: 10 }, ["侦查"]),
		);
		expect(ledger.occupation.spent).toBe(0);
		expect(ledger.interest.spent).toBe(0);
	});

	it("supports custom specializations and formula-based custom bases", () => {
		const sheet = sheetWith(
			{ "语言(法语)": 21, 战术母语: 85 },
			["语言(法语)", "战术母语"],
			{
				"语言(法语)": { base: 1 },
				战术母语: { base: 0, formula: "edu" },
			},
		);
		const ledger = deriveCoc7eCreationLedger(sheet);
		expect(ledger.occupation.spent).toBe(25);
		expect(coc7eSkillBaseValue(sheet, "语言(法语)")).toBe(1);
		expect(coc7eSkillBaseValue(sheet, "战术母语")).toBe(80);
	});

	it("derives dodge and own-language bases from current attributes", () => {
		const sheet = sheetWith({});
		expect(coc7eSkillBaseValue(sheet, "闪避")).toBe(30);
		expect(coc7eSkillBaseValue(sheet, "母语")).toBe(80);
	});
});

describe("CoC 7e creation age guidance", () => {
	it("describes the youngest investigators without applying changes", () => {
		expect(coc7eAgeCreationGuidance(15)).toEqual({
			minAge: 15,
			maxAge: 19,
			eduImprovementChecks: 0,
			physicalAttributeGroup: "strSiz",
			physicalAttributeReduction: 5,
			appearanceReduction: 0,
			eduReduction: 5,
			luckRolls: 2,
		});
	});

	it("uses each official adjustment band including the upper age boundary", () => {
		expect(coc7eAgeCreationGuidance(20)).toMatchObject({
			eduImprovementChecks: 1,
		});
		expect(coc7eAgeCreationGuidance(39)).toMatchObject({
			eduImprovementChecks: 1,
		});
		expect(coc7eAgeCreationGuidance(40)).toMatchObject({
			eduImprovementChecks: 2,
			physicalAttributeGroup: "strConDex",
			physicalAttributeReduction: 5,
			appearanceReduction: 5,
		});
		expect(coc7eAgeCreationGuidance(50)).toMatchObject({
			eduImprovementChecks: 3,
			physicalAttributeReduction: 10,
			appearanceReduction: 10,
		});
		expect(coc7eAgeCreationGuidance(60)).toMatchObject({
			eduImprovementChecks: 4,
			physicalAttributeReduction: 20,
			appearanceReduction: 15,
		});
		expect(coc7eAgeCreationGuidance(70)).toMatchObject({
			physicalAttributeReduction: 40,
			appearanceReduction: 20,
		});
		expect(coc7eAgeCreationGuidance(90)).toMatchObject({
			minAge: 80,
			maxAge: 90,
			eduImprovementChecks: 4,
			physicalAttributeReduction: 80,
			appearanceReduction: 25,
		});
	});

	it("returns no guidance when age has not been entered", () => {
		expect(coc7eAgeCreationGuidance(null)).toBeNull();
	});
});

describe("CoC 7e v2 split ledger, rolling, background serialization and public projection", () => {
	it("computes split ledger with storied investigator experience column", () => {
		const sheet = normalizeCoc7eSheet({
			attributes,
			profile: {
				storiedInvestigator: true,
				experienceBonusPoints: 100,
			},
			occupation: {
				presetId: null,
				name: "私家侦探",
				skillPointFormula: [{ attribute: "edu", multiplier: 4 }],
				creditMin: 20,
				creditMax: 70,
				skillKeys: ["侦查"],
			},
			skills: {
				侦查: 55,
				图书馆: 40,
			},
			skillAllocation: {
				侦查: { occupation: 15, interest: 5, experience: 10 },
				图书馆: { occupation: 0, interest: 10, experience: 10 },
			},
		});
		const ledger = deriveCoc7eSplitLedger(sheet);
		expect(ledger.occupation).toEqual({
			budget: 320,
			spent: 15,
			remaining: 305,
		});
		expect(ledger.interest).toEqual({
			budget: 140,
			spent: 15,
			remaining: 125,
		});
		expect(ledger.experience).toEqual({
			budget: 100,
			spent: 20,
			remaining: 80,
		});
	});

	it("rolls attributes using 3d6*5 and (2d6+6)*5 formulas", () => {
		expect(rollCoc7eAttribute("str", () => 1)).toBe(15);
		expect(rollCoc7eAttribute("str", (sides) => sides)).toBe(90);
		expect(rollCoc7eAttribute("siz", () => 1)).toBe(40);
		expect(rollCoc7eAttribute("edu", (sides) => sides)).toBe(90);
		const all = rollAllCoc7eAttributes(() => 3);
		expect(all.str).toBe(45);
		expect(all.siz).toBe(60);
	});

	it("serializes structured background with key connection star or falls back to plain text", () => {
		const emptySheet = normalizeCoc7eSheet({ attributes, skills: {} });
		expect(
			serializeCoc7eBackground(
				emptySheet.profile,
				emptySheet.backgroundProfile,
				"原始纯文本",
			),
		).toBe("原始纯文本");

		const filled = normalizeCoc7eSheet({
			attributes,
			skills: {},
			profile: {
				gender: "女",
				residence: "阿卡姆",
				birthplace: "波士顿",
			},
			backgroundProfile: {
				ideologyBeliefs: "科学可以解释一切",
				keyConnection: "ideologyBeliefs",
				partnerName: "亚瑟",
				keyConnectionStory: "大学实验室事故后立下的誓言",
			},
		});
		const text = serializeCoc7eBackground(
			filled.profile,
			filled.backgroundProfile,
			"",
		);
		expect(text).toContain("性别：女 · 住地：阿卡姆 · 故乡：波士顿");
		expect(text).toContain("【思想与信念 ★关键链接】科学可以解释一切");
		expect(text).toContain("【调查员伙伴】亚瑟");
		expect(text).toContain("【关键链接小传】大学实验室事故后立下的誓言");
	});

	it("redacts backgroundProfile and experiences in public projection", () => {
		const projected = projectPublicCoc7eSheet({
			attributes,
			skills: { 侦查: 60 },
			backgroundProfile: {
				ideologyBeliefs: "秘密信仰",
				keyConnection: "ideologyBeliefs",
				partnerName: "同伴",
			},
			experiences: [
				{
					id: "exp-1",
					title: "秘密档案",
					sourceType: "manual",
					refKind: null,
					refId: null,
					refLabel: "",
					summary: "不该公开",
					changes: [],
					occurredLabel: "",
				},
			],
		});
		expect(projected.skills["侦查"]).toBe(60);
		expect(projected.backgroundProfile.ideologyBeliefs).toBe("");
		expect(projected.backgroundProfile.keyConnection).toBeNull();
		expect(projected.experiences).toEqual([]);
	});
});
