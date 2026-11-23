import { defaultParseSearch } from "@tanstack/react-router";

export type BackSearch = {
	from?: string;
};

export type BackTarget = {
	href: string;
	to: string;
	search?: Record<string, unknown>;
	hash?: string;
	label: string;
};

export const GM_BACK_PREFIXES = ["/gm"] as const;
export const PL_BACK_PREFIXES = ["/pl", "/submit/"] as const;

const MAX_BACK_PATH_LENGTH = 1024;
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/;

function normalizePathname(pathname: string): string {
	return pathname.length > 1 && pathname.endsWith("/")
		? pathname.slice(0, -1)
		: pathname;
}

function matchesPrefix(pathname: string, prefix: string): boolean {
	if (prefix.endsWith("/")) {
		return pathname.startsWith(prefix);
	}
	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * 校验站内返回路径，拒绝协议相对路径、路径穿越与跨区跳转。
 */
export function safeBackPath(
	value: unknown,
	allowedPrefixes?: readonly string[],
	currentPathname?: string,
): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	const trimmed = value.trim();
	if (
		!trimmed ||
		trimmed.length > MAX_BACK_PATH_LENGTH ||
		!trimmed.startsWith("/") ||
		trimmed.startsWith("//") ||
		trimmed.includes("\\") ||
		trimmed.includes("/../") ||
		trimmed.includes("/./") ||
		trimmed.endsWith("/..") ||
		trimmed.endsWith("/.") ||
		CONTROL_CHARS_RE.test(trimmed)
	) {
		return undefined;
	}

	let parsed: URL;
	try {
		parsed = new URL(trimmed, "http://localhost");
	} catch {
		return undefined;
	}
	if (parsed.origin !== "http://localhost") {
		return undefined;
	}

	const normalizedPath = normalizePathname(parsed.pathname);
	if (
		currentPathname &&
		normalizedPath === normalizePathname(currentPathname)
	) {
		return undefined;
	}
	if (
		allowedPrefixes &&
		!allowedPrefixes.some((prefix) => matchesPrefix(normalizedPath, prefix))
	) {
		return undefined;
	}

	return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function parseBackSearch(
	search: Record<string, unknown>,
	allowedPrefixes?: readonly string[],
	currentPathname?: string,
): BackSearch {
	return {
		from: safeBackPath(search.from, allowedPrefixes, currentPathname),
	};
}

/**
 * 若来源就是默认上级且无额外查询参数，则省略 from 以保持地址栏简洁。
 */
export function backParam(
	from: string | undefined,
	defaultFallback: string,
): string | undefined {
	if (!from || from === defaultFallback) {
		return undefined;
	}
	return from;
}

export function currentRouterHref(state: {
	location: {
		pathname: string;
		searchStr?: string;
	};
}): string {
	return `${state.location.pathname}${state.location.searchStr ?? ""}`;
}

export function linkPropsForHref(href: string): {
	to: string;
	search?: Record<string, unknown>;
	hash?: string;
} {
	const url = new URL(href, "http://localhost");
	const parsed = defaultParseSearch(url.search) as Record<string, unknown>;
	const search = Object.keys(parsed).length > 0 ? { ...parsed } : undefined;
	const hash = url.hash ? url.hash.slice(1) : undefined;
	return {
		to: url.pathname,
		...(search ? { search } : {}),
		...(hash ? { hash } : {}),
	};
}

export function backLabelKeyForPath(href: string): string {
	const pathname = normalizePathname(new URL(href, "http://localhost").pathname);
	if (pathname.startsWith("/gm/session/")) {
		return "nav.back.workbench";
	}
	if (pathname === "/gm/modules") {
		return "nav.back.gmModules";
	}
	if (pathname.startsWith("/gm/module/")) {
		return "nav.back.gmModule";
	}
	if (pathname === "/gm/characters") {
		return "nav.back.gmCharacters";
	}
	if (pathname === "/gm/templates") {
		return "gm.nav.templates";
	}
	if (pathname === "/gm/music") {
		return "gm.nav.music";
	}
	if (pathname === "/gm/reviews") {
		return "gm.nav.reviews";
	}
	if (pathname === "/gm/blacklist") {
		return "gm.nav.blacklist";
	}
	if (pathname === "/gm/trash") {
		return "gm.nav.trash";
	}
	if (pathname === "/gm") {
		return "nav.back.gmDashboard";
	}
	if (pathname === "/pl/characters") {
		return "nav.back.plCharacters";
	}
	if (pathname.startsWith("/submit/")) {
		return "nav.back.submit";
	}
	if (pathname.startsWith("/join/")) {
		return "nav.back.join";
	}
	if (pathname === "/") {
		return "nav.back.home";
	}
	return "characterSheet.back";
}

export function resolveBackTarget(
	options: {
		from: unknown;
		fallback: string;
		allowedPrefixes?: readonly string[];
		currentPathname?: string;
	},
	translate: (key: string) => string,
): BackTarget {
	const href =
		safeBackPath(
			options.from,
			options.allowedPrefixes,
			options.currentPathname,
		) ?? options.fallback;
	return {
		href,
		...linkPropsForHref(href),
		label: translate(backLabelKeyForPath(href)),
	};
}
