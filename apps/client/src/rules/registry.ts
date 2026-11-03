import type { RuleMetadata } from "@cogm/shared";
import { coc7e } from "@cogm/shared";

export type RuleSheetEditorProps = {
	sheet: unknown;
	onChange: (sheet: unknown) => void;
	readOnly?: boolean;
};

export type RuleComponent = {
	metadata: RuleMetadata;
	createEmptySheet: () => unknown;
	parseSheet: (value: unknown) => unknown | null;
	parseSheetJson: (json: string) => unknown | null;
	skillLabel: (key: string) => string;
	skillKeys: (sheet: unknown) => string[];
	attributeEntries: (sheet: unknown) => Array<{
		key: string;
		label: string;
		value: number;
	}>;
	difficultyLabel: (difficulty: string) => string;
	outcomeLabel: (outcome: string) => string;
	statusLabels: (statuses: string[]) => string[];
	statusOptions: () => Array<{ value: string; label: string }>;
	checkOutcome: (check: unknown) => boolean | null;
};

const COC7E_STATUS_LABELS = coc7e.CharacterStatusFlagLabel as Record<
	string,
	string
>;

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
	attributeEntries: (sheet) => {
		const attributes = readAttributes(sheet);
		return ATTRIBUTE_ORDER.map(({ key, label }) => ({
			key,
			label,
			value: attributes[key] ?? 0,
		}));
	},
	difficultyLabel: (difficulty) =>
		(coc7e.CheckDifficultyLabel as Record<string, string>)[difficulty] ??
		difficulty,
	outcomeLabel: (outcome) =>
		(coc7e.CheckOutcomeLabel as Record<string, string>)[outcome] ?? outcome,
	statusLabels: (statuses) =>
		statuses.map((flag) => COC7E_STATUS_LABELS[flag] ?? flag),
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
};

const ATTRIBUTE_ORDER: ReadonlyArray<{ key: string; label: string }> = [
	{ key: "str", label: "力量" },
	{ key: "con", label: "体质" },
	{ key: "siz", label: "体型" },
	{ key: "dex", label: "敏捷" },
	{ key: "app", label: "外貌" },
	{ key: "int", label: "智力" },
	{ key: "pow", label: "意志" },
	{ key: "edu", label: "教育" },
	{ key: "luck", label: "幸运" },
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
