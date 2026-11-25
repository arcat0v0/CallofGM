import { coc7e } from "@cogm/shared";
import { t } from "@/i18n";
import type { RuleComponent, RuleStateBar } from "../types";
import { Coc7eBackgroundSummaryView } from "./background-summary";
import { Coc7eCharacterCreationEditor } from "./character-creation-editor";
import { CocCheckCard } from "./check-card";
import { CocCheckPanel } from "./check-panel";
import {
	buildCheckDiceAnimation,
	formatCheckEvent,
	formatCheckRequest,
} from "./check-view";
import {
	Coc7eCreationOptionsEditor,
	Coc7eCreationReviewSummary,
	describeCoc7eCreationOptions,
} from "./creation-method";
import { CocDiceTray } from "./dice-tray";
import { luck } from "./luck";
import { CocSessionSheet } from "./session-sheet";
import {
	cocAttributeEntries,
	cocOverview,
	cocSkillEntries,
	deriveStats,
	parseCocSheet,
	parseCocState,
	statusLabels,
} from "./sheet-data";
import { Coc7eSheetViewer } from "./sheet-viewer";
import { CocStateEditor } from "./state-editor";

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

const statusWeight: Record<string, number> = {
	dead: 100,
	dying: 90,
	unconscious: 80,
	indefinite_insanity: 70,
	temp_insanity: 60,
	major_wound: 50,
};

export const coc7eComponent: RuleComponent = {
	shortName: "CoC 7e",
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
	sheetViewer: Coc7eSheetViewer,
	creationTitle: () => t("characterCreation.pageTitle"),
	backgroundSource: "sheet",
	capabilities: {
		luck,
		characterCreation: {
			optionsEditor: Coc7eCreationOptionsEditor,
			describeOptions: describeCoc7eCreationOptions,
			reviewSummary: Coc7eCreationReviewSummary,
		},
		excelImport: {
			previewAttributes: (sheet) => {
				const parsed = parseCocSheet(sheet);
				return parsed
					? [
							{ label: "STR", value: parsed.attributes.str },
							{ label: "DEX", value: parsed.attributes.dex },
							{ label: "INT", value: parsed.attributes.int },
						]
					: [];
			},
		},
		sheetBackground: {
			renderSummary: Coc7eBackgroundSummaryView,
			extractDetailedBackground: (_sheet, rawBackground) =>
				coc7e.stripSerializedCoc7eBackground(rawBackground),
		},
	},
	parseSheet: parseCocSheet,
	parseSheetJson: (json) => {
		try {
			return parseCocSheet(JSON.parse(json));
		} catch {
			return null;
		}
	},
	skillLabel: coc7e.coc7eSkillLabel,
	attributeEntries: cocAttributeEntries,
	attributeLabel: (key) => coc7e.COC7E_ATTRIBUTE_LABELS[key]?.label ?? null,
	attributePair: (key) => {
		const entry = coc7e.COC7E_ATTRIBUTE_LABELS[key];
		return entry ? { key, label: entry.label, abbr: entry.abbr } : null;
	},
	skillEntries: cocSkillEntries,
	summaryMetrics: (sheet) => {
		const stats = deriveStats(sheet);
		return [
			{ key: "hp", label: "HP", value: `${stats.hp.current}/${stats.hp.max}` },
			{ key: "mp", label: "MP", value: `${stats.mp.current}/${stats.mp.max}` },
			{
				key: "san",
				label: "SAN",
				value: `${stats.san.current}/${stats.san.max}`,
			},
			{
				key: "luck",
				tone: "default",
				label: "LUCK",
				value: String(stats.luck),
			},
			{
				key: "mov",
				tone: "default",
				label: "MOV",
				value: String(sheet ? stats.mov : 8),
			},
		];
	},
	sheetOverview: cocOverview,
	statusLabelsOfState: (state) =>
		statusLabels(coc7eStateView(state)?.statuses ?? []),
	stateBars: coc7eStateBars,
	stateFieldLabel: (key) =>
		({
			hp: "HP",
			maxHp: t("sheet.maxHp"),
			mp: "MP",
			maxMp: t("gm.console.maxMp"),
			san: "SAN",
			maxSan: t("sheet.maxSan"),
			luck: t("sheet.luck"),
		})[key] ?? key,
	publicStateOptions: () => [
		{ value: "hp", label: "HP" },
		{ value: "mp", label: "MP" },
		{ value: "san", label: "SAN" },
		{ value: "statuses", label: "状态标记" },
	],
	stateSummary: coc7e.coc7eStateSummary,
	stateHealthScore: (value) => {
		const state = parseCocState(value);
		if (!state) return 0;
		const statusScore = state.statuses.reduce(
			(max, flag) => Math.max(max, statusWeight[flag] ?? 10),
			0,
		);
		const hpScore = state.maxHp > 0 ? (1 - state.hp / state.maxHp) * 40 : 0;
		const sanScore = state.maxSan > 0 ? (1 - state.san / state.maxSan) * 20 : 0;
		return statusScore + hpScore + sanScore;
	},
	gmStateSummaryLines: (value) => {
		const state = parseCocState(value);
		if (!state) return [];
		return [
			...statusLabels(state.statuses),
			`HP ${state.hp} / ${state.maxHp}`,
			`SAN ${state.san} / ${state.maxSan}`,
		];
	},
	sessionSheet: CocSessionSheet,
	diceTray: CocDiceTray,
	checkPanel: CocCheckPanel,
	stateEditor: CocStateEditor,
	formatCheckRequest,
	formatCheckEvent,
	buildCheckDiceAnimation,
	renderCheckCardExtra: CocCheckCard,
};
