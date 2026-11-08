import { COC7E_OCCUPATION_DATA } from "./occupation-data";
import type { Coc7eOccupation } from "./sheet";
import {
	COC7E_ATTRIBUTE_LABELS,
	COC7E_SKILL_GROUP_ALIASES,
	canonicalizeCoc7eSkillKey,
	coc7eSkillFamily,
} from "./skills";

export interface Coc7eOccupationChoiceGroup {
	id: string;
	label: string;
	choose: number;
	pool: string[];
}

export interface Coc7eOccupationDefinition {
	id: string;
	name: string;
	era: "any" | "classic" | "modern";
	creditMin: number;
	creditMax: number;
	skillPointOptions: Coc7eOccupation["skillPointFormula"][];
	fixedSkillKeys: string[];
	choiceGroups: Coc7eOccupationChoiceGroup[];
	anySkillCount: number;
}

export const COC7E_OCCUPATIONS: readonly Coc7eOccupationDefinition[] =
	COC7E_OCCUPATION_DATA;

export function coc7eOccupation(
	presetId: string | null | undefined,
): Coc7eOccupationDefinition | null {
	if (!presetId) {
		return null;
	}
	return COC7E_OCCUPATIONS.find((item) => item.id === presetId) ?? null;
}

export function coc7eOccupationFamilies(): readonly string[] {
	return Object.keys(COC7E_SKILL_GROUP_ALIASES);
}

export function coc7eSkillPointFormulaLabel(
	formula: Coc7eOccupation["skillPointFormula"],
): string {
	return formula
		.map(
			(term) =>
				`${COC7E_ATTRIBUTE_LABELS[term.attribute]?.label ?? term.attribute}×${term.multiplier}`,
		)
		.join("＋");
}

export function coc7eOccupationSkillPointOptionsLabel(
	definition: Coc7eOccupationDefinition,
): string {
	return definition.skillPointOptions
		.map((option) => coc7eSkillPointFormulaLabel(option))
		.join(" 或 ");
}

export function coc7eOccupationSkillPointTotal(
	definition: Coc7eOccupationDefinition,
	attributes: Record<string, number>,
): number {
	const options = definition.skillPointOptions.map((option) =>
		option.reduce(
			(total, term) =>
				total + (attributes[term.attribute] ?? 0) * term.multiplier,
			0,
		),
	);
	return options.length === 0 ? 0 : Math.max(...options);
}

function poolEntryMatches(entry: string, skillKey: string): boolean {
	const canonicalEntry = canonicalizeCoc7eSkillKey(entry) ?? entry.trim();
	const canonicalSkill = canonicalizeCoc7eSkillKey(skillKey) ?? skillKey.trim();
	if (canonicalEntry === canonicalSkill) {
		return true;
	}
	if (/[（(]/.test(entry)) {
		return false;
	}
	const family = coc7eSkillFamily(entry);
	if (!family) {
		return false;
	}
	return coc7eSkillFamily(canonicalSkill) === family;
}

export function coc7eOccupationSkillSelection(
	occupation: Coc7eOccupation,
): string[] {
	const definition = coc7eOccupation(occupation.presetId);
	if (!definition) {
		return occupation.skillKeys.map(
			(key) => canonicalizeCoc7eSkillKey(key) ?? key.trim(),
		);
	}
	const selected: string[] = [];
	for (const group of definition.choiceGroups) {
		for (const key of occupation.choiceSelections[group.id] ?? []) {
			const canonical = canonicalizeCoc7eSkillKey(key) ?? key.trim();
			if (canonical !== "") {
				selected.push(canonical);
			}
		}
	}
	for (const key of occupation.freeSkillKeys) {
		const canonical = canonicalizeCoc7eSkillKey(key) ?? key.trim();
		if (canonical !== "") {
			selected.push(canonical);
		}
	}
	return selected;
}

export function coc7eOccupationSkillKeys(
	occupation: Coc7eOccupation,
): string[] {
	const definition = coc7eOccupation(occupation.presetId);
	const fixed = definition
		? definition.fixedSkillKeys
		: occupation.skillKeys.map(
				(key) => canonicalizeCoc7eSkillKey(key) ?? key.trim(),
			);
	return [...new Set([...fixed, ...coc7eOccupationSkillSelection(occupation)])];
}

export function coc7eIsOccupationalSkill(
	occupation: Coc7eOccupation,
	skillKey: string,
): boolean {
	if (skillKey === "信用评级") {
		return true;
	}
	return coc7eOccupationSkillKeys(occupation).some((entry) =>
		poolEntryMatches(entry, skillKey),
	);
}

export function coc7eOccupationFreeSkillSlots(
	occupation: Coc7eOccupation,
): number {
	const definition = coc7eOccupation(occupation.presetId);
	return definition ? definition.anySkillCount : 0;
}

export function coc7eOccupationSkillPointFormula(
	occupation: Coc7eOccupation,
): Coc7eOccupation["skillPointFormula"] {
	const definition = coc7eOccupation(occupation.presetId);
	if (definition && definition.skillPointOptions.length > 0) {
		return occupation.skillPointFormula.length > 0
			? occupation.skillPointFormula
			: (definition.skillPointOptions[0] ?? []);
	}
	return occupation.skillPointFormula;
}
