import { dnd5r } from "@cogm/shared";
import { createElement, lazy, Suspense } from "react";
import { t } from "@/i18n";
import type { RuleComponent, RuleSessionState } from "@/rules/registry";
import { DndCharacterCreationEditor } from "./character-creation-editor";
import {
	ABILITIES,
	abilityLabel,
	backgroundLabel,
	checkLabel,
	classLabel,
	conditionLabel,
	damageLabel,
	SKILLS,
	signed,
	speciesLabel,
} from "./labels";

const DndSessionSheet = lazy(() =>
	import("./session-sheet").then((module) => ({
		default: module.DndSessionSheet,
	})),
);
const DndDiceTray = lazy(() =>
	import("./check-controls").then((module) => ({
		default: module.DndDiceTray,
	})),
);
const DndGmCheckPanel = lazy(() =>
	import("./check-controls").then((module) => ({
		default: module.DndGmCheckPanel,
	})),
);
const DndStateEditor = lazy(() =>
	import("./state-editor").then((module) => ({
		default: module.DndStateEditor,
	})),
);

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

function targetFor(sheet: dnd5r.CharacterSheet, key: string): number | null {
	const derived = dnd5r.deriveCharacter(sheet);
	if (key === "initiative") return derived.initiative;
	if (key === "death") return 0;
	const [kind, id] = key.split(":");
	if (kind === "ability" && dnd5r.ABILITIES.includes(id as dnd5r.Ability))
		return derived.abilityModifiers[id as dnd5r.Ability];
	if (kind === "save" && dnd5r.ABILITIES.includes(id as dnd5r.Ability))
		return derived.savingThrows[id as dnd5r.Ability];
	if (kind === "skill" && id && Object.hasOwn(dnd5r.SKILLS, id))
		return derived.skillModifiers[id as dnd5r.Skill];
	if (kind === "attack" && id)
		return (
			derived.attacks.find((attack) => attack.id === id)?.attackBonus ?? null
		);
	return null;
}

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
	skillKeys: () => [
		...ABILITIES.map((ability) => `ability:${ability}`),
		...ABILITIES.map((ability) => `save:${ability}`),
		...SKILLS.map((skill) => `skill:${skill}`),
		"initiative",
		"death",
	],
	skillTarget: (sheet, key) => {
		const parsed = parseSheet(sheet);
		return parsed ? targetFor(parsed, key) : null;
	},
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
	attributeKeys: () => ABILITIES.map((ability) => `abilities.${ability}`),
	attributeValues: (sheet) => parseSheet(sheet)?.abilities ?? {},
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
	attributePairs: () =>
		ABILITIES.map((ability) => ({
			key: ability,
			label: abilityLabel(ability),
			abbr: ability.toUpperCase(),
		})),
	difficultyLabel: () => t("dnd5r.check.d20"),
	difficultyThreshold: () => null,
	parseDifficulty: () => "regular",
	outcomeLabel: (outcome) => t(`dnd5r.outcome.${outcome}`),
	checkOutcome: (check) => {
		if (!check || typeof check !== "object" || !("success" in check))
			return null;
		return typeof check.success === "boolean" ? check.success : null;
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
	parseState: (state): RuleSessionState | null => {
		const parsed = parseState(state);
		if (!parsed) return null;
		return {
			hp: parsed.hp,
			maxHp: parsed.maxHp,
			mp: 0,
			maxMp: 0,
			san: 0,
			maxSan: 0,
			luck: 0,
			statuses: [
				...parsed.conditions,
				...(parsed.exhaustion > 0 ? [`exhaustion:${parsed.exhaustion}`] : []),
				...(parsed.deathSaves.stable ? ["stable"] : []),
				...(parsed.deathSaves.dead ? ["dead"] : []),
			],
			tags: [],
			growthMarks: [],
			hiddenGrowthMarks: [],
		};
	},
	luckSpendOptions: () => [],
	supportsLuck: false,
	supportsExcelImport: false,
	statusLabels: (statuses) =>
		statuses.map((status) => {
			if (status.startsWith("exhaustion:"))
				return t("dnd5r.state.exhaustionLevel", {
					level: status.split(":")[1] ?? 0,
				});
			if (status === "stable") return t("dnd5r.state.stable");
			if (status === "dead") return t("dnd5r.state.dead");
			return conditionLabel(status);
		}),
	statusLabelsOfState: (state) => {
		const full = parseState(state);
		const projected = full ?? parsePublicState(state);
		if (!projected) return [];
		return [
			...(projected.conditions ?? []).map(conditionLabel),
			...(projected.exhaustion
				? [t("dnd5r.state.exhaustionLevel", { level: projected.exhaustion })]
				: []),
			...(full?.deathSaves.stable ? [t("dnd5r.state.stable")] : []),
			...(full?.deathSaves.dead ? [t("dnd5r.state.dead")] : []),
		];
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
	statusOptions: () =>
		dnd5r.CONDITIONS.map((condition) => ({
			value: condition,
			label: conditionLabel(condition),
		})),
	skillCatalog: SKILLS.map((skill) => ({ key: `skill:${skill}`, base: 0 })),
	deriveStats: (sheet) => {
		const parsed = parseSheet(sheet);
		const derived = parsed ? dnd5r.deriveCharacter(parsed) : null;
		return {
			hp: { current: derived?.maxHp ?? 1, max: derived?.maxHp ?? 1 },
			mp: { current: 0, max: 0 },
			san: { current: 0, max: 0 },
			luck: 0,
			mov: derived?.speed ?? 30,
		};
	},
	sheetOverview: (sheet) => {
		const parsed = parseSheet(sheet);
		return parsed
			? {
					profession: `${classLabel(parsed)} · ${parsed.level}`,
					era: `${speciesLabel(parsed)} · ${backgroundLabel(parsed)}`,
					age: null,
				}
			: null;
	},
	sheetSections: (sheet) => {
		const parsed = parseSheet(sheet);
		if (!parsed) return [];
		const derived = dnd5r.deriveCharacter(parsed);
		return [
			{
				id: "combat",
				title: t("dnd5r.review.attacks"),
				rows: [
					{ label: "HP", value: String(derived.maxHp) },
					{ label: "AC", value: String(derived.armorClass) },
					{ label: t("dnd5r.derived.speed"), value: String(derived.speed) },
				],
				items: derived.attacks.map((attack) => ({
					name: attack.name,
					lines: [
						`${signed(attack.attackBonus)} · ${attack.damage.count}d${attack.damage.sides}${signed(attack.damageBonus)} ${damageLabel(attack.damage.type)}`,
					],
				})),
			},
			{
				id: "spells",
				title: t("dnd5r.spells.title"),
				rows:
					derived.spellSaveDc === null
						? []
						: [
								{
									label: t("dnd5r.spells.saveDc"),
									value: String(derived.spellSaveDc),
								},
							],
				items: [
					...parsed.spellIds.map((id) => ({
						name: dnd5r.SPELLS[id]?.name ?? id,
						lines: [
							`${t("dnd5r.spells.level", { level: dnd5r.SPELLS[id]?.level ?? 0 })} · ${dnd5r.SPELLS[id]?.school ?? ""}`,
						],
					})),
					...parsed.customSpells.map((spell) => ({
						name: spell.name,
						lines: [t("dnd5r.spells.level", { level: spell.level })],
					})),
				],
			},
			{
				id: "equipment",
				title: t("dnd5r.tabs.equipment"),
				rows: [],
				items: parsed.inventory.map((item) => ({
					name: item.name,
					lines: [String(item.quantity)],
				})),
			},
			{
				id: "notes",
				title: t("dnd5r.details.notesTitle"),
				rows: [],
				items: [
					...parsed.feats.map((feat) => ({ name: feat, lines: [] })),
					...(parsed.notes
						? [{ name: t("dnd5r.details.notesTitle"), lines: [parsed.notes] }]
						: []),
				],
			},
		].filter((section) => section.rows.length > 0 || section.items.length > 0);
	},
	attributeOrder: () => [...ABILITIES],
	sessionSheet: (props) =>
		createElement(
			Suspense,
			{ fallback: null },
			createElement(DndSessionSheet, props),
		),
	diceTray: (props) =>
		createElement(
			Suspense,
			{ fallback: null },
			createElement(DndDiceTray, props),
		),
	checkPanel: (props) =>
		createElement(
			Suspense,
			{ fallback: null },
			createElement(DndGmCheckPanel, props),
		),
	stateEditor: (props) =>
		createElement(
			Suspense,
			{ fallback: null },
			createElement(DndStateEditor, props),
		),
	checkRequestDescription: (request) => {
		const options = dnd5r.CheckOptions.safeParse(request.options);
		const parts = [checkLabel(request.skillKey)];
		if (options.success) {
			parts.push(t(`dnd5r.check.mode.${options.data.mode ?? "normal"}`));
			if (options.data.dc !== undefined) parts.push(`DC ${options.data.dc}`);
		}
		return parts.join(" · ");
	},
	parseD20Check: (value) => {
		const parsed = dnd5r.CheckResult.safeParse(value);
		return parsed.success ? parsed.data : null;
	},
	d20ModeLabel: (mode) => t(`dnd5r.check.mode.${mode}`),
	damageTypeLabel: damageLabel,
};
