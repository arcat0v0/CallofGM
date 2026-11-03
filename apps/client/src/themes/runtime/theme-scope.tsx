import { type ReactNode, useEffect, useRef, useState } from "react";
import type { LoadedTheme } from "./loader";
import { loadTheme } from "./loader";
import {
	resetThemeAssetBase,
	resetThemeMessages,
	setThemeAssetBase,
	setThemeMessages,
} from "./sdk";
import { ThemeContext, type ThemeContextValue } from "./theme-context";
import { applyThemeDom, resetThemeDom } from "./theme-dom";

let activeToken = 0;

function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === "AbortError";
}

export function ThemeScope({
	themeId,
	children,
}: {
	themeId: string | null;
	children: ReactNode;
}) {
	const forcedDefault =
		typeof window !== "undefined" &&
		new URLSearchParams(window.location.search).get("theme") === "default";
	const resolvedId = forcedDefault ? null : themeId;
	const [value, setValue] = useState<ThemeContextValue>({
		theme: null,
		error: null,
		loading: Boolean(resolvedId),
	});
	const tokenRef = useRef(0);

	useEffect(() => {
		const token = ++activeToken;
		tokenRef.current = token;
		const controller = new AbortController();

		function release(): void {
			if (tokenRef.current !== activeToken) {
				return;
			}
			resetThemeDom();
			resetThemeAssetBase();
			resetThemeMessages();
		}

		if (!resolvedId) {
			release();
			setValue({ theme: null, error: null, loading: false });
			return () => {
				controller.abort();
			};
		}

		setValue({ theme: null, error: null, loading: true });
		let cancelled = false;

		void loadTheme(resolvedId, controller.signal)
			.then((theme: LoadedTheme) => {
				if (cancelled || controller.signal.aborted) {
					return;
				}
				applyThemeDom(theme.manifest);
				setThemeAssetBase(theme.baseUrl);
				setThemeMessages(
					theme.manifest.defaultLocale,
					theme.definition.messages,
				);
				setValue({ theme, error: null, loading: false });
			})
			.catch((error: unknown) => {
				if (cancelled || isAbortError(error)) {
					return;
				}
				console.error("theme load failed", error);
				release();
				setValue({
					theme: null,
					error: error instanceof Error ? error : new Error(String(error)),
					loading: false,
				});
			});

		return () => {
			cancelled = true;
			controller.abort();
			release();
		};
	}, [resolvedId]);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
}
