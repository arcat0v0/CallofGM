import { deriveCoc7eSheetStats } from "./derive";
import type { Coc7eCharacterSheet } from "./sheet";
import { canonicalizeCoc7eSkillKey, coc7eSkillBaseValue } from "./skills";

export interface Coc7eSkillPointBudget {
	budget: number;
	spent: number;
	remaining: number;
}

export interface Coc7eCreationLedgerEntry {
	key: string;
	base: number;
	value: number;
	spent: number;
	source: "occupation" | "interest" | "excluded";
}

export interface Coc7eCreationLedger {
	occupation: Coc7eSkillPointBudget;
	interest: Coc7eSkillPointBudget;
	excludedPoints: number;
	entries: Coc7eCreationLedgerEntry[];
}

export function deriveCoc7eCreationLedger(
	sheet: Coc7eCharacterSheet,
): Coc7eCreationLedger {
	const derived = deriveCoc7eSheetStats(sheet);
	const occupationSkills = new Set(
		sheet.occupation.skillKeys.map(
			(key) => canonicalizeCoc7eSkillKey(key) ?? key.trim(),
		),
	);
	const entries = Object.entries(sheet.skills).map(([rawKey, value]) => {
		const key = canonicalizeCoc7eSkillKey(rawKey) ?? rawKey;
		const base = coc7eSkillBaseValue(sheet, key) ?? 0;
		const source =
			key === "克苏鲁神话"
				? ("excluded" as const)
				: key === "信用评级" || occupationSkills.has(key)
					? ("occupation" as const)
					: ("interest" as const);
		return {
			key,
			base,
			value,
			spent: Math.max(0, value - base),
			source,
		};
	});
	const occupationSpent = entries
		.filter((entry) => entry.source === "occupation")
		.reduce((total, entry) => total + entry.spent, 0);
	const interestSpent = entries
		.filter((entry) => entry.source === "interest")
		.reduce((total, entry) => total + entry.spent, 0);
	const excludedPoints = entries
		.filter((entry) => entry.source === "excluded")
		.reduce((total, entry) => total + entry.spent, 0);
	return {
		occupation: {
			budget: derived.occupationSkillPoints,
			spent: occupationSpent,
			remaining: derived.occupationSkillPoints - occupationSpent,
		},
		interest: {
			budget: derived.interestSkillPoints,
			spent: interestSpent,
			remaining: derived.interestSkillPoints - interestSpent,
		},
		excludedPoints,
		entries,
	};
}

export interface Coc7eAgeCreationGuidance {
	minAge: number;
	maxAge: number;
	eduImprovementChecks: number;
	physicalAttributeGroup: "strSiz" | "strConDex" | null;
	physicalAttributeReduction: number;
	appearanceReduction: number;
	eduReduction: number;
	luckRolls: number;
}

export function coc7eAgeCreationGuidance(
	age: number | null,
): Coc7eAgeCreationGuidance | null {
	if (age === null) {
		return null;
	}
	if (age < 20) {
		return {
			minAge: 15,
			maxAge: 19,
			eduImprovementChecks: 0,
			physicalAttributeGroup: "strSiz",
			physicalAttributeReduction: 5,
			appearanceReduction: 0,
			eduReduction: 5,
			luckRolls: 2,
		};
	}
	if (age < 40) {
		return guidance(20, 39, 1, 0, 0);
	}
	if (age < 50) {
		return guidance(40, 49, 2, 5, 5);
	}
	if (age < 60) {
		return guidance(50, 59, 3, 10, 10);
	}
	if (age < 70) {
		return guidance(60, 69, 4, 20, 15);
	}
	if (age < 80) {
		return guidance(70, 79, 4, 40, 20);
	}
	return guidance(80, 90, 4, 80, 25);
}

function guidance(
	minAge: number,
	maxAge: number,
	eduImprovementChecks: number,
	physicalAttributeReduction: number,
	appearanceReduction: number,
): Coc7eAgeCreationGuidance {
	return {
		minAge,
		maxAge,
		eduImprovementChecks,
		physicalAttributeGroup: physicalAttributeReduction > 0 ? "strConDex" : null,
		physicalAttributeReduction,
		appearanceReduction,
		eduReduction: 0,
		luckRolls: 1,
	};
}
