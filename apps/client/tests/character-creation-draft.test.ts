import { describe, expect, test } from "bun:test";
import { coc7e } from "@cogm/shared";
import {
	characterCreationDraftKey,
	clearCharacterCreationDraft,
	createEmptyCharacterSheet,
	loadCharacterCreationDraft,
	parseCharacterCreationDraft,
	saveCharacterCreationDraft,
} from "../src/features/characters/character-creation-draft";

const attributes = {
	str: 50,
	con: 55,
	siz: 50,
	dex: 60,
	app: 50,
	int: 70,
	pow: 50,
	edu: 60,
	luck: 50,
};

function storage(): Map<string, string> {
	const values = new Map<string, string>();
	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		writable: true,
		value: {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => {
				values.set(key, value);
			},
			removeItem: (key: string) => {
				values.delete(key);
			},
			clear: () => values.clear(),
		},
	});
	return values;
}

describe("character creation draft", () => {
	test("keeps identity and every sheet field across save and load", () => {
		const values = storage();
		const sheet = createEmptyCharacterSheet();
		sheet.age = 42;
		sheet.era = "modern";
		sheet.occupation = {
			presetId: "occ-25",
			name: "黑客/骇客（现代）",
			skillPointFormula: [{ attribute: "edu", multiplier: 4 }],
			creditMin: 10,
			creditMax: 70,
			skillKeys: ["计算机使用"],
			choiceSelections: { social: ["魅惑"] },
			freeSkillKeys: ["锁匠"],
		};
		sheet.attributes = attributes;
		sheet.skills = { 侦查: 55, 计算机使用: 65 };
		sheet.customSkills = { 自定义技艺: { base: 5 } };
		sheet.weapons = [
			{
				name: "手枪",
				skillKey: "射击(手枪)",
				damage: "1d10",
				range: "15 码",
				attacks: "1",
				ammo: 6,
				malfunction: 100,
				impale: false,
				applyDamageBonus: false,
			},
		];
		sheet.armor = { name: "皮甲", value: 2, locations: "躯干", penalty: 0 };
		sheet.gear = [{ name: "笔记本", quantity: 2 }];
		sheet.spells = [
			{
				name: "法术",
				mpCost: "1",
				sanCost: "1",
				castingTime: "1轮",
				effect: "效果",
			},
		];
		sheet.mythosTomes = [
			{
				name: "典籍",
				sanLoss: "1d6",
				mythosGain: 2,
				studyHours: 12,
				spells: "法术",
			},
		];
		sheet.encounters = [
			{
				name: "深潜者",
				sanLoss: "1/1d6",
				mythosGain: 1,
				count: 1,
				notes: "说明",
			},
		];
		sheet.assets = {
			currency: "$",
			spendingLevel: 200,
			cash: 1640,
			otherAssets: 41000,
			details: [{ category: "residence", name: "公寓", value: 40000 }],
		};

		expect(
			saveCharacterCreationDraft({
				accountId: "pl-1",
				context: "independent",
				name: "调查员",
				background: "一段背景",
				ruleId: "coc7e",
				sheet,
			}),
		).toBe(true);
		expect(values.size).toBe(1);
		const loaded = loadCharacterCreationDraft("pl-1", "independent");
		expect(loaded).toMatchObject({
			name: "调查员",
			background: "一段背景",
			ruleId: "coc7e",
		});
		expect(loaded?.sheet).toEqual(sheet);
		clearCharacterCreationDraft("pl-1", "independent");
		expect(loadCharacterCreationDraft("pl-1", "independent")).toBeNull();
	});

	test("isolates independent and invite drafts for the same account", () => {
		storage();
		const sheet = createEmptyCharacterSheet();
		sheet.skills = { 图书馆: 40 };
		saveCharacterCreationDraft({
			accountId: "pl-1",
			context: "independent",
			name: "甲",
			background: "",
			ruleId: "coc7e",
			sheet,
		});
		saveCharacterCreationDraft({
			accountId: "pl-1",
			context: "invite:token-a",
			name: "乙",
			background: "",
			ruleId: "coc7e",
			sheet,
		});
		expect(loadCharacterCreationDraft("pl-1", "independent")?.name).toBe("甲");
		expect(loadCharacterCreationDraft("pl-1", "invite:token-a")?.name).toBe(
			"乙",
		);
		expect(loadCharacterCreationDraft("pl-1", "invite:token-b")).toBeNull();
		expect(loadCharacterCreationDraft("pl-2", "independent")).toBeNull();
	});

	test("rejects corrupt, incompatible, and invalid draft data", () => {
		const values = storage();
		values.set(characterCreationDraftKey("pl-1", "independent"), "{broken");
		expect(loadCharacterCreationDraft("pl-1", "independent")).toBeNull();
		expect(parseCharacterCreationDraft({ version: 999 })).toBeNull();
		expect(
			parseCharacterCreationDraft({
				version: 1,
				name: "",
				background: "",
				ruleId: "coc7e",
				sheet: { attributes: { str: 0 } },
			}),
		).toBeNull();
		expect(
			parseCharacterCreationDraft({
				version: 1,
				name: "甲",
				background: "",
				ruleId: "coc7e",
				sheet: { attributes, skills: {} },
			}),
		).not.toBeNull();
	});

	test("restores an unfinished independent draft before a rule is selected", () => {
		storage();
		const sheet = createEmptyCharacterSheet();
		sheet.attributes = { ...attributes, str: 65 };
		sheet.skills = { 侦查: 60 };
		expect(
			saveCharacterCreationDraft({
				accountId: "pl-1",
				context: "independent",
				name: "尚未选择规则",
				background: "保留创作内容",
				ruleId: "",
				sheet,
			}),
		).toBe(true);
		expect(loadCharacterCreationDraft("pl-1", "independent")).toMatchObject({
			name: "尚未选择规则",
			background: "保留创作内容",
			ruleId: "",
			sheet,
		});
	});

	test("returns false when browser storage is unavailable", () => {
		Object.defineProperty(globalThis, "localStorage", {
			configurable: true,
			writable: true,
			value: {
				getItem: () => null,
				setItem: () => {
					throw new Error("quota");
				},
				removeItem: () => undefined,
			},
		});
		expect(
			saveCharacterCreationDraft({
				accountId: "pl-1",
				context: "independent",
				name: "甲",
				background: "",
				ruleId: "coc7e",
				sheet: createEmptyCharacterSheet(),
			}),
		).toBe(false);
		expect(loadCharacterCreationDraft("pl-1", "independent")).toBeNull();
	});

	test("creates a valid v2 sheet with all official sections", () => {
		const sheet = createEmptyCharacterSheet();
		expect(sheet.schemaVersion).toBe(2);
		expect(coc7e.Coc7eCharacterSheet.safeParse(sheet).success).toBe(true);
		expect(sheet.weapons).toEqual([]);
		expect(sheet.assets.details).toEqual([]);
	});
});
