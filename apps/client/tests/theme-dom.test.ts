import { afterEach, describe, expect, test } from "bun:test";
import type { ThemeManifest } from "@cogm/shared";
import { applyThemeDom, resetThemeDom } from "@/themes/runtime/theme-dom";

const manifest: ThemeManifest = {
	formatVersion: 1,
	id: "test.theme",
	name: "Test",
	version: "1.0.0",
	apiVersion: 1,
	entry: "bundle.js",
	styles: [],
	defaultLocale: "zh-CN",
	locales: [],
	colorScheme: "light",
	themeColor: "#ffffff",
	icon: "assets/icon.svg",
	tokens: { "md-primary": "#123456" },
	bundleHash: `sha256:${"0".repeat(64)}`,
};

afterEach(() => {
	resetThemeDom();
});

describe("theme DOM application", () => {
	test("applies tokens, styles, color scheme, theme color and icon", () => {
		applyThemeDom(manifest);
		const root = document.documentElement;
		expect(root.getAttribute("data-cogm-theme")).toBe("test.theme");
		expect(root.style.getPropertyValue("--color-md-primary")).toBe("#123456");
		expect(root.style.colorScheme).toBe("light");
		expect(
			document
				.querySelector('meta[name="theme-color"]')
				?.getAttribute("content"),
		).toBe("#ffffff");
		expect(
			document.querySelector('link[rel="icon"]')?.getAttribute("href"),
		).toContain("assets/icon.svg");
	});

	test("removes all overrides on reset", () => {
		applyThemeDom(manifest);
		resetThemeDom();
		const root = document.documentElement;
		expect(root.hasAttribute("data-cogm-theme")).toBe(false);
		expect(root.style.getPropertyValue("--color-md-primary")).toBe("");
		expect(document.querySelector("link[data-cogm-theme-style]")).toBeNull();
	});
});
