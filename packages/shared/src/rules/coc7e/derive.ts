import { coc7eOccupationSkillPointFormula } from "./occupations";
import type { Coc7eAttributes, Coc7eCharacterSheet, Coc7eEra } from "./sheet";
import { coc7eSkillTargetValue } from "./skills";

export interface Coc7eDerivedStats {
	maxHp: number;
	maxMp: number;
	initialSan: number;
	maxSan: number;
	damageBonus: string;
	build: number;
	mov: number;
	majorWoundThreshold: number;
	interestSkillPoints: number;
	occupationSkillPoints: number;
}

export function coc7eDamageBonusAndBuild(
	str: number,
	siz: number,
): { damageBonus: string; build: number } {
	const total = str + siz;
	if (total <= 64) {
		return { damageBonus: "-2", build: -2 };
	}
	if (total <= 84) {
		return { damageBonus: "-1", build: -1 };
	}
	if (total <= 124) {
		return { damageBonus: "0", build: 0 };
	}
	if (total <= 164) {
		return { damageBonus: "+1d4", build: 1 };
	}
	const extraSteps = total < 205 ? 0 : Math.floor((total - 205) / 80) + 1;
	return { damageBonus: `+${extraSteps + 1}d6`, build: extraSteps + 2 };
}

export function coc7eAgeMovementPenalty(age: number | null): number {
	if (age === null || age < 40) {
		return 0;
	}
	if (age < 50) {
		return 1;
	}
	if (age < 60) {
		return 2;
	}
	if (age < 70) {
		return 3;
	}
	if (age < 80) {
		return 4;
	}
	return 5;
}

export function coc7eMovement(
	attributes: Coc7eAttributes,
	age: number | null,
	movementModifier: number,
): number {
	const { str, dex, siz } = attributes;
	const base = str > siz && dex > siz ? 9 : str >= siz || dex >= siz ? 8 : 7;
	return Math.max(1, base - coc7eAgeMovementPenalty(age) + movementModifier);
}

export function deriveCoc7eSheetStats(
	sheet: Coc7eCharacterSheet,
): Coc7eDerivedStats {
	const { attributes } = sheet;
	const combat = coc7eDamageBonusAndBuild(attributes.str, attributes.siz);
	const maxHp = Math.max(1, Math.floor((attributes.con + attributes.siz) / 10));
	const maxSan = Math.max(
		0,
		99 - (coc7eSkillTargetValue(sheet, "克苏鲁神话") ?? 0),
	);
	return {
		maxHp,
		maxMp: Math.floor(attributes.pow / 5),
		initialSan: Math.min(attributes.pow, maxSan),
		maxSan,
		damageBonus: combat.damageBonus,
		build: combat.build,
		mov: coc7eMovement(attributes, sheet.age, sheet.movementModifier),
		majorWoundThreshold: Math.floor(maxHp / 2),
		interestSkillPoints: attributes.int * 2,
		occupationSkillPoints: coc7eOccupationSkillPointFormula(
			sheet.occupation,
		).reduce(
			(total, part) => total + attributes[part.attribute] * part.multiplier,
			0,
		),
	};
}

export interface Coc7eAssetRecommendation {
	lifestyle: "身无分文" | "贫穷" | "标准" | "小康" | "富裕" | "豪富";
	cash: number;
	otherAssets: number;
	spendingLevel: number;
}

export function coc7eAssetRecommendation(
	era: Coc7eEra,
	rawCreditRating: number,
): Coc7eAssetRecommendation {
	const credit = Math.max(0, Math.min(99, Math.trunc(rawCreditRating)));
	if (credit === 0) {
		return era === "1920s"
			? { lifestyle: "身无分文", cash: 0.5, otherAssets: 0, spendingLevel: 0.5 }
			: { lifestyle: "身无分文", cash: 10, otherAssets: 0, spendingLevel: 10 };
	}
	if (credit === 99) {
		return era === "1920s"
			? {
					lifestyle: "豪富",
					cash: 50000,
					otherAssets: 5000000,
					spendingLevel: 5000,
				}
			: {
					lifestyle: "豪富",
					cash: 1000000,
					otherAssets: 100000000,
					spendingLevel: 100000,
				};
	}
	if (credit <= 9) {
		return era === "1920s"
			? {
					lifestyle: "贫穷",
					cash: credit,
					otherAssets: credit * 10,
					spendingLevel: 2,
				}
			: {
					lifestyle: "贫穷",
					cash: credit * 20,
					otherAssets: credit * 200,
					spendingLevel: 40,
				};
	}
	if (credit <= 49) {
		return era === "1920s"
			? {
					lifestyle: "标准",
					cash: credit * 2,
					otherAssets: credit * 50,
					spendingLevel: 10,
				}
			: {
					lifestyle: "标准",
					cash: credit * 40,
					otherAssets: credit * 1000,
					spendingLevel: 200,
				};
	}
	if (credit <= 89) {
		return era === "1920s"
			? {
					lifestyle: "小康",
					cash: credit * 5,
					otherAssets: credit * 500,
					spendingLevel: 50,
				}
			: {
					lifestyle: "小康",
					cash: credit * 100,
					otherAssets: credit * 10000,
					spendingLevel: 1000,
				};
	}
	return era === "1920s"
		? {
				lifestyle: "富裕",
				cash: credit * 20,
				otherAssets: credit * 2000,
				spendingLevel: 250,
			}
		: {
				lifestyle: "富裕",
				cash: credit * 400,
				otherAssets: credit * 40000,
				spendingLevel: 5000,
			};
}
