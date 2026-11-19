import { dnd5r } from "@cogm/shared";
import { t } from "@/i18n";
import type { RuleComponent } from "../types";
import { DndCharacterCreationEditor } from "./character-creation-editor";
import { DndCheckCard } from "./check-card";
import { DndDiceTray, DndGmCheckPanel } from "./check-controls";
import {
	buildCheckDiceAnimation,
	formatCheckEvent,
	formatCheckRequest,
} from "./check-view";
import {
	ABILITIES,
	abilityLabel,
	backgroundLabel,
	checkLabel,
	classLabel,
	conditionLabel,
	SKILLS,
	speciesLabel,
} from "./labels";
import { DndSessionSheet } from "./session-sheet";
import { DndStateEditor } from "./state-editor";

function parseSheet(value: unknown): dnd5r.CharacterSheet | null {
	const parsed = dnd5r.CharacterSheet.safeParse(value);
	return parsed.success ? parsed.data : null;
}

function parseState(value: unknown): dnd5r.SessionState | null {
	const parsed = dnd5r.SessionState.safeParse(value);
	return parsed.success ? parsed.data : null;
}
function parsePublicState(value: unknown): dnd5r.PublicSessionState | null {
	const parsed = dnd5r.PublicSessionState.safeParse(value);
	return parsed.success ? parsed.data : null;
}

function stateLabels(
	state: dnd5r.PublicSessionState,
	deathSaves?: dnd5r.SessionState["deathSaves"],
): string[] {
	return [
		...(state.conditions ?? []).map(conditionLabel),
		...(state.exhaustion
			? [t("dnd5r.state.exhaustionLevel", { level: state.exhaustion })]
			: []),
		...(deathSaves?.stable ? [t("dnd5r.state.stable")] : []),
		...(deathSaves?.dead ? [t("dnd5r.state.dead")] : []),
	];
}
const conditionWeight: Partial<
	Record<dnd5r.SessionState["conditions"][number], number>
> = { unconscious: 80, petrified: 75, incapacitated: 60 };

export const dnd5rComponent: RuleComponent = {
	metadata: {
		id: "dnd5r",
		name: "Dungeons & Dragons 2024",
		version: "1.0.0",
		apiVersion: 1,
		description: "D&D 2024 (5R) SRD 5.2.1 character building and play",
		permanentSheetFields: ABILITIES.map((ability) => `abilities.${ability}`),
	},
	createEmptySheet: dnd5r.createBlankSheet,
	creationEditor: DndCharacterCreationEditor,
	backgroundSource: "profile",
	parseSheet,
	parseSheetJson: (json) => {
		try {
			return parseSheet(JSON.parse(json));
		} catch {
			return null;
		}
	},
	skillLabel: checkLabel,
	attributeEntries: (sheet) => {
		const parsed = parseSheet(sheet);
		if (!parsed) return [];
		const derived = dnd5r.deriveCharacter(parsed);
		return ABILITIES.map((ability) => ({
			key: `abilities.${ability}`,
			label: abilityLabel(ability),
			value: derived.abilities[ability],
		}));
	},
	attributeLabel: (key) =>
		dnd5r.ABILITIES.includes(key.replace("abilities.", "") as dnd5r.Ability)
			? abilityLabel(key.replace("abilities.", ""))
			: null,
	attributePair: (key) => {
		const ability = key.replace("abilities.", "");
		return dnd5r.ABILITIES.includes(ability as dnd5r.Ability)
			? { key, label: abilityLabel(ability), abbr: ability.toUpperCase() }
			: null;
	},
	skillEntries: (sheet) => {
		const parsed = parseSheet(sheet);
		if (!parsed) return [];
		const derived = dnd5r.deriveCharacter(parsed);
		return SKILLS.map((skill) => ({
			key: `skill:${skill}`,
			value: derived.skillModifiers[skill],
		}));
	},
	stateSummary: (state) => {
		const full = parseState(state);
		if (full)
			return `HP ${full.hp}/${full.maxHp}${full.tempHp ? ` +${full.tempHp}` : ""}`;
		const projected = parsePublicState(state);
		if (!projected) return null;
		const parts = [
			projected.hp !== undefined && projected.maxHp !== undefined
				? `HP ${projected.hp}/${projected.maxHp}`
				: null,
			projected.tempHp !== undefined
				? `${t("dnd5r.state.tempHp")} ${projected.tempHp}`
				: null,
		].filter((part) => part !== null);
		return parts.length > 0 ? parts.join(" · ") : null;
	},
	stateFieldLabel: (key) => t(`dnd5r.state.field.${key}`),
	statusLabelsOfState: (state) => {
		const full = parseState(state);
		const projected = full ?? parsePublicState(state);
		return projected ? stateLabels(projected, full?.deathSaves) : [];
	},
	stateBars: (state) => {
		const projected = parseState(state) ?? parsePublicState(state);
		if (!projected) return [];
		const bars = [];
		if (projected.hp !== undefined && projected.maxHp !== undefined)
			bars.push({
				key: "hp",
				label: "HP",
				current: projected.hp,
				max: projected.maxHp,
				barClassName: "bg-brand-shu",
			});
		if (projected.tempHp !== undefined)
			bars.push({
				key: "tempHp",
				label: t("dnd5r.state.tempHp"),
				current: projected.tempHp,
				max: Math.max(1, projected.tempHp),
				barClassName: "bg-brand-fuji",
			});
		return bars;
	},
	publicStateOptions: () => [
		{ value: "hp", label: "HP" },
		{ value: "tempHp", label: t("dnd5r.state.tempHp") },
		{ value: "conditions", label: t("dnd5r.state.conditions") },
	],
	summaryMetrics: (sheet) => {
		const parsed = parseSheet(sheet);
		if (!parsed) return [];
		const { maxHp, armorClass, speed } = dnd5r.deriveCharacter(parsed);
		return [
			{ key: "hp", label: "HP", value: `${maxHp}/${maxHp}` },
			{ key: "ac", label: "AC", value: String(armorClass) },
			{ key: "speed", label: t("dnd5r.derived.speed"), value: String(speed) },
		];
	},
	sheetOverview: (sheet) => {
		const parsed = parseSheet(sheet);
		return parsed
			? [
					{
						label: t("dnd5r.concept.class"),
						value: `${classLabel(parsed)} · ${parsed.level}`,
					},
					{
						label: t("dnd5r.concept.species"),
						value: `${speciesLabel(parsed)} · ${backgroundLabel(parsed)}`,
					},
				]
			: [];
	},
	stateHealthScore: (value) => {
		const state = parseState(value);
		if (!state) return 0;
		const status = state.conditions.reduce(
			(max, flag) => Math.max(max, conditionWeight[flag] ?? 10),
			state.exhaustion > 0 || state.deathSaves.stable ? 10 : 0,
		);
		const severity = state.deathSaves.dead
			? 100
			: state.hp === 0 && !state.deathSaves.stable
				? 90
				: status;
		return severity + (1 - state.hp / state.maxHp) * 40;
	},
	gmStateSummaryLines: (value) => {
		const state = parseState(value);
		if (!state) return [];
		const lines = stateLabels(state, state.deathSaves);
		lines.push(`HP ${state.hp} / ${state.maxHp}`);
		if (state.tempHp > 0)
			lines.push(`${t("dnd5r.state.tempHp")} ${state.tempHp}`);
		return lines;
	},
	sessionSheet: DndSessionSheet,
	diceTray: DndDiceTray,
	checkPanel: DndGmCheckPanel,
	stateEditor: DndStateEditor,
	formatCheckRequest,
	formatCheckEvent,
	buildCheckDiceAnimation,
	renderCheckCardExtra: DndCheckCard,
};
