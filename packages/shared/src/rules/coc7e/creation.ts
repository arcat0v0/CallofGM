import { deriveCoc7eSheetStats } from "./derive";
import {
	type Coc7eOccupationDefinition,
	coc7eIsOccupationalSkill,
	coc7eOccupation,
} from "./occupations";
import type {
	Coc7eAttributeKey,
	Coc7eAttributes,
	Coc7eBackgroundFieldKey,
	Coc7eBackgroundProfile,
	Coc7eCharacterSheet,
	Coc7eOccupation,
	Coc7eProfileInfo,
} from "./sheet";
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

export interface Coc7eSplitLedgerEntry extends Coc7eCreationLedgerEntry {
	occupationSpent: number;
	interestSpent: number;
	experienceSpent: number;
}

export interface Coc7eSplitLedger {
	occupation: Coc7eSkillPointBudget;
	interest: Coc7eSkillPointBudget;
	experience: Coc7eSkillPointBudget;
	excludedPoints: number;
	entries: Coc7eSplitLedgerEntry[];
}

export function coc7eSkillAllocationForEntry(
	sheet: Coc7eCharacterSheet,
	key: string,
): { occupation: number; interest: number; experience: number } {
	const base = coc7eSkillBaseValue(sheet, key) ?? 0;
	const value = sheet.skills[key] ?? base;
	const totalSpent = Math.max(0, value - base);
	if (key === "克苏鲁神话" || totalSpent === 0) {
		return { occupation: 0, interest: 0, experience: 0 };
	}
	const explicit = sheet.skillAllocation[key];
	const defaultOccupational = coc7eIsOccupationalSkill(sheet.occupation, key);
	if (!explicit) {
		return defaultOccupational
			? { occupation: totalSpent, interest: 0, experience: 0 }
			: { occupation: 0, interest: totalSpent, experience: 0 };
	}
	let occ = Math.max(0, Math.min(totalSpent, explicit.occupation));
	let intr = Math.max(0, Math.min(totalSpent - occ, explicit.interest));
	const exp = Math.max(
		0,
		Math.min(
			totalSpent - occ - intr,
			sheet.profile.storiedInvestigator ? explicit.experience : 0,
		),
	);
	const remainder = totalSpent - occ - intr - exp;
	if (remainder > 0) {
		if (defaultOccupational) {
			occ += remainder;
		} else {
			intr += remainder;
		}
	}
	return { occupation: occ, interest: intr, experience: exp };
}

export function deriveCoc7eCreationLedger(
	sheet: Coc7eCharacterSheet,
): Coc7eCreationLedger {
	const split = deriveCoc7eSplitLedger(sheet);
	return {
		occupation: split.occupation,
		interest: split.interest,
		excludedPoints: split.excludedPoints,
		entries: split.entries.map(({ key, base, value, spent, source }) => ({
			key,
			base,
			value,
			spent,
			source,
		})),
	};
}

export function deriveCoc7eSplitLedger(
	sheet: Coc7eCharacterSheet,
): Coc7eSplitLedger {
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
		const split = coc7eSkillAllocationForEntry(sheet, key);
		return {
			key,
			base,
			value,
			spent: Math.max(0, value - base),
			occupationSpent: split.occupation,
			interestSpent: split.interest,
			experienceSpent: split.experience,
			source,
		};
	});
	const occupationSpent = entries.reduce(
		(total, entry) => total + entry.occupationSpent,
		0,
	);
	const interestSpent = entries.reduce(
		(total, entry) => total + entry.interestSpent,
		0,
	);
	const experienceSpent = entries.reduce(
		(total, entry) => total + entry.experienceSpent,
		0,
	);
	const experienceBudget = sheet.profile.storiedInvestigator
		? sheet.profile.experienceBonusPoints
		: 0;
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
		experience: {
			budget: experienceBudget,
			spent: experienceSpent,
			remaining: experienceBudget - experienceSpent,
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

function rollD6(nextInt?: (sides: number) => number): number {
	if (nextInt) {
		return nextInt(6);
	}
	if (typeof crypto !== "undefined" && crypto.getRandomValues) {
		const buf = new Uint32Array(1);
		crypto.getRandomValues(buf);
		return ((buf[0] ?? 0) % 6) + 1;
	}
	return Math.floor(Math.random() * 6) + 1;
}

export function rollCoc7eAttribute(
	key: Coc7eAttributeKey,
	nextInt?: (sides: number) => number,
): number {
	if (key === "siz" || key === "int" || key === "edu") {
		return (rollD6(nextInt) + rollD6(nextInt) + 6) * 5;
	}
	return (rollD6(nextInt) + rollD6(nextInt) + rollD6(nextInt)) * 5;
}

export function rollAllCoc7eAttributes(
	nextInt?: (sides: number) => number,
): Coc7eAttributes {
	return {
		str: rollCoc7eAttribute("str", nextInt),
		con: rollCoc7eAttribute("con", nextInt),
		siz: rollCoc7eAttribute("siz", nextInt),
		dex: rollCoc7eAttribute("dex", nextInt),
		app: rollCoc7eAttribute("app", nextInt),
		int: rollCoc7eAttribute("int", nextInt),
		pow: rollCoc7eAttribute("pow", nextInt),
		edu: rollCoc7eAttribute("edu", nextInt),
		luck: rollCoc7eAttribute("luck", nextInt),
	};
}

export const COC7E_BACKGROUND_FIELD_META: ReadonlyArray<{
	key: Coc7eBackgroundFieldKey;
	label: string;
}> = [
	{ key: "ideologyBeliefs", label: "思想与信念" },
	{ key: "significantPeople", label: "重要之人" },
	{ key: "meaningfulLocations", label: "意义非凡之地" },
	{ key: "treasuredPossessions", label: "宝贵之物" },
	{ key: "traits", label: "特质" },
	{ key: "injuriesScars", label: "伤口和疤痕" },
	{ key: "phobiasManias", label: "恐惧症和躁狂症" },
	{ key: "appearanceSummary", label: "形象描述" },
];

export function serializeCoc7eBackground(
	profile: Coc7eProfileInfo,
	backgroundProfile: Coc7eBackgroundProfile,
	fallbackBackground = "",
): string {
	const lines: string[] = [];
	const identityBits = [
		profile.gender ? `性别：${profile.gender}` : "",
		profile.residence ? `住地：${profile.residence}` : "",
		profile.birthplace ? `故乡：${profile.birthplace}` : "",
	].filter(Boolean);
	if (identityBits.length > 0) {
		lines.push(identityBits.join(" · "));
	}
	for (const field of COC7E_BACKGROUND_FIELD_META) {
		const raw =
			field.key === "appearanceSummary"
				? backgroundProfile.appearanceSummary.trim() ||
					profile.appearance.trim()
				: backgroundProfile[field.key].trim();
		if (!raw) {
			continue;
		}
		const star =
			backgroundProfile.keyConnection === field.key ? " ★关键链接" : "";
		lines.push(`【${field.label}${star}】${raw}`);
	}
	if (backgroundProfile.partnerName.trim()) {
		lines.push(`【调查员伙伴】${backgroundProfile.partnerName.trim()}`);
	}
	if (backgroundProfile.keyConnectionStory.trim()) {
		lines.push(
			`【关键链接小传】${backgroundProfile.keyConnectionStory.trim()}`,
		);
	}
	if (lines.length === 0) {
		return fallbackBackground.slice(0, 4000);
	}
	return lines.join("\n").slice(0, 4000);
}
