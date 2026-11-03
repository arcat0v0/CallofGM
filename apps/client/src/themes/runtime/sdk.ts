import { defineTheme } from "@cogm/theme-sdk";
import * as React from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import * as ReactDOM from "react-dom";
import { createPortal } from "react-dom";
import * as ReactDOMClient from "react-dom/client";
import {
	getActiveLocale,
	resetMessageRuntime,
	setMessageRuntime,
	translate,
} from "@/i18n";
import { cn } from "@/lib/utils";

type ThemeRuntime = {
	React: typeof React;
	ReactDOM: typeof ReactDOM;
	ReactDOMClient: typeof ReactDOMClient;
	jsx: typeof jsx;
	jsxs: typeof jsxs;
	Fragment: typeof Fragment;
	createPortal: typeof createPortal;
	defineTheme: typeof defineTheme;
	cn: typeof cn;
	t: typeof translate;
	assetUrl: (path: string) => string;
	navigate: (to: string) => void;
	useLocale: () => string;
};

let assetBase = "";
let navigateImpl: (to: string) => void = (to) => {
	window.location.assign(to);
};

function assetUrl(path: string): string {
	if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith("/")) {
		return path;
	}
	if (!assetBase) {
		return path;
	}
	return new URL(path, assetBase).href;
}

const runtime: ThemeRuntime = {
	React,
	ReactDOM,
	ReactDOMClient,
	jsx,
	jsxs,
	Fragment,
	createPortal,
	defineTheme,
	cn,
	t: translate,
	assetUrl,
	navigate: (to) => navigateImpl(to),
	useLocale: getActiveLocale,
};

export function installThemeSdk(navigate?: (to: string) => void): void {
	if (navigate) {
		navigateImpl = navigate;
	}
	(globalThis as { __COGM_THEME_SDK__?: ThemeRuntime }).__COGM_THEME_SDK__ =
		runtime;
}

export function setThemeAssetBase(base: string): void {
	assetBase = base;
}

export function resetThemeAssetBase(): void {
	assetBase = "";
}

export function setThemeMessages(
	locale: string,
	messages: Record<string, Record<string, string>> | undefined,
): void {
	const safe: Record<string, Record<string, string>> = {};
	if (messages) {
		for (const [messageLocale, entries] of Object.entries(messages)) {
			if (!entries || typeof entries !== "object") {
				continue;
			}
			const target: Record<string, string> = {};
			for (const [key, value] of Object.entries(entries)) {
				if (typeof value === "string") {
					target[key] = value;
				}
			}
			safe[messageLocale] = target;
		}
	}
	setMessageRuntime(locale, safe);
}

export function resetThemeMessages(): void {
	resetMessageRuntime();
}

export type { ThemeRuntime };
