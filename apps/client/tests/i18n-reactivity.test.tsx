import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, render } from "@testing-library/react";
import {
	resetMessageRuntime,
	setMessageRuntime,
	t,
	useI18nVersion,
} from "@/i18n";

function Probe() {
	useI18nVersion();
	return <span>{t("probe.label")}</span>;
}

afterEach(() => {
	cleanup();
	resetMessageRuntime();
});

describe("i18n reactivity", () => {
	test("re-renders subscribers when theme messages change", () => {
		const view = render(<Probe />);
		expect(view.getByText("probe.label")).toBeTruthy();

		act(() => {
			setMessageRuntime("zh-CN", { "zh-CN": { "probe.label": "主题文案" } });
		});
		expect(view.getByText("主题文案")).toBeTruthy();

		act(() => {
			resetMessageRuntime();
		});
		expect(view.getByText("probe.label")).toBeTruthy();
	});
});
