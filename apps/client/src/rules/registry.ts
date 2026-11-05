import type { RuleMetadata } from "@cogm/shared";
import { coc7e } from "@cogm/shared";

export type RuleSheetEditorProps = {
	sheet: unknown;
	onChange: (sheet: unknown) => void;
	readOnly?: boolean;
};

export type RuleDerivedStats = {
	hp: { current: number; max: number };
	mp: { current: number; max: number };
	san: { current: number; max: number };
	luck: number;
	mov: number;
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
	createEmptySheet: () => unknown;
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
	createEmptySheet: () => ({
		attributes: {
			str: 50,
			con: 50,
			siz: 50,
			dex: 50,
			app: 50,
			int: 50,
			pow: 50,
			edu: 50,
			luck: 50,
		},
		skills: {},
	}),
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
		const attributes = readAttributes(sheet);
		const con = attributes.con ?? 0;
		const siz = attributes.siz ?? 0;
		const pow = attributes.pow ?? 0;
		const str = attributes.str ?? 0;
		const dex = attributes.dex ?? 0;
		const hpMax = Math.max(1, Math.floor((con + siz) / 10));
		const mpMax = Math.max(0, Math.floor(pow / 5));
		return {
			hp: { current: hpMax, max: hpMax },
			mp: { current: mpMax, max: mpMax },
			san: { current: pow, max: pow },
			luck: attributes.luck ?? 0,
			mov: coc7eMovement(str, dex, siz),
		};
	},
	attributeOrder: () => COC7E_ATTRIBUTE_ORDER.map(({ key }) => key),
};

function coc7eMovement(str: number, dex: number, siz: number): number {
	if (str >= siz && dex >= siz) {
		return 9;
	}
	if (str >= siz || dex >= siz) {
		return 8;
	}
	return 7;
}

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
