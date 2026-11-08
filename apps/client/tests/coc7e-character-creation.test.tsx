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

	test("no longer renders the sticky live summary bar", () => {
		const editor = renderEditor();
		expect(
			editor.view.queryByRole("region", { name: "实时派生数值" }),
		).toBeNull();
	});

	test("accepts free-form art slots like the blank sheet", async () => {
		const editor = renderEditor();
		expect(editor.view.queryByText("技艺(表演)")).toBeNull();
		const slotInputs = editor.view.getAllByLabelText(/技艺[①②③]名称/);
		expect(slotInputs.length).toBe(3);
		setValue(slotInputs[0] as HTMLElement, "绘画");
		fireEvent.click(editor.view.getByRole("button", { name: "添加技艺①" }));
		await waitFor(() => {
			expect(editor.latest().skills["技艺(绘画)"]).toBe(5);
			expect(editor.latest().customSkills["技艺(绘画)"]).toEqual({ base: 5 });
		});
		const remaining = editor.view.getAllByLabelText(/技艺[①②③]名称/);
		expect(remaining.length).toBe(2);
		setValue(remaining[0] as HTMLElement, "表演");
		fireEvent.click(editor.view.getByRole("button", { name: "添加技艺②" }));
		await waitFor(() => expect(editor.latest().skills["技艺(表演)"]).toBe(5));
		expect(editor.view.getAllByLabelText(/技艺[①②③]名称/).length).toBe(1);
	});

	test("offers free-form language slots like the blank sheet", async () => {
		const editor = renderEditor();
		const slotInputs = editor.view.getAllByLabelText(/外语[①②③]名称/);
		expect(slotInputs.length).toBe(3);
		setValue(slotInputs[0] as HTMLElement, "法语");
		fireEvent.click(editor.view.getByRole("button", { name: "添加外语①" }));
		await waitFor(() => {
			expect(editor.latest().skills["外语(法语)"]).toBe(1);
			expect(editor.latest().customSkills["外语(法语)"]).toEqual({ base: 1 });
		});
	});

	test("adds free-form specialties inside skill groups", async () => {
		const editor = renderEditor();
		setValue(
			editor.view.getByLabelText("自定义科学专攻名称"),
			"结晶学",
		);
		fireEvent.click(
			editor.view.getByRole("button", { name: "添加自定义科学专攻" }),
		);
		await waitFor(() =>
			expect(editor.latest().skills["科学(结晶学)"]).toBe(1),
		);
		setValue(
			editor.view.getByLabelText("自定义格斗专攻名称"),
			"鞭子",
		);
		fireEvent.click(
			editor.view.getByRole("button", { name: "添加自定义格斗专攻" }),
		);
		await waitFor(() =>
			expect(editor.latest().skills["格斗(鞭子)"]).toBe(0),
		);
		setValue(
			editor.view.getByLabelText("自定义科学专攻名称"),
			"化学",
		);
		fireEvent.click(
			editor.view.getByRole("button", { name: "添加自定义科学专攻" }),
		);
		await waitFor(() => expect(editor.latest().skills["科学(化学)"]).toBe(1));
	});

	test("shows skill descriptions on hover", async () => {
		const editor = renderEditor();
		fireEvent.focus(editor.view.getByText("侦查"));
		const tooltip = await within(editor.view.baseElement).findByRole(
			"tooltip",
		);
		expect(tooltip.textContent).toContain("调查的核心技能");
	});

	test("cancels a custom occupation back to the empty state", () => {
		const editor = renderEditor();
		fireEvent.click(editor.view.getByRole("button", { name: "自定义职业" }));
		expect(
			editor.view.getByRole("textbox", { name: "职业名称" }),
		).toBeTruthy();
		expect(
			editor.view.getAllByText(/自定义职业可以手动勾选本职技能/).length,
		).toBe(1);
		fireEvent.click(editor.view.getByRole("button", { name: "取消自定义" }));
		expect(editor.latest().occupation).toMatchObject({
			presetId: null,
			name: "",
			skillPointFormula: [],
		});
		expect(
			editor.view.queryByRole("textbox", { name: "职业名称" }),
		).toBeNull();
		expect(
			editor.view.getByRole("button", { name: "选择职业…" }),
		).toBeTruthy();
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
