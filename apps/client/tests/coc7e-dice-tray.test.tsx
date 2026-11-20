import { beforeEach, describe, expect, mock, test } from "bun:test";
import { coc7e } from "@cogm/shared";
import { fireEvent, render, within } from "@testing-library/react";

const sent: Array<{ type: string; payload: unknown }> = [];

mock.module("@/lib/session-socket", () => ({
	sendSessionCommand: (type: string, payload: unknown) => {
		sent.push({ type, payload });
		return "cmd";
	},
}));

const { DiceTray } = await import("../src/features/session-live/dice-tray");
const { usePlayStore } = await import("../src/stores/play-store");

const sheet = coc7e.normalizeCoc7eSheet({
	attributes: {
		str: 50,
		con: 60,
		siz: 55,
		dex: 70,
		app: 45,
		int: 75,
		pow: 65,
		edu: 80,
		luck: 55,
	},
	skills: { 侦查: 60, 聆听: 45, 汽车驾驶: 40 },
});

function character(characterId: string, name: string, kind: "pc" | "npc") {
	return {
		characterId,
		name,
		kind,
		ruleId: "coc7e",
		currentExpressionKey: null,
		state: null,
		portraits: [],
		claim: null,
		sheet,
	};
}

function openCheck(options: { gm?: boolean; characterId?: string | null }) {
	const view = render(
		<DiceTray
			gm={options.gm ?? false}
			characterId={options.characterId === undefined ? "c1" : options.characterId}
		/>,
	);
	fireEvent.click(view.getByRole("radio", { name: "鉴定" }));
	return view;
}

beforeEach(() => {
	sent.length = 0;
	usePlayStore.getState().reset();
	usePlayStore.setState({
		ruleId: "coc7e",
		characters: [
			character("c1", "艾琳", "pc"),
			character("n1", "图书管理员", "npc"),
		],
	} as never);
});

describe("CoC check tray", () => {
	test("defaults to Spot Hidden and shows each difficulty threshold", () => {
		const view = openCheck({});
		expect(
			view
				.getByRole("button", { name: "侦查 60" })
				.getAttribute("aria-pressed"),
		).toBe("true");
		expect(view.getByRole("radio", { name: "常规 60" })).toBeTruthy();
		expect(view.getByRole("radio", { name: "困难 30" })).toBeTruthy();
		expect(view.getByRole("radio", { name: "极难 12" })).toBeTruthy();
		fireEvent.click(view.getByRole("radio", { name: "困难 30" }));
		expect(
			view.getByRole("button", { name: "鉴定：侦查 · 困难 30" }),
		).toBeTruthy();
	});

	test("one modifier control sends either bonus or penalty dice, never both", () => {
		const view = openCheck({});
		fireEvent.click(view.getByRole("radio", { name: "惩罚骰 2" }));
		fireEvent.click(view.getByRole("button", { name: /^鉴定：侦查/ }));
		expect(sent.at(-1)).toEqual({
			type: "check:perform",
			payload: {
				characterId: "c1",
				skillKey: "侦查",
				difficulty: "regular",
				bonusDice: 0,
				penaltyDice: 2,
			},
		});
		fireEvent.click(view.getByRole("radio", { name: "奖励骰 1" }));
		fireEvent.click(view.getByRole("button", { name: /^鉴定：侦查/ }));
		expect(sent.at(-1)?.payload).toMatchObject({
			bonusDice: 1,
			penaltyDice: 0,
		});
	});

	test("search finds any skill, picking a match returns to quick picks", () => {
		const view = openCheck({});
		const input = view.getByRole("combobox", { name: "搜索技能或属性" });
		fireEvent.input(input, { target: { value: "驾驶" } });
		const listbox = view.getByRole("listbox", { name: "技能搜索结果" });
		const options = within(listbox).getAllByRole("option");
		expect(options[0]?.getAttribute("aria-selected")).toBe("true");
		expect(input.getAttribute("aria-activedescendant")).toBe(options[0]?.id ?? null);
		fireEvent.mouseEnter(options[1] as HTMLElement);
		expect(input.getAttribute("aria-activedescendant")).toBe(options[1]?.id ?? null);
		fireEvent.click(options[0] as HTMLElement);
		expect(view.queryByRole("listbox")).toBeNull();
		expect(
			view
				.getByRole("button", { name: "汽车驾驶 40" })
				.getAttribute("aria-pressed"),
		).toBe("true");
		fireEvent.input(input, { target: { value: "不存在的技能" } });
		expect(view.getByRole("status").textContent).toContain(
			"没有匹配的技能或属性",
		);
		fireEvent.click(view.getByRole("button", { name: "清除搜索" }));
		expect(view.getByRole("group", { name: "常用技能" })).toBeTruthy();
	});

	test("quick picks keep their positions; a searched skill joins at the end", () => {
		const view = openCheck({});
		const names = () =>
			within(view.getByRole("group", { name: "常用技能" }))
				.getAllByRole("button")
				.map((button) => button.textContent);
		const before = names();
		const input = view.getByRole("combobox", { name: "搜索技能或属性" });
		fireEvent.input(input, { target: { value: "汽车" } });
		fireEvent.click(view.getAllByRole("option")[0] as HTMLElement);
		expect(names()).toEqual([...before, "汽车驾驶40"]);
	});

	test("GM can pick the target and roll hidden from a labelled switch", () => {
		const view = openCheck({ gm: true });
		expect(view.getByRole("combobox", { name: "鉴定对象" })).toBeTruthy();
		const hidden = view.getByRole("switch", { name: /暗骰/ });
		fireEvent.click(hidden);
		expect(view.getByText("结果仅主持人可见")).toBeTruthy();
		fireEvent.click(view.getByRole("radio", { name: "奖励骰 1" }));
		fireEvent.click(
			view.getByRole("button", { name: "暗骰 · 艾琳 · 侦查 · 常规 60 · 奖1" }),
		);
		expect(sent.at(-1)?.payload).toMatchObject({ hidden: true, bonusDice: 1 });
		fireEvent.click(view.getByRole("radio", { name: "骰点" }));
		expect(
			view.getByRole("switch", { name: /暗骰/ }).getAttribute("aria-checked"),
		).toBe("true");
	});

	test("explains why a check is unavailable without a character", () => {
		usePlayStore.setState({ characters: [] } as never);
		const view = openCheck({ gm: true, characterId: null });
		expect(view.getByRole("status").textContent).toContain(
			"没有可鉴定的角色",
		);
		expect(view.queryByRole("button", { name: /^鉴定/ })).toBeNull();
	});
});
