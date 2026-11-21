import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, within } from "@testing-library/react";

// 模拟一个规则很多的未来：8 套规则，其中 3 套已有人物
const RULES = [
	["alpha", "Alpha", "Alpha Roleplaying"],
	["bravo", "Bravo", "Bravo Horror"],
	["charlie", "Charlie", "Charlie Fantasy"],
	["delta", "Delta", "Delta Space Opera"],
	["echo", "Echo", "Echo Noir"],
	["foxtrot", "Foxtrot", "Foxtrot Western"],
	["golf", "Golf", "Golf Cyberpunk"],
	["hotel", "Hotel", "Hotel Mystery"],
] as const;

mock.module("@/rules/registry", () => ({
	getRuleComponent: (id: string) => {
		const rule = RULES.find(([ruleId]) => ruleId === id) ?? RULES[0];
		return { shortName: rule[1], metadata: { id: rule[0], name: rule[2] } };
	},
}));

const { LibraryRulePicker } = await import(
	"../src/features/gm-characters/library-sidebar"
);

const counts: Record<string, number> = { alpha: 4, delta: 120, golf: 9 };
const options = RULES.map(([id]) => ({ id, count: counts[id] ?? 0 }));

function renderPicker(onSelect = mock((_id: string) => undefined)) {
	render(
		<LibraryRulePicker rules={options} activeRuleId="golf" onSelect={onSelect} />,
	);
	fireEvent.click(within(document.body).getByRole("button", { name: /当前：Golf/ }));
	return onSelect;
}

function optionNames() {
	return Array.from(
		document.querySelectorAll<HTMLButtonElement>("[data-rule-option]"),
	).map((button) => button.textContent ?? "");
}

describe("LibraryRulePicker", () => {
	test("trigger takes one slot regardless of how many rules exist", () => {
		render(
			<LibraryRulePicker rules={options} activeRuleId="golf" onSelect={() => {}} />,
		);
		const trigger = within(document.body).getByRole("button", { name: /当前：Golf/ });
		expect(trigger.textContent).toContain("Golf");
		expect(trigger.textContent).toContain("9");
		expect(document.querySelectorAll("[data-rule-option]")).toHaveLength(0);
	});

	test("rules with characters come first by count, empty rules follow by name", () => {
		renderPicker();
		const names = optionNames();
		expect(names).toHaveLength(8);
		expect(names[0]?.startsWith("Delta")).toBe(true);
		expect(names[1]?.startsWith("Golf")).toBe(true);
		expect(names[2]?.startsWith("Alpha")).toBe(true);
		// 无人物的规则按名称排在后面
		expect(names[3]?.startsWith("Bravo")).toBe(true);
		expect(within(document.body).getByText("有人物")).toBeTruthy();
		expect(within(document.body).getByText("暂无人物")).toBeTruthy();
	});

	test("search filters by short name or full name and Enter picks the top match", () => {
		const onSelect = renderPicker();
		const input = within(document.body).getByRole("searchbox", { name: "搜索规则" });
		fireEvent.input(input, { target: { value: "noir" } });
		expect(optionNames()).toHaveLength(1);
		expect(optionNames()[0]).toContain("Echo");
		fireEvent.keyDown(input, { key: "Enter" });
		expect(onSelect).toHaveBeenCalledWith("echo");
	});

	test("search shows a quiet empty state when nothing matches", () => {
		renderPicker();
		fireEvent.input(within(document.body).getByRole("searchbox", { name: "搜索规则" }), {
			target: { value: "zzz" },
		});
		expect(within(document.body).getByText("没有匹配的规则")).toBeTruthy();
	});

	test("choosing the active rule does not trigger a reset", () => {
		const onSelect = renderPicker();
		const golf = within(document.body)
			.getAllByRole("button")
			.find((button) => button.getAttribute("aria-current") === "true");
		fireEvent.click(golf!);
		expect(onSelect).not.toHaveBeenCalled();
	});
});
