import { deriveCoc7eSheetStats } from "./derive";
import {
	type Coc7eOccupationDefinition,
	coc7eIsOccupationalSkill,
	coc7eOccupation,
} from "./occupations";
import type { Coc7eCharacterSheet, Coc7eOccupation } from "./sheet";
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
	const entries = Object.entries(sheet.skills).map(([rawKey, value]) => {
		const key = canonicalizeCoc7eSkillKey(rawKey) ?? rawKey;
		const base = coc7eSkillBaseValue(sheet, key) ?? 0;
		const source =
			key === "克苏鲁神话"
				? ("excluded" as const)
				: coc7eIsOccupationalSkill(sheet.occupation, key)
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

export interface Coc7eOccupationChoiceProgress {
	id: string;
	label: string;
	choose: number;
	pool: string[];
	selected: string[];
}

export interface Coc7eOccupationProgress {
	definition: Coc7eOccupationDefinition | null;
	choices: Coc7eOccupationChoiceProgress[];
	freeSkillSlots: number;
	freeSkillKeys: string[];
	missingChoices: number;
	complete: boolean;
}

export function coc7eOccupationProgress(
	occupation: Coc7eOccupation,
): Coc7eOccupationProgress {
	const definition = coc7eOccupation(occupation.presetId);
	if (!definition) {
		return {
			definition: null,
			choices: [],
			freeSkillSlots: 0,
			freeSkillKeys: [],
			missingChoices: 0,
			complete: occupation.skillKeys.length > 0,
		};
	}
	const choices = definition.choiceGroups.map((group) => {
		const selected = (occupation.choiceSelections[group.id] ?? []).filter(
			(key) => key.trim() !== "",
		);
		return {
			id: group.id,
			label: group.label,
			choose: group.choose,
			pool: group.pool,
			selected,
		};
	});
	const missingChoices = choices.reduce(
		(total, group) => total + Math.max(0, group.choose - group.selected.length),
		0,
	);
	const freeSkillKeys = occupation.freeSkillKeys.filter(
		(key) => key.trim() !== "",
	);
	const missingFreeSkills = Math.max(
		0,
		definition.anySkillCount - freeSkillKeys.length,
	);
	return {
		definition,
		choices,
		freeSkillSlots: definition.anySkillCount,
		freeSkillKeys,
		missingChoices: missingChoices + missingFreeSkills,
		complete: missingChoices + missingFreeSkills === 0,
	};
}

export function coc7eOccupationFromDefinition(
	id: string,
): Coc7eOccupation | null {
	const definition = coc7eOccupation(id);
	if (!definition) {
		return null;
	}
	return {
		presetId: definition.id,
		name: definition.name,
		skillPointFormula: definition.skillPointOptions[0] ?? [],
		creditMin: definition.creditMin,
		creditMax: definition.creditMax,
		skillKeys: definition.fixedSkillKeys,
		choiceSelections: {},
		freeSkillKeys: [],
	};
}

export function coc7eClearOccupation(): Coc7eOccupation {
	return {
		presetId: null,
		name: "",
		skillPointFormula: [],
		creditMin: 0,
		creditMax: 99,
		skillKeys: [],
		choiceSelections: {},
		freeSkillKeys: [],
	};
}

export function coc7eOccupationWithChoice(
	occupation: Coc7eOccupation,
	groupId: string,
	keys: string[],
): Coc7eOccupation {
	const canonical = [
		...new Set(
			keys
				.map((key) => key.trim())
				.filter((key) => key !== "")
				.map((key) => canonicalizeCoc7eSkillKey(key) ?? key),
		),
	];
	return {
		...occupation,
		choiceSelections: { ...occupation.choiceSelections, [groupId]: canonical },
	};
}

export function coc7eOccupationWithFreeSkills(
	occupation: Coc7eOccupation,
	keys: string[],
): Coc7eOccupation {
	const definition = coc7eOccupation(occupation.presetId);
	const limit = definition ? definition.anySkillCount : keys.length;
	const canonical = [
		...new Set(
			keys
				.map((key) => key.trim())
				.filter((key) => key !== "")
				.map((key) => canonicalizeCoc7eSkillKey(key) ?? key),
		),
	].slice(0, limit);
	return { ...occupation, freeSkillKeys: canonical };
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
