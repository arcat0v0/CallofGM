import { describe, expect, it } from "bun:test";
import {
	COC7E_ARMOR,
	COC7E_ATTRIBUTE_ALIASES,
	COC7E_OCCUPATIONS,
	COC7E_SKILL_GROUP_ALIASES,
	COC7E_WEAPONS,
	canonicalizeCoc7eSkillKey,
	coc7eArmorFromCatalog,
	coc7eIsOccupationalSkill,
	coc7eOccupation,
	coc7eOccupationFromDefinition,
	coc7eOccupationProgress,
	coc7eOccupationSkillPointTotal,
	coc7eOccupationSkillKeys,
	coc7eOccupationWithChoice,
	coc7eOccupationWithFreeSkills,
	coc7eSkillFamily,
	coc7eWeaponFromCatalog,
	coc7eWeaponsForEra,
	deriveCoc7eCreationLedger,
	normalizeCoc7eSheet,
} from "../src/rules/coc7e";

const attributeKeys = new Set(Object.keys(COC7E_ATTRIBUTE_ALIASES));
const familyNames = new Set(Object.keys(COC7E_SKILL_GROUP_ALIASES));

function skillEntryResolves(entry: string): boolean {
	if (canonicalizeCoc7eSkillKey(entry)) {
		return true;
	}
	const family = coc7eSkillFamily(entry);
	if (!family) {
		return false;
	}
	return familyNames.has(family);
}

function baseAttributes(overrides: Record<string, number> = {}) {
	return {
		str: 50,
		con: 50,
		siz: 50,
		dex: 50,
		app: 50,
		int: 50,
		pow: 50,
		edu: 60,
		luck: 50,
		...overrides,
	};
}

describe("CoC 7e occupation reference table", () => {
	it("covers the whole reference list with unique ids and sane credit ranges", () => {
		expect(COC7E_OCCUPATIONS.length).toBeGreaterThan(200);
		const ids = new Set<string>();
		for (const occupation of COC7E_OCCUPATIONS) {
			expect(occupation.id).not.toBe("");
			expect(occupation.name).not.toBe("");
			expect(ids.has(occupation.id)).toBe(false);
			ids.add(occupation.id);
			expect(occupation.creditMin).toBeGreaterThanOrEqual(0);
			expect(occupation.creditMax).toBeLessThanOrEqual(99);
			expect(occupation.creditMin).toBeLessThanOrEqual(occupation.creditMax);
			expect(occupation.skillPointOptions.length).toBeGreaterThan(0);
		}
	});

	it("keeps both complete alternatives of an or-formula", () => {
		const detective = COC7E_OCCUPATIONS.find(
			(occupation) => occupation.name === "事务所侦探、保安",
		);
		expect(detective?.skillPointOptions).toEqual([
			[
				{ attribute: "edu", multiplier: 2 },
				{ attribute: "str", multiplier: 2 },
			],
			[
				{ attribute: "edu", multiplier: 2 },
				{ attribute: "dex", multiplier: 2 },
			],
		]);
		const attributes = baseAttributes({ edu: 50, str: 60, dex: 70 });
		expect(
			coc7eOccupationSkillPointTotal(
				detective as coc7e.Coc7eOccupationDefinition,
				attributes,
			),
		).toBe(240);
	});

	it("gives every occupation a parsable skill point formula", () => {
		for (const occupation of COC7E_OCCUPATIONS) {
			for (const option of occupation.skillPointOptions) {
				expect(option.length).toBeGreaterThan(0);
				for (const term of option) {
					expect(attributeKeys.has(term.attribute)).toBe(true);
					expect(term.multiplier).toBeGreaterThan(0);
					expect(term.multiplier).toBeLessThanOrEqual(8);
				}
			}
		}
	});

	it("resolves every occupational skill entry to a known skill or family", () => {
		const unresolved: string[] = [];
		for (const occupation of COC7E_OCCUPATIONS) {
			expect(
				occupation.fixedSkillKeys.length +
					occupation.choiceGroups.length +
					occupation.anySkillCount,
			).toBeGreaterThan(0);
			for (const entry of occupation.fixedSkillKeys) {
				if (!skillEntryResolves(entry)) {
					unresolved.push(`${occupation.name}:${entry}`);
				}
			}
			for (const group of occupation.choiceGroups) {
				expect(group.pool.length).toBeGreaterThan(0);
				expect(group.choose).toBeGreaterThan(0);
				expect(group.choose).toBeLessThanOrEqual(group.pool.length);
				for (const entry of group.pool) {
					if (!skillEntryResolves(entry)) {
						unresolved.push(`${occupation.name}:${group.id}:${entry}`);
					}
				}
			}
		}
		expect(unresolved).toEqual([]);
	});

	it("keeps the well known entries intact", () => {
		expect(coc7eOccupation("occ-11")?.name).toBe("考古学家（原作向）");
		const accountant = COC7E_OCCUPATIONS.find(
			(occupation) => occupation.name === "会计师",
		);
		expect(accountant).toBeDefined();
		expect(accountant?.choiceGroups).toEqual([]);
		expect(accountant?.anySkillCount).toBe(2);
		const actor = COC7E_OCCUPATIONS.find(
			(occupation) => occupation.name === "演员-戏剧演员",
		);
		expect(actor?.fixedSkillKeys).toContain("技艺(表演)");
		expect(actor?.choiceGroups[0]).toMatchObject({
			choose: 2,
			pool: ["魅惑", "话术", "恐吓", "说服"],
		});
		const archaeologist = COC7E_OCCUPATIONS.find(
			(occupation) => occupation.name === "考古学家（原作向）",
		);
		expect(archaeologist?.fixedSkillKeys).toContain("语言");
		expect(archaeologist?.choiceGroups[0]?.choose).toBe(1);
		expect(archaeologist?.choiceGroups[0]?.pool).toContain("领航");
		expect(
			archaeologist?.choiceGroups[0]?.pool.some((key) =>
				key.startsWith("科学("),
			),
		).toBe(true);
	});
});

describe("CoC 7e occupation skill derivation", () => {
	it("treats fixed skills, families and chosen skills as occupational", () => {
		const occupation = coc7eOccupationFromDefinition("occ-4");
		expect(occupation).not.toBeNull();
		if (!occupation) {
			return;
		}
		expect(coc7eIsOccupationalSkill(occupation, "技艺(表演)")).toBe(true);
		expect(coc7eIsOccupationalSkill(occupation, "格斗(剑)")).toBe(true);
		expect(coc7eIsOccupationalSkill(occupation, "心理学")).toBe(true);
		expect(coc7eIsOccupationalSkill(occupation, "魅惑")).toBe(false);

		const socialGroupId =
			coc7eOccupationProgress(occupation).choices[0]?.id ?? "";
		expect(socialGroupId).not.toBe("");
		const withSocial = coc7eOccupationWithChoice(occupation, socialGroupId, [
			"魅惑",
			"话术",
		]);
		expect(coc7eIsOccupationalSkill(withSocial, "魅惑")).toBe(true);
		expect(coc7eIsOccupationalSkill(withSocial, "话术")).toBe(true);
		expect(coc7eIsOccupationalSkill(withSocial, "恐吓")).toBe(false);
		expect(coc7eOccupationSkillKeys(withSocial)).toContain("魅惑");
	});

	it("counts free specialty picks towards occupational skills", () => {
		const occupation = coc7eOccupationFromDefinition("occ-2");
		expect(occupation).not.toBeNull();
		if (!occupation) {
			return;
		}
		const withFree = coc7eOccupationWithFreeSkills(occupation, [
			"潜水",
			"爆破",
			"锁匠",
		]);
		expect(withFree.freeSkillKeys).toEqual(["潜水", "爆破"]);
		expect(coc7eIsOccupationalSkill(withFree, "潜水")).toBe(true);
		expect(coc7eIsOccupationalSkill(withFree, "锁匠")).toBe(false);
	});

	it("reports how much of the occupation template is still unanswered", () => {
		const occupation = coc7eOccupationFromDefinition("occ-4");
		if (!occupation) {
			throw new Error("actor occupation missing");
		}
		const empty = coc7eOccupationProgress(occupation);
		expect(empty.missingChoices).toBe(3);
		expect(empty.complete).toBe(false);
		const groupId = coc7eOccupationProgress(occupation).choices[0]?.id ?? "";
		const filled = coc7eOccupationWithFreeSkills(
			coc7eOccupationWithChoice(occupation, groupId, ["魅惑", "说服"]),
			["锁匠"],
		);
		const progress = coc7eOccupationProgress(filled);
		expect(progress.missingChoices).toBe(0);
		expect(progress.complete).toBe(true);
	});

	it("spends points through the occupational budget when the preset covers the skill", () => {
		const occupation = coc7eOccupationFromDefinition("occ-2");
		if (!occupation) {
			throw new Error("accountant occupation missing");
		}
		const sheet = normalizeCoc7eSheet({
			attributes: baseAttributes(),
			occupation: coc7eOccupationWithFreeSkills(occupation, ["潜水", "爆破"]),
			skills: { 会计: 70, 侦查: 60, 潜水: 30, 攀爬: 40, 信用评级: 45 },
		});
		const ledger = deriveCoc7eCreationLedger(sheet);
		const entryOf = (key: string) =>
			ledger.entries.find((entry) => entry.key === key);
		expect(entryOf("会计")?.source).toBe("occupation");
		expect(entryOf("侦查")?.source).toBe("occupation");
		expect(entryOf("潜水")?.source).toBe("occupation");
		expect(entryOf("信用评级")?.source).toBe("occupation");
		expect(entryOf("攀爬")?.source).toBe("interest");
		expect(ledger.occupation.budget).toBe(240);
		expect(ledger.occupation.spent).toBe(65 + 35 + 29 + 45);
		expect(ledger.interest.spent).toBe(20);
	});

	it("falls back to the stored skill list for custom occupations", () => {
		const sheet = normalizeCoc7eSheet({
			attributes: baseAttributes(),
			occupation: {
				presetId: null,
				name: "私家教练",
				skillPointFormula: [{ attribute: "edu", multiplier: 4 }],
				creditMin: 10,
				creditMax: 40,
				skillKeys: ["游泳", "攀爬"],
			},
			skills: { 游泳: 40, 攀爬: 40, 会计: 20 },
		});
		const ledger = deriveCoc7eCreationLedger(sheet);
		const entryOf = (key: string) =>
			ledger.entries.find((entry) => entry.key === key);
		expect(entryOf("游泳")?.source).toBe("occupation");
		expect(entryOf("会计")?.source).toBe("interest");
	});
});

describe("CoC 7e weapon and armor catalogs", () => {
	it("maps every weapon row onto a known combat skill", () => {
		expect(COC7E_WEAPONS.length).toBeGreaterThan(80);
		const unresolved: string[] = [];
		for (const weapon of COC7E_WEAPONS) {
			if (!skillEntryResolves(weapon.skillKey)) {
				unresolved.push(`${weapon.name}:${weapon.skillKey}`);
			}
			expect(weapon.damage).not.toBe("");
			expect(weapon.eras.length).toBeGreaterThan(0);
		}
		expect(unresolved).toEqual([]);
	});

	it("converts catalog rows into sheet weapon entries", () => {
		const revolver = COC7E_WEAPONS.find((weapon) =>
			weapon.name.includes(".38(9mm)左轮手枪"),
		);
		expect(revolver).toBeDefined();
		if (!revolver) {
			return;
		}
		expect(revolver.skillKey).toBe("射击(手枪)");
		expect(revolver.impale).toBe(true);
		const sheetWeapon = coc7eWeaponFromCatalog(revolver);
		expect(sheetWeapon.name).toBe(revolver.name);
		expect(sheetWeapon.applyDamageBonus).toBe(revolver.damageBonus !== "none");
		expect(sheetWeapon.skillKey).toBe("射击(手枪)");
	});

	it("filters weapons by era and keeps both eras reachable", () => {
		const classic = coc7eWeaponsForEra("1920s");
		const modern = coc7eWeaponsForEra("modern");
		expect(classic.length).toBeGreaterThan(0);
		expect(modern.length).toBeGreaterThan(0);
		expect(classic.length).toBeLessThanOrEqual(COC7E_WEAPONS.length);
		const modernOnly = COC7E_WEAPONS.filter(
			(weapon) => weapon.eras.length === 1 && weapon.eras[0] === "modern",
		);
		expect(modernOnly.length).toBeGreaterThan(0);
		for (const weapon of modernOnly.slice(0, 5)) {
			expect(classic.some((item) => item.name === weapon.name)).toBe(false);
		}
	});

	it("keeps armor values inside the sheet schema range", () => {
		expect(COC7E_ARMOR.length).toBeGreaterThan(10);
		for (const armor of COC7E_ARMOR) {
			expect(armor.value).toBeGreaterThanOrEqual(0);
			expect(armor.value).toBeLessThanOrEqual(99);
			expect(armor.name).not.toBe("");
			const sheetArmor = coc7eArmorFromCatalog(armor);
			expect(sheetArmor.value).toBe(armor.value);
		}
	});
});
