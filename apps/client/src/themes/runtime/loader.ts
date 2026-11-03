import { THEME_API_VERSION, ThemeManifest } from "@cogm/shared";
import type { ThemeDefinition } from "@cogm/theme-sdk";
import { THEME_SLOT_NAMES } from "@cogm/theme-sdk";
import { api } from "@/lib/api";

export type LoadedTheme = {
	manifest: ThemeManifest;
	definition: ThemeDefinition;
	baseUrl: string;
	version: string;
	id: string;
};

const loaded = new Map<string, Promise<LoadedTheme>>();

export class ThemeLoadError extends Error {
	constructor(
		readonly themeId: string,
		message: string,
		readonly cause?: unknown,
	) {
		super(message);
		this.name = "ThemeLoadError";
	}
}

export function themeBasePath(id: string, version: string): string {
	return `/api/v1/themes/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/`;
}

export function themeFileUrl(
	id: string,
	version: string,
	path: string,
): string {
	const base = new URL(themeBasePath(id, version), window.location.origin);
	return new URL(path, base).href;
}

export async function fetchThemeManifest(
	id: string,
	signal?: AbortSignal,
): Promise<ThemeManifest> {
	const body = await api<unknown>(
		`/themes/${encodeURIComponent(id)}/manifest`,
		{
			signal,
			cache: "no-store",
		},
	);
	const parsed = ThemeManifest.safeParse(body);
	if (!parsed.success) {
		throw new ThemeLoadError(id, "主题 manifest 无效", parsed.error);
	}
	if (parsed.data.id !== id) {
		throw new ThemeLoadError(id, "主题 manifest id 与请求不一致");
	}
	if (parsed.data.apiVersion !== THEME_API_VERSION) {
		throw new ThemeLoadError(
			id,
			`主题 API 版本 ${parsed.data.apiVersion} 与核心 ${THEME_API_VERSION} 不兼容`,
		);
	}
	return parsed.data;
}

function validateDefinition(id: string, value: unknown): ThemeDefinition {
	if (!value || typeof value !== "object") {
		throw new ThemeLoadError(id, "主题 bundle 缺少默认导出");
	}
	const candidate = value as { slots?: unknown; messages?: unknown };
	if (!candidate.slots || typeof candidate.slots !== "object") {
		throw new ThemeLoadError(id, "主题 bundle 缺少 slots");
	}
	const slots: Record<string, unknown> = {};
	for (const [name, component] of Object.entries(
		candidate.slots as Record<string, unknown>,
	)) {
		if (!(THEME_SLOT_NAMES as readonly string[]).includes(name)) {
			throw new ThemeLoadError(id, `未知插槽 ${name}`);
		}
		if (typeof component !== "function") {
			throw new ThemeLoadError(id, `插槽 ${name} 不是组件`);
		}
		slots[name] = component;
	}
	let messages: Record<string, Record<string, string>> | undefined;
	if (candidate.messages !== undefined) {
		if (!candidate.messages || typeof candidate.messages !== "object") {
			throw new ThemeLoadError(id, "主题 messages 无效");
		}
		messages = {};
		for (const [locale, entries] of Object.entries(
			candidate.messages as Record<string, unknown>,
		)) {
			if (!entries || typeof entries !== "object") {
				throw new ThemeLoadError(id, `主题 messages[${locale}] 无效`);
			}
			const target: Record<string, string> = {};
			for (const [key, text] of Object.entries(
				entries as Record<string, unknown>,
			)) {
				if (typeof text !== "string") {
					throw new ThemeLoadError(
						id,
						`主题 messages[${locale}].${key} 不是字符串`,
					);
				}
				target[key] = text;
			}
			messages[locale] = target;
		}
	}
	return { slots: slots as ThemeDefinition["slots"], messages };
}

export async function loadTheme(
	id: string,
	signal?: AbortSignal,
): Promise<LoadedTheme> {
	const manifest = await fetchThemeManifest(id, signal);
	const key = `${manifest.id}@${manifest.version}`;
	const cached = loaded.get(key);
	if (cached) {
		return cached;
	}
	if (signal?.aborted) {
		throw new DOMException("Aborted", "AbortError");
	}

	const promise = (async () => {
		const bundleUrl = themeFileUrl(
			manifest.id,
			manifest.version,
			manifest.entry,
		);
		let module: unknown;
		try {
			module = await import(/* @vite-ignore */ bundleUrl);
		} catch (error) {
			throw new ThemeLoadError(id, "主题 bundle 加载失败", error);
		}
		const definition = validateDefinition(
			id,
			module && typeof module === "object" && "default" in module
				? (module as { default: unknown }).default
				: module,
		);
		return {
			manifest,
			definition,
			baseUrl: new URL(
				themeBasePath(manifest.id, manifest.version),
				window.location.origin,
			).href,
			version: manifest.version,
			id: manifest.id,
		} satisfies LoadedTheme;
	})();

	loaded.set(key, promise);
	try {
		return await promise;
	} catch (error) {
		loaded.delete(key);
		throw error;
	}
}

export function clearThemeCache(): void {
	loaded.clear();
}
