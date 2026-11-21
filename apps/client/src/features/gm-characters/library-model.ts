import type {
	GmCharacterLibraryFacets,
	GmCharacterLibraryItemDto,
	GmCharacterLibraryResponse,
	GmCharacterLibrarySort,
} from "@cogm/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/i18n";
import { api } from "@/lib/api";

/** 人物库页的 URL 状态（规则无关） */
export type LibrarySearch = {
	rule?: string;
	kind?: "pc" | "npc";
	owner?: "gm" | "pl";
	/** 模组 ID，或 `none` 表示未归入模组 */
	module?: string;
	q?: string;
	sort?: GmCharacterLibrarySort;
	view?: "list" | "wall";
	sel?: string;
	/** 窄屏下展开选中人物的详情视图 */
	detail?: boolean;
};

const pick = <T extends string>(value: unknown, allowed: readonly T[]) =>
	typeof value === "string" && (allowed as readonly string[]).includes(value)
		? (value as T)
		: undefined;
const text = (value: unknown, max = 100) =>
	typeof value === "string" && value.trim() ? value.slice(0, max) : undefined;

export function parseLibrarySearch(
	search: Record<string, unknown>,
): LibrarySearch {
	return {
		rule: text(search.rule, 50),
		kind: pick(search.kind, ["pc", "npc"] as const),
		owner: pick(search.owner, ["gm", "pl"] as const),
		module: text(search.module, 64),
		q: text(search.q),
		sort: pick(search.sort, ["updated", "name", "portrait"] as const),
		view: pick(search.view, ["list", "wall"] as const),
		sel: text(search.sel, 64),
		detail: search.detail === true || search.detail === "true" ? true : undefined,
	};
}

export type LibraryFilters = {
	ruleId: string;
	kind?: "pc" | "npc";
	ownerKind?: "gm" | "pl";
	moduleId?: string;
	q?: string;
	sort: GmCharacterLibrarySort;
};

const PAGE_SIZE = 100;

function toQuery(filters: LibraryFilters, cursor?: string) {
	const params = new URLSearchParams({
		ruleId: filters.ruleId,
		sort: filters.sort,
		limit: String(PAGE_SIZE),
	});
	if (filters.kind) params.set("kind", filters.kind);
	if (filters.ownerKind) params.set("ownerKind", filters.ownerKind);
	if (filters.moduleId) params.set("moduleId", filters.moduleId);
	if (filters.q?.trim()) params.set("q", filters.q.trim());
	if (cursor) params.set("cursor", cursor);
	return params.toString();
}

export type LibraryState = {
	items: GmCharacterLibraryItemDto[];
	total: number;
	facets: GmCharacterLibraryFacets | null;
	loading: boolean;
	loadingMore: boolean;
	error: unknown;
	hasMore: boolean;
	loadMore: () => void;
	reload: () => Promise<void>;
};

/** 按规则与筛选条件分页读取人物库；筛选变化时重置，滚动到底部时追加 */
export function useCharacterLibrary(filters: LibraryFilters | null): LibraryState {
	const [items, setItems] = useState<GmCharacterLibraryItemDto[]>([]);
	const [total, setTotal] = useState(0);
	const [facets, setFacets] = useState<GmCharacterLibraryFacets | null>(null);
	const [cursor, setCursor] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState<unknown>(null);
	const key = filters ? toQuery(filters) : null;
	const requestRef = useRef(0);

	const load = useCallback(async () => {
		if (!filters || !key) return;
		const request = ++requestRef.current;
		setLoading(true);
		setError(null);
		try {
			const page = await api<GmCharacterLibraryResponse>(
				`/gm/characters/library?${key}`,
			);
			if (request !== requestRef.current) return;
			setItems(page.items);
			setTotal(page.total);
			setFacets(page.facets);
			setCursor(page.nextCursor);
		} catch (caught) {
			if (request === requestRef.current) setError(caught);
		} finally {
			if (request === requestRef.current) setLoading(false);
		}
		// key 已涵盖 filters 的全部字段
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);

	useEffect(() => {
		void load();
	}, [load]);

	const loadMore = useCallback(() => {
		if (!filters || !cursor || loadingMore || loading) return;
		const request = requestRef.current;
		setLoadingMore(true);
		void api<GmCharacterLibraryResponse>(
			`/gm/characters/library?${toQuery(filters, cursor)}`,
		)
			.then((page) => {
				if (request !== requestRef.current) return;
				setItems((current) => {
					const seen = new Set(current.map((item) => item.id));
					return [...current, ...page.items.filter((item) => !seen.has(item.id))];
				});
				setCursor(page.nextCursor);
			})
			.catch((caught) => setError(caught))
			.finally(() => setLoadingMore(false));
	}, [cursor, filters, loading, loadingMore]);

	return {
		items,
		total,
		facets,
		loading,
		loadingMore,
		error,
		hasMore: cursor !== null,
		loadMore,
		reload: load,
	};
}

const DAY = 86_400_000;

/** 最近一周显示相对时间，更早显示日期；同年省略年份 */
export function formatUpdated(epochMs: number, now = Date.now()): string {
	const diff = now - epochMs;
	if (diff < 60_000) return t("gm.library.timeJustNow");
	if (diff < 3_600_000)
		return t("gm.library.timeMinutes", { count: Math.floor(diff / 60_000) });
	if (diff < DAY)
		return t("gm.library.timeHours", { count: Math.floor(diff / 3_600_000) });
	if (diff < 7 * DAY)
		return t("gm.library.timeDays", { count: Math.floor(diff / DAY) });
	const date = new Date(epochMs);
	const md = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
	return date.getFullYear() === new Date(now).getFullYear()
		? md
		: `${date.getFullYear()}-${md}`;
}

/** 无立绘时的单字标识：取名字最后一段的首字（“码头工人 杰克” → “杰”） */
export function monogramOf(name: string): string {
	const segments = name.trim().split(/\s+/);
	const last = segments[segments.length - 1] ?? name;
	return Array.from(last)[0] ?? "?";
}
