import { beforeEach, describe, expect, test } from "bun:test";
import { coc7e } from "@cogm/shared";
import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { Coc7eCharacterCreationEditor } from "../src/rules/coc7e/character-creation-editor";

type Coc7eCharacterSheet = ReturnType<typeof coc7e.normalizeCoc7eSheet>;

const attributes = {
	str: 50,
	con: 50,
	siz: 50,
	dex: 50,
	app: 50,
	int: 50,
	pow: 50,
	edu: 50,
	luck: 50,
};

function emptySheet(): Coc7eCharacterSheet {
	return coc7e.normalizeCoc7eSheet({ attributes, skills: {} });
}

function Harness({
	initial,
	showValidation,
	onChange,
	onValidityChange,
}: {
	initial: Coc7eCharacterSheet;
	showValidation: boolean;
	onChange: (sheet: Coc7eCharacterSheet) => void;
	onValidityChange: (valid: boolean) => void;
}) {
	const [sheet, setSheet] = useState(initial);
	return (
		<Coc7eCharacterCreationEditor
			sheet={sheet}
			showValidation={showValidation}
			onValidityChange={onValidityChange}
			onChange={(next) => {
				onChange(next);
				setSheet(next);
			}}
		/>
	);
}

function renderEditor(
	initial: Coc7eCharacterSheet = emptySheet(),
	showValidation = false,
) {
	let latest = initial;
	let valid = true;
	const view = render(
		<Harness
			initial={initial}
			showValidation={showValidation}
			onChange={(next) => {
				latest = next;
			}}
			onValidityChange={(next) => {
				valid = next;
			}}
		/>,
	);
	return { view, latest: () => latest, valid: () => valid };
}

function setValue(element: HTMLElement, value: string) {
	const prototype =
		element.tagName === "TEXTAREA"
			? HTMLTextAreaElement.prototype
			: HTMLInputElement.prototype;
	const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
	setter?.call(element, value);
	fireEvent.input(element);
}

async function choose(
	view: ReturnType<typeof render>,
	triggerName: string,
	optionName: string,
) {
	const trigger = view.getByRole("combobox", { name: triggerName });
	fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
	fireEvent.click(trigger);
	const option = await within(view.baseElement).findByRole("option", {
		name: optionName,
	});
	fireEvent.click(option);
}

describe("CoC 7e character creation editor", () => {
	beforeEach(() => {
		if (!Element.prototype.hasPointerCapture) {
			Element.prototype.hasPointerCapture = () => false;
		}
		if (!Element.prototype.setPointerCapture) {
			Element.prototype.setPointerCapture = () => undefined;
		}
		if (!Element.prototype.releasePointerCapture) {
			Element.prototype.releasePointerCapture = () => undefined;
		}
	});

	test("collapses skill groups on a narrow screen and expands on demand", () => {
		const originalWidth = window.innerWidth;
		Object.defineProperty(window, "innerWidth", {
			configurable: true,
			writable: true,
			value: 390,
		});
		try {
			const editor = renderEditor();
			expect(
				editor.view.queryByRole("spinbutton", { name: "技能 侦查" }),
			).toBeNull();
			fireEvent.click(editor.view.getByRole("button", { name: /全部/ }));
			expect(
				editor.view.getByRole("spinbutton", { name: "技能 侦查" }),
			).toBeTruthy();
		} finally {
			Object.defineProperty(window, "innerWidth", {
				configurable: true,
				writable: true,
				value: originalWidth,
			});
		}
	});

	test("updates derived values while storing only explicitly edited skills", async () => {
		const editor = renderEditor();
		setValue(editor.view.getByRole("spinbutton", { name: "体质 CON" }), "65");
		setValue(editor.view.getByRole("spinbutton", { name: "体型 SIZ" }), "70");
		setValue(editor.view.getByRole("spinbutton", { name: "智力 INT" }), "85");
		setValue(editor.view.getByRole("spinbutton", { name: "技能 侦查" }), "55");
		await waitFor(() => expect(editor.latest().skills).toEqual({ 侦查: 55 }));
		expect(
			editor.view.getByRole("region", { name: "派生数值" }).textContent,
		).toContain("13");
		expect(
			editor.view.getByRole("region", { name: "技能点账本" }).textContent,
		).toContain("170");
		expect(
			editor.view.getByRole("region", { name: "技能点账本" }).textContent,
		).toContain("30");
	});

	test("reports invalid temporary input without corrupting the sheet", async () => {
		const editor = renderEditor();
		const input = editor.view.getByRole("spinbutton", { name: "力量 STR" });
		setValue(input, "");
		fireEvent.blur(input);
		await waitFor(() => expect(editor.valid()).toBe(false));
		expect(editor.latest().attributes.str).toBe(50);
		expect(editor.view.getByText("请输入 1–99 的整数")).toBeTruthy();
		setValue(input, "70");
		await waitFor(() => expect(editor.valid()).toBe(true));
		expect(editor.latest().attributes.str).toBe(70);
	});

	test("loads an occupation from the reference table dialog without resetting skills", async () => {
		const initial = emptySheet();
		initial.skills = { 侦查: 60 };
		const editor = renderEditor(initial);
		fireEvent.click(editor.view.getByRole("button", { name: "选择职业…" }));
		fireEvent.change(
			editor.view.getByRole("searchbox", { name: "搜索职业或本职技能" }),
			{ target: { value: "会计师" } },
		);
		fireEvent.click(editor.view.getByRole("button", { name: "会计师" }));
		await waitFor(() =>
			expect(editor.latest().occupation.presetId).toBe("occ-2"),
		);
		expect(editor.latest().occupation.skillPointFormula).toEqual([
			{ attribute: "edu", multiplier: 4 },
		]);
		expect(editor.latest().occupation.creditMin).toBe(30);
		expect(editor.latest().skills["侦查"]).toBe(60);
	});

	test("preserves a modern-only occupation as custom when returning to 1920s", async () => {
		const editor = renderEditor();
		fireEvent.click(editor.view.getByRole("radio", { name: "现代" }));
		fireEvent.click(editor.view.getByRole("button", { name: "选择职业…" }));
		fireEvent.change(
			editor.view.getByRole("searchbox", { name: "搜索职业或本职技能" }),
			{ target: { value: "黑客" } },
		);
		fireEvent.click(
			editor.view.getByRole("button", { name: "黑客/骇客（现代）" }),
		);
		await waitFor(() =>
			expect(editor.latest().occupation.presetId).toBe("occ-25"),
		);
		fireEvent.click(editor.view.getByRole("radio", { name: "1920 年代" }));
		expect(editor.latest().era).toBe("1920s");
		expect(editor.latest().occupation).toMatchObject({
			presetId: null,
			name: "黑客/骇客（现代）",
		});
		expect(editor.view.getByText(/已保留为自定义职业/)).toBeTruthy();
		expect(
			editor.view.getByRole("checkbox", { name: "本职 会计" }),
		).toBeTruthy();
	});

	test("offers three art slots instead of the whole art catalogue", async () => {
		const editor = renderEditor();
		expect(editor.view.queryByText("技艺(表演)")).toBeNull();
		const emptySlots = editor.view.getAllByRole("button", {
			name: "选择技艺",
		});
		expect(emptySlots.length).toBe(3);
		fireEvent.pointerDown(emptySlots[0] as HTMLElement, {
			button: 0,
			ctrlKey: false,
		});
		fireEvent.click(emptySlots[0] as HTMLElement);
		fireEvent.click(
			await within(editor.view.baseElement).findByRole("button", {
				name: "技艺(表演) 5",
			}),
		);
		await waitFor(() => expect(editor.latest().skills["技艺(表演)"]).toBe(5));
		expect(
			editor.view.getByRole("spinbutton", { name: "技能 技艺(表演)" }),
		).toBeTruthy();
		expect(
			editor.view.getAllByRole("button", { name: "选择技艺" }).length,
		).toBe(2);
	});

	test("marks occupational skills read-only once a preset occupation is chosen", async () => {
		const editor = renderEditor();
		expect(
			editor.view.getByRole("checkbox", { name: "本职 会计" }),
		).toBeTruthy();
		fireEvent.click(editor.view.getByRole("button", { name: "选择职业…" }));
		fireEvent.change(
			editor.view.getByRole("searchbox", { name: "搜索职业或本职技能" }),
			{ target: { value: "会计师" } },
		);
		fireEvent.click(editor.view.getByRole("button", { name: "会计师" }));
		await waitFor(() =>
			expect(editor.latest().occupation.presetId).toBe("occ-2"),
		);
		expect(
			editor.view.queryByRole("checkbox", { name: "本职 会计" }),
		).toBeNull();
	});

	test("adds a custom skill and keeps filtering from deleting other values", async () => {
		const initial = emptySheet();
		initial.skills = { 图书馆: 45 };
		const editor = renderEditor(initial);
		setValue(
			editor.view.getByRole("textbox", { name: "自定义技能名称" }),
			"语言(法语)",
		);
		setValue(
			editor.view.getByRole("spinbutton", { name: "自定义技能基础值" }),
			"1",
		);
		fireEvent.click(
			editor.view.getByRole("button", { name: "添加自定义技能" }),
		);
		await waitFor(() =>
			expect(editor.latest().customSkills["语言(法语)"]).toEqual({ base: 1 }),
		);
		setValue(editor.view.getByRole("searchbox", { name: "搜索技能" }), "侦查");
		expect(
			editor.view.queryByRole("spinbutton", { name: "技能 图书馆" }),
		).toBeNull();
		setValue(editor.view.getByRole("searchbox", { name: "搜索技能" }), "");
		expect(
			editor.view.getByRole("spinbutton", { name: "技能 图书馆" }),
		).toBeTruthy();
		expect(editor.latest().skills["图书馆"]).toBe(45);
	});

	test("applies asset recommendations only after an explicit action", async () => {
		const editor = renderEditor();
		setValue(
			editor.view.getByRole("spinbutton", { name: "技能 信用评级" }),
			"41",
		);
		await waitFor(() => expect(editor.latest().skills["信用评级"]).toBe(41));
		expect(editor.latest().assets.cash).toBe(0);
		expect(editor.view.getByText(/生活水平：标准/)).toBeTruthy();
		fireEvent.click(editor.view.getByRole("button", { name: "采用资产建议" }));
		expect(editor.latest().assets).toMatchObject({
			cash: 82,
			otherAssets: 2050,
			spendingLevel: 10,
		});
	});

	test("edits complete equipment and mythos records without dropping other fields", async () => {
		const initial = emptySheet();
		initial.weapons = [
			{
				name: "旧手枪",
				skillKey: "射击(手枪)",
				damage: "1d10",
				range: "15 码",
				attacks: "1",
				ammo: 6,
				malfunction: 100,
				impale: false,
				applyDamageBonus: false,
			},
		];
		initial.assets = {
			currency: "$",
			spendingLevel: 10,
			cash: 82,
			otherAssets: 2050,
			details: [{ category: "residence", name: "公寓", value: 2000 }],
		};
		initial.spells = [
			{
				name: "旧法术",
				mpCost: "1d6",
				sanCost: "1",
				castingTime: "1 轮",
				effect: "原效果",
			},
		];
		const editor = renderEditor(initial);
		setValue(
			editor.view.getByRole("textbox", { name: "武器 1 名称" }),
			"警用左轮",
		);
		setValue(
			editor.view.getByRole("textbox", { name: "法术 1 效果" }),
			"新效果",
		);
		await waitFor(() =>
			expect(editor.latest().weapons[0]?.name).toBe("警用左轮"),
		);
		expect(editor.latest().spells[0]?.effect).toBe("新效果");
		expect(editor.latest().assets.details[0]?.name).toBe("公寓");
		expect(editor.latest().weapons[0]?.ammo).toBe(6);
	});

	test("adds empty records through visible section actions", async () => {
		const editor = renderEditor();
		for (const name of [
			"添加武器",
			"添加装备",
			"添加资产明细",
			"添加法术",
			"添加神话典籍",
			"添加遭遇记录",
		]) {
			fireEvent.click(editor.view.getByRole("button", { name }));
		}
		await waitFor(() => {
			expect(editor.latest().weapons).toHaveLength(1);
			expect(editor.latest().gear).toHaveLength(1);
			expect(editor.latest().assets.details).toHaveLength(1);
			expect(editor.latest().spells).toHaveLength(1);
			expect(editor.latest().mythosTomes).toHaveLength(1);
			expect(editor.latest().encounters).toHaveLength(1);
		});
	});
});
