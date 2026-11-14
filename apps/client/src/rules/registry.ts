import type { CharacterSheetContextResponse, RuleMetadata } from "@cogm/shared";
import { coc7e } from "@cogm/shared";
import type { ReactNode } from "react";
import { Coc7eCharacterCreationEditor } from "./coc7e/character-creation-editor";

export type RuleSheetEditorProps = {
	sheet: unknown;
	onChange: (sheet: unknown) => void;
	readOnly?: boolean;
};

export type RuleCreationEditorProps = {
	sheet: coc7e.Coc7eCharacterSheet;
	onChange: (sheet: coc7e.Coc7eCharacterSheet) => void;
	showValidation: boolean;
	onValidityChange: (valid: boolean) => void;
	onWarningsChange?: (count: number) => void;
	characterName?: string;
	onCharacterNameChange?: (name: string) => void;
	background?: string;
	onBackgroundChange?: (background: string) => void;
	portraitPreviewUrl?: string | null;
	portraitPending?: boolean;
	onPickPortraitFile?: (file: File) => void;
	onClearPendingPortrait?: () => void;
	onManageExpressions?: () => void;
	sheetContext?: CharacterSheetContextResponse | null;
	onSubmitAction?: () => void;
	submitLabel?: string;
	submitPending?: boolean;
	identityHeaderSlot?: ReactNode;
	children?: ReactNode;
};

export type RuleDerivedStats = {
	hp: { current: number; max: number };
	mp: { current: number; max: number };
	san: { current: number; max: number };
	luck: number;
	mov: number;
	damageBonus?: string;
	build?: number;
	majorWound?: number;
};

export type RuleSheetOverview = {
	profession: string | null;
	era: string | null;
	age: number | null;
};

export type RuleSheetSection = {
	id: string;
	title: string;
	rows: Array<{ label: string; value: string }>;
	items: Array<{ name: string; lines: string[] }>;
};

export type RuleSessionState = {
	hp: number;
	maxHp: number;
	mp: number;
	maxMp: number;
	san: number;
	maxSan: number;
	statuses: string[];
	tags: string[];
	growthMarks: string[];
	hiddenGrowthMarks: string[];
};

export type RuleStateBar = {
	key: string;
	label: string;
	current: number;
	max: number;
	barClassName: string;
};

export type RuleComponent = {
	metadata: RuleMetadata;
	createEmptySheet: () => coc7e.Coc7eCharacterSheet;
	creationEditor: (props: RuleCreationEditorProps) => ReactNode;
	serializeBackground?: (sheet: unknown, fallbackBackground: string) => string;
	parseSheet: (value: unknown) => unknown | null;
	parseSheetJson: (json: string) => unknown | null;
	skillLabel: (key: string) => string;
	skillKeys: (sheet: unknown) => string[];
	skillTarget: (sheet: unknown, skillKey: string) => number | null;
	attributeEntries: (sheet: unknown) => Array<{
		key: string;
		label: string;
		value: number;
	}>;
	attributeLabel: (key: string) => string | null;
	attributeKeys: (sheet: unknown) => string[];
	attributeValues: (sheet: unknown) => Record<string, number>;
	attributePair: (
		key: string,
	) => { key: string; label: string; abbr: string } | null;
	skillEntries: (sheet: unknown) => Array<{ key: string; value: number }>;
	attributePairs: () => Array<{ key: string; label: string; abbr: string }>;
	difficultyLabel: (difficulty: string) => string;
	difficultyThreshold: (target: number, difficulty: string) => number | null;
	parseDifficulty: (value: unknown) => string | null;
	outcomeLabel: (outcome: string) => string;
	checkOutcome: (check: unknown) => boolean | null;
	stateSummary: (state: unknown) => string | null;
	parseState: (state: unknown) => RuleSessionState | null;
	statusLabels: (statuses: string[]) => string[];
	statusLabelsOfState: (state: unknown) => string[];
	stateBars: (state: unknown) => RuleStateBar[];
	publicStateOptions: () => Array<{ value: string; label: string }>;
	statusOptions: () => Array<{ value: string; label: string }>;
	skillCatalog: ReadonlyArray<{ key: string; base: number }>;
	deriveStats: (sheet: unknown) => RuleDerivedStats;
	sheetOverview: (sheet: unknown) => RuleSheetOverview | null;
	sheetSections: (sheet: unknown) => RuleSheetSection[];
	attributeOrder: () => string[];
};

const COC7E_STATUS_LABELS = coc7e.CharacterStatusFlagLabel as Record<
	string,
	string
>;

function coc7eStateView(state: unknown) {
	const full = coc7e.CharacterSessionState.safeParse(state);
	if (full.success) {
		return full.data;
	}
	const partial = coc7e.CharacterPublicSessionState.safeParse(state);
	return partial.success ? partial.data : null;
}

const coc7eStateBars = (state: unknown): RuleStateBar[] => {
	const view = coc7eStateView(state);
	if (!view) {
		return [];
	}
	const bars: RuleStateBar[] = [];
	if (view.hp !== undefined && view.maxHp !== undefined) {
		bars.push({
			key: "hp",
			label: "HP",
			current: view.hp,
			max: view.maxHp,
			barClassName: "bg-danger",
		});
	}
	if (view.mp !== undefined && view.maxMp !== undefined) {
		bars.push({
			key: "mp",
			label: "MP",
			current: view.mp,
			max: view.maxMp,
			barClassName: "bg-brand-sora",
		});
	}
	if (view.san !== undefined && view.maxSan !== undefined) {
		bars.push({
			key: "san",
			label: "SAN",
			current: view.san,
			max: view.maxSan,
			barClassName: "bg-brand-fuji",
		});
	}
	return bars;
};

const coc7eComponent: RuleComponent = {
	metadata: {
		id: "coc7e",
		name: "克苏鲁的呼唤 7 版",
		version: "1.0.0",
		apiVersion: 1,
		description: "CoC 7e 属性、技能与理智检定",
		permanentSheetFields: [
			"str",
			"con",
			"siz",
			"dex",
			"app",
			"int",
			"pow",
			"edu",
			"luck",
		],
	},
	createEmptySheet: () =>
		coc7e.createEmptyCoc7eSheet({
			str: 50,
			con: 50,
			siz: 50,
			dex: 50,
			app: 50,
			int: 50,
			pow: 50,
			edu: 50,
			luck: 50,
		}),
	creationEditor: Coc7eCharacterCreationEditor,
	serializeBackground: (sheet, fallbackBackground) => {
		const parsed = coc7e.Coc7eCharacterSheet.safeParse(sheet);
		if (!parsed.success) {
			return fallbackBackground;
		}
		return coc7e.serializeCoc7eBackground(
			parsed.data.profile,
			parsed.data.backgroundProfile,
			fallbackBackground,
		);
	},
	parseSheet: (value) => {
		const parsed = coc7e.Coc7eCharacterSheet.safeParse(value);
		return parsed.success ? parsed.data : null;
	},
	parseSheetJson: (json) => {
		try {
			const parsed = coc7e.Coc7eCharacterSheet.safeParse(JSON.parse(json));
			return parsed.success ? parsed.data : null;
		} catch {
			return null;
		}
	},
	skillLabel: (key) => coc7e.coc7eSkillLabel(key),
	skillKeys: (sheet) => Object.keys(readSkills(sheet)),
	skillTarget: (sheet, skillKey) => {
		const parsed = coc7e.Coc7eCharacterSheet.safeParse(sheet);
		return parsed.success
			? coc7e.coc7eSkillTargetValue(parsed.data, skillKey)
			: null;
	},
	attributeEntries: (sheet) => {
		const attributes = readAttributes(sheet);
		return COC7E_ATTRIBUTE_ORDER.map(({ key }) => ({
			key,
			label: coc7e.COC7E_ATTRIBUTE_LABELS[key]?.label ?? key,
			value: attributes[key] ?? 0,
		}));
	},
	attributeLabel: (key) => coc7e.COC7E_ATTRIBUTE_LABELS[key]?.label ?? null,
	attributeKeys: (sheet) => Object.keys(readAttributes(sheet)),
	attributeValues: (sheet) => readAttributes(sheet),
	attributePair: (key) => {
		const entry = coc7e.COC7E_ATTRIBUTE_LABELS[key];
		return entry ? { key, label: entry.label, abbr: entry.abbr } : null;
	},
	skillEntries: (sheet) =>
		Object.entries(readSkills(sheet)).map(([key, value]) => ({
			key,
			value,
		})),
	attributePairs: () =>
		COC7E_ATTRIBUTE_ORDER.map(({ key }) => ({
			key,
			label: coc7e.COC7E_ATTRIBUTE_LABELS[key]?.label ?? key,
			abbr: coc7e.COC7E_ATTRIBUTE_LABELS[key]?.abbr ?? key.toUpperCase(),
		})),
	difficultyLabel: (difficulty) =>
		(coc7e.CheckDifficultyLabel as Record<string, string>)[difficulty] ??
		difficulty,
	difficultyThreshold: (target, difficulty) => {
		const parsed = coc7e.CheckDifficulty.safeParse(difficulty);
		return parsed.success
			? coc7e.coc7eDifficultyThreshold(target, parsed.data)
			: null;
	},
	parseDifficulty: (value) => {
		const parsed = coc7e.CheckDifficulty.safeParse(value);
		return parsed.success ? parsed.data : null;
	},
	outcomeLabel: (outcome) =>
		(coc7e.CheckOutcomeLabel as Record<string, string>)[outcome] ?? outcome,
	statusLabels: (statuses) =>
		statuses.map((flag) => COC7E_STATUS_LABELS[flag] ?? flag),
	statusLabelsOfState: (state) => {
		const view = coc7eStateView(state);
		return (view?.statuses ?? []).map(
			(flag) => COC7E_STATUS_LABELS[flag] ?? flag,
		);
	},
	stateBars: coc7eStateBars,
	publicStateOptions: () => [
		{ value: "hp", label: "HP" },
		{ value: "mp", label: "MP" },
		{ value: "san", label: "SAN" },
		{ value: "statuses", label: "状态标记" },
	],
	statusOptions: () =>
		Object.entries(COC7E_STATUS_LABELS).map(([value, label]) => ({
			value,
			label,
		})),
	checkOutcome: (check) => {
		if (!check || typeof check !== "object" || !("success" in check)) {
			return null;
		}
		const success = (check as { success?: unknown }).success;
		return typeof success === "boolean" ? success : null;
	},
	stateSummary: (state) => coc7e.coc7eStateSummary(state),
	parseState: (state) => {
		const parsed = coc7e.CharacterSessionState.safeParse(state);
		if (!parsed.success) {
			return null;
		}
		const value = parsed.data;
		return {
			hp: value.hp,
			maxHp: value.maxHp,
			mp: value.mp,
			maxMp: value.maxMp,
			san: value.san,
			maxSan: value.maxSan,
			statuses: value.statuses,
			tags: value.tags,
			growthMarks: value.growthMarks,
			hiddenGrowthMarks: value.hiddenGrowthMarks,
		};
	},
	skillCatalog: coc7e.COC7E_SKILL_CATALOG.map(({ key, base }) => ({
		key,
		base,
	})),
	deriveStats: (sheet) => {
		const parsed = coc7e.Coc7eCharacterSheet.safeParse(sheet);
		if (!parsed.success) {
			return {
				hp: { current: 1, max: 1 },
				mp: { current: 0, max: 0 },
				san: { current: 0, max: 0 },
				luck: 0,
				mov: 1,
			};
		}
		const derived = coc7e.deriveCoc7eSheetStats(parsed.data);
		return {
			hp: { current: derived.maxHp, max: derived.maxHp },
			mp: { current: derived.maxMp, max: derived.maxMp },
			san: { current: derived.initialSan, max: derived.maxSan },
			luck: parsed.data.attributes.luck,
			mov: derived.mov,
			damageBonus: derived.damageBonus,
			build: derived.build,
			majorWound: derived.majorWoundThreshold,
		};
	},
	sheetOverview: (sheet) => {
		const parsed = coc7e.Coc7eCharacterSheet.safeParse(sheet);
		if (!parsed.success) {
			return null;
		}
		return {
			profession: parsed.data.occupation.name || null,
			era:
				parsed.data.era === "modern"
					? "现代"
					: parsed.data.era === "1920s"
						? "1920 年代"
						: null,
			age: parsed.data.age,
		};
	},
	sheetSections: (sheet) => {
		const parsed = coc7e.Coc7eCharacterSheet.safeParse(sheet);
		if (!parsed.success) {
			return [];
		}
		const value = parsed.data;
		const sections: RuleSheetSection[] = [];
		const combatItems = value.weapons.map((weapon) => ({
			name: weapon.name,
			lines: [
				`${weapon.skillKey} · ${weapon.damage}`,
				[
					weapon.range,
					weapon.attacks ? `${weapon.attacks} 次` : "",
					weapon.ammo === null ? "" : `装弹 ${weapon.ammo}`,
					weapon.malfunction === null ? "" : `故障 ${weapon.malfunction}`,
				]
					.filter(Boolean)
					.join(" · "),
			].filter(Boolean),
		}));
		if (combatItems.length > 0 || value.armor.name) {
			sections.push({
				id: "combat",
				title: "战斗与装备",
				rows: [
					{ label: "护甲", value: value.armor.name || "无" },
					{ label: "护甲值", value: String(value.armor.value) },
					{ label: "覆盖部位", value: value.armor.locations || "—" },
				],
				items: [
					...combatItems,
					...value.gear.map((item) => ({
						name: item.name,
						lines: [`数量 ${item.quantity}`],
					})),
				],
			});
		}
		const assetRows = [
			{ label: "货币", value: value.assets.currency },
			{ label: "消费水平", value: String(value.assets.spendingLevel) },
			{ label: "现金", value: String(value.assets.cash) },
			{ label: "其他资产", value: String(value.assets.otherAssets) },
		];
		const assetItems = value.assets.details.map((detail) => ({
			name: detail.name,
			lines: [detail.category, String(detail.value)],
		}));
		if (
			value.assets.cash > 0 ||
			value.assets.otherAssets > 0 ||
			assetItems.length > 0
		) {
			sections.push({
				id: "assets",
				title: "信用与资产",
				rows: assetRows,
				items: assetItems,
			});
		}
		const magicItems = [
			...value.spells.map((spell) => ({
				name: spell.name,
				lines: [
					[
						spell.mpCost ? `${spell.mpCost} MP` : "",
						spell.sanCost ? `${spell.sanCost} SAN` : "",
					]
						.filter(Boolean)
						.join(" · "),
					spell.castingTime,
					spell.effect,
				].filter(Boolean),
			})),
			...value.mythosTomes.map((tome) => ({
				name: tome.name,
				lines: [
					`SAN ${tome.sanLoss} · 神话 +${tome.mythosGain}`,
					tome.spells,
				].filter(Boolean),
			})),
			...value.encounters.map((encounter) => ({
				name: encounter.name,
				lines: [
					`SAN ${encounter.sanLoss} · 神话 +${encounter.mythosGain}`,
					encounter.notes,
				].filter(Boolean),
			})),
		];
		if (magicItems.length > 0) {
			sections.push({
				id: "magic",
				title: "法术与神话",
				rows: [],
				items: magicItems,
			});
		}
		return sections;
	},
	attributeOrder: () => COC7E_ATTRIBUTE_ORDER.map(({ key }) => key),
};

const COC7E_ATTRIBUTE_ORDER: ReadonlyArray<{ key: string }> = [
	{ key: "str" },
	{ key: "con" },
	{ key: "siz" },
	{ key: "dex" },
	{ key: "app" },
	{ key: "int" },
	{ key: "pow" },
	{ key: "edu" },
	{ key: "luck" },
];

function readAttributes(sheet: unknown): Record<string, number> {
	if (!sheet || typeof sheet !== "object") {
		return {};
	}
	const attributes = (sheet as { attributes?: unknown }).attributes;
	return attributes && typeof attributes === "object"
		? (attributes as Record<string, number>)
		: {};
}

function readSkills(sheet: unknown): Record<string, number> {
	if (!sheet || typeof sheet !== "object") {
		return {};
	}
	const skills = (sheet as { skills?: unknown }).skills;
	return skills && typeof skills === "object"
		? (skills as Record<string, number>)
		: {};
}

const registry = new Map<string, RuleComponent>([
	[coc7eComponent.metadata.id, coc7eComponent],
]);

export const FALLBACK_RULE_ID = coc7eComponent.metadata.id;

export function getRuleComponent(
	ruleId: string | null | undefined,
): RuleComponent {
	if (ruleId) {
		const found = registry.get(ruleId);
		if (found) {
			return found;
		}
	}
	return coc7eComponent;
}

export function registerRuleComponent(component: RuleComponent): void {
	registry.set(component.metadata.id, component);
}

export function listRuleComponents(): RuleComponent[] {
	return [...registry.values()];
}

export const fallbackRuleComponent = coc7eComponent;
