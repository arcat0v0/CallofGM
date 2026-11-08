import { beforeEach, describe, expect, test } from "bun:test";
import { coc7e } from "@cogm/shared";
import { fireEvent, render, within } from "@testing-library/react";
import { Coc7eSpellPicker } from "../src/rules/coc7e/spell-picker";

describe("CoC 7e spell picker", () => {
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

	test("lists the grimoire presets and reports the picked spell", async () => {
		const expected = coc7e.COC7E_SPELLS.find((spell) =>
			spell.name.includes("古老者联络术"),
		);
		if (!expected) {
			throw new Error("spell catalog is empty");
		}
		const picked: coc7e.Coc7eSpellDefinition[] = [];
		const view = render(
			<Coc7eSpellPicker
				onPick={(spell) => {
					picked.push(spell);
				}}
			/>,
		);
		const trigger = view.getByRole("button", { name: "从法术大典添加" });
		fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
		fireEvent.click(trigger);
		const search = await within(view.baseElement).findByRole("searchbox", {
			name: "搜索法术",
		});
		fireEvent.input(search, { target: { value: "古老者" } });
		fireEvent.click(
			within(view.baseElement).getByRole("button", { name: /古老者联络术/ }),
		);
		expect(picked).toHaveLength(1);
		expect(picked[0]?.name).toBe(expected.name);
		expect(picked[0]?.mpCost).toBe(expected.mpCost);
	});

	test("keeps already added spells out of the list", async () => {
		const first = coc7e.COC7E_SPELLS[0];
		if (!first) {
			throw new Error("spell catalog is empty");
		}
		const view = render(
			<Coc7eSpellPicker
				exclude={[first.name]}
				onPick={() => {
					return;
				}}
			/>,
		);
		const trigger = view.getByRole("button", { name: "从法术大典添加" });
		fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
		fireEvent.click(trigger);
		const search = await within(view.baseElement).findByRole("searchbox", {
			name: "搜索法术",
		});
		fireEvent.input(search, { target: { value: first.name } });
		expect(
			within(view.baseElement).queryByRole("button", {
				name: new RegExp(
					`^${first.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
				),
			}),
		).toBeNull();
	});
});
