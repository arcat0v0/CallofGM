import type {
	ModuleDto,
	ModuleSummaryDto,
	ThemeSummaryDto,
} from "@cogm/shared";
import { getRuleComponent } from "@/rules/registry";
import { GM_BACK_PREFIXES, safeBackPath } from "@/lib/back-navigation";

export type ModulesSort = "updated" | "name" | "assets";
export type ModulesStatusFilter = "ready" | "empty";
export type ModulesView = "gallery" | "ledger";

export type ModulesSearch = {
	rule?: string;
	status?: ModulesStatusFilter;
	q?: string;
	sort?: ModulesSort;
	view?: ModulesView;
};

export type ModuleDetailTab =
	| "scenes"
	| "characters"
	| "music"
	| "handouts"
	| "settings";

export type ModuleDetailSearch = {
	tab?: ModuleDetailTab;
	from?: string;
};

const pick = <T extends string>(value: unknown, allowed: readonly T[]) =>
	typeof value === "string" && (allowed as readonly string[]).includes(value)
		? (value as T)
		: undefined;

const text = (value: unknown, max = 100) =>
	typeof value === "string" && value.trim() ? value.slice(0, max) : undefined;

export function parseModulesSearch(
	search: Record<string, unknown>,
): ModulesSearch {
	return {
		rule: text(search.rule, 50),
		status: pick(search.status, ["ready", "empty"] as const),
		q: text(search.q),
		sort: pick(search.sort, ["updated", "name", "assets"] as const),
		view: pick(search.view, ["gallery", "ledger"] as const),
	};
}

export function parseModuleDetailSearch(
	search: Record<string, unknown>,
): ModuleDetailSearch {
	return {
		tab: pick(search.tab, [
			"scenes",
			"characters",
			"music",
			"handouts",
			"settings",
		] as const),
		from: safeBackPath(search.from, GM_BACK_PREFIXES),
	};
}

export type EnrichedModule = {
	module: ModuleDto;
	summary: ModuleSummaryDto | null;
	ruleShortName: string;
	ruleFullName: string;
	themeName: string | null;
	assetTotal: number;
	updatedAt: number;
};

export function enrichModules(
	modules: ModuleDto[],
	summaries: ModuleSummaryDto[],
	themes: ThemeSummaryDto[],
): EnrichedModule[] {
	const summaryMap = new Map(summaries.map((item) => [item.moduleId, item]));
	const themeMap = new Map(themes.map((item) => [item.id, item.name]));
	return modules.map((module) => {
		const summary = summaryMap.get(module.id) ?? null;
		const rule = getRuleComponent(module.ruleId);
		const assetTotal = summary
			? summary.sceneCount +
				summary.characterCount +
				summary.handoutCount +
				summary.trackCount
			: 0;
		return {
			module,
			summary,
			ruleShortName: rule.shortName,
			ruleFullName: rule.metadata.name,
			themeName: module.themeId
				? (themeMap.get(module.themeId) ?? module.themeId)
				: null,
			assetTotal,
			updatedAt: summary?.updatedAt ?? module.createdAt,
		};
	});
}

const collator = new Intl.Collator("zh-Hans-CN-u-co-pinyin");

export function filterAndSortModules(
	items: EnrichedModule[],
	search: ModulesSearch,
): EnrichedModule[] {
	const needle = search.q?.trim().toLowerCase() ?? "";
	const filtered = items.filter((entry) => {
		if (search.rule && entry.module.ruleId !== search.rule) return false;
		if (search.status === "ready" && entry.assetTotal === 0) return false;
		if (search.status === "empty" && entry.assetTotal > 0) return false;
		if (
			needle &&
			!entry.module.name.toLowerCase().includes(needle) &&
			!entry.module.description.toLowerCase().includes(needle) &&
			!entry.ruleShortName.toLowerCase().includes(needle)
		) {
			return false;
		}
		return true;
	});

	const sort = search.sort ?? "updated";
	return [...filtered].sort((a, b) => {
		if (sort === "name") {
			return collator.compare(a.module.name, b.module.name);
		}
		if (sort === "assets") {
			return (
				b.assetTotal - a.assetTotal ||
				b.updatedAt - a.updatedAt ||
				collator.compare(a.module.name, b.module.name)
			);
		}
		return (
			b.updatedAt - a.updatedAt ||
			collator.compare(a.module.name, b.module.name)
		);
	});
}
