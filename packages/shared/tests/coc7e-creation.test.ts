import { describe, expect, it } from "bun:test";
import {
	coc7eAgeCreationGuidance,
	coc7eSkillBaseValue,
	deriveCoc7eCreationLedger,
	normalizeCoc7eSheet,
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
