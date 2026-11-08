import { beforeEach, describe, expect, test } from "bun:test";
import { coc7e } from "@cogm/shared";
import { fireEvent, render, within } from "@testing-library/react";
import { useState } from "react";
import { Coc7eOccupationChoiceEditor } from "../src/rules/coc7e/occupation-choice-editor";
import { Coc7eOccupationReferenceTable } from "../src/rules/coc7e/occupation-reference-table";

type Sheet = coc7e.Coc7eCharacterSheet;

const attributes = {
	str: 50,
	con: 50,
	siz: 50,
	dex: 50,
	app: 50,
	int: 50,
	pow: 50,
	edu: 60,
	luck: 50,
};

function emptySheet(): Sheet {
	return coc7e.normalizeCoc7eSheet({ attributes, skills: {} });
}

function ReferenceHarness({ onSelect }: { onSelect: (sheet: Sheet) => void }) {
	const [sheet, setSheet] = useState<Sheet>(emptySheet);
	function select(definition: coc7e.Coc7eOccupationDefinition) {
		const next = coc7e.coc7eOccupationFromDefinition(definition.id);
		if (!next) {
			return;
		}
		const updated = { ...sheet, occupation: next };
		setSheet(updated);
		onSelect(updated);
	}
	return (
		<Coc7eOccupationReferenceTable
			attributes={sheet.attributes}
			selectedId={sheet.occupation.presetId}
			onSelect={select}
		/>
	);
}

function ChoiceHarness({ initial }: { initial: Sheet }) {
	const [sheet, setSheet] = useState<Sheet>(initial);
	return (
		<Coc7eOccupationChoiceEditor
			sheet={sheet}
			onChange={(occupation) => setSheet({ ...sheet, occupation })}
			onAddSkill={(key, base) =>
				setSheet({
					...sheet,
					customSkills: { ...sheet.customSkills, [key]: { base } },
					skills: { ...sheet.skills, [key]: base },
				})
			}
		/>
	);
}

describe("CoC 7e occupation reference table", () => {
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

	test("filters the table and applies the chosen occupation", () => {
		let latest: Sheet | null = null;
		const view = render(
			<ReferenceHarness
				onSelect={(sheet) => {
					latest = sheet;
				}}
			/>,
		);
		expect(view.getByText(/共 \d+ 个职业/)).toBeTruthy();
		fireEvent.input(
			view.getByRole("searchbox", { name: "搜索职业或本职技能" }),
			{ target: { value: "会计师" } },
		);
		expect(view.getByText("共 1 个职业")).toBeTruthy();
		fireEvent.click(view.getByRole("button", { name: "会计师" }));
		expect(latest).not.toBeNull();
		const sheet = latest as unknown as Sheet;
		expect(sheet.occupation.presetId).toBe("occ-2");
		expect(sheet.occupation.name).toBe("会计师");
		expect(sheet.occupation.creditMin).toBe(30);
		expect(sheet.occupation.skillPointFormula).toEqual([
			{ attribute: "edu", multiplier: 4 },
		]);
		expect(sheet.occupation.skillKeys).toContain("会计");
		expect(sheet.occupation.skillKeys).toContain("侦查");
	});

	test("computes the skill points of the table row from the current attributes", () => {
		const view = render(
			<ReferenceHarness
				onSelect={() => {
					return;
				}}
			/>,
		);
		fireEvent.input(
			view.getByRole("searchbox", { name: "搜索职业或本职技能" }),
			{ target: { value: "会计师" } },
		);
		const row = view.getByRole("button", { name: "会计师" }).closest("tr");
		expect(row).not.toBeNull();
		expect(within(row as HTMLElement).getByText("240")).toBeTruthy();
		expect(within(row as HTMLElement).getByText("教育×4")).toBeTruthy();
	});

	test("narrows the list by era", () => {
		const view = render(
			<ReferenceHarness
				onSelect={() => {
					return;
				}}
			/>,
		);
		fireEvent.click(view.getByRole("radio", { name: "现代" }));
		expect(view.queryByRole("button", { name: "会计师" })).not.toBeNull();
		expect(view.queryByRole("button", { name: "部落成员" })).toBeNull();
	});
});

describe("CoC 7e occupation skill derivation UI", () => {
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

	test("shows the derived fixed skills and the choice groups of the occupation", () => {
		const occupation = coc7e.coc7eOccupationFromDefinition("occ-4");
		if (!occupation) {
			throw new Error("actor occupation missing");
		}
		const view = render(
			<ChoiceHarness initial={{ ...emptySheet(), occupation }} />,
		);
		expect(view.getByText("自动本职技能")).toBeTruthy();
		expect(view.getByText("技艺(表演)")).toBeTruthy();
		expect(view.getByText("2项社交技能（2 选）")).toBeTruthy();
		expect(view.getByText("已选 0/2")).toBeTruthy();
		expect(view.getByText(/还有 3 项待选择/)).toBeTruthy();
	});

	test("records the social skills picked for the occupation group", () => {
		const occupation = coc7e.coc7eOccupationFromDefinition("occ-4");
		if (!occupation) {
			throw new Error("actor occupation missing");
		}
		const view = render(
			<ChoiceHarness initial={{ ...emptySheet(), occupation }} />,
		);
		fireEvent.click(view.getByRole("button", { name: "魅惑" }));
		fireEvent.click(view.getByRole("button", { name: "话术" }));
		expect(view.getByText("已选 2/2")).toBeTruthy();
		const social = view.getByText("已选 2/2").closest("div");
		expect(social).not.toBeNull();
		fireEvent.click(view.getByRole("button", { name: "恐吓" }));
		expect(view.getByText("已选 2/2")).toBeTruthy();
	});

	test("keeps the free specialty slots limited to the occupation allowance", async () => {
		const occupation = coc7e.coc7eOccupationFromDefinition("occ-2");
		if (!occupation) {
			throw new Error("accountant occupation missing");
		}
		const view = render(
			<ChoiceHarness initial={{ ...emptySheet(), occupation }} />,
		);
		expect(view.getByText("任意个人或时代特长（2 项）")).toBeTruthy();
		const triggers = view.getAllByRole("button", { name: "选择任意特长" });
		expect(triggers.length).toBe(2);
		fireEvent.pointerDown(triggers[0] as HTMLElement, {
			button: 0,
			ctrlKey: false,
		});
		fireEvent.click(triggers[0] as HTMLElement);
		const search = await within(view.baseElement).findByRole("searchbox", {
			name: "选择技能",
		});
		fireEvent.input(search, { target: { value: "潜水" } });
		fireEvent.click(
			within(view.baseElement).getByRole("button", { name: "潜水 1" }),
		);
		expect(view.getByText("潜水")).toBeTruthy();
		expect(view.getAllByRole("button", { name: "选择任意特长" }).length).toBe(
			1,
		);
	});
});
