import { describe, expect, test } from "bun:test";
import type { SnapshotCharacter } from "@cogm/shared";
import { dnd5r } from "@cogm/shared";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { useState } from "react";
import {
	type AbilityScores,
	abilityBuildError,
	abilityPointTotal,
	previewAbilityScores,
} from "../src/rules/dnd5r/ability-builder";
import { DndCharacterCreationEditor } from "../src/rules/dnd5r/character-creation-editor";
import { dnd5rComponent } from "../src/rules/dnd5r/component";
import { creatureItems } from "../src/rules/dnd5r/reference-data";
import { DndSessionSheet } from "../src/rules/dnd5r/session-sheet";

const base: AbilityScores = {
	str: 15,
	dex: 14,
	con: 13,
	int: 12,
	wis: 10,
	cha: 8,
};
const boosts = { str: 2, dex: 1, con: 0, int: 0, wis: 0, cha: 0 };

describe("D&D 2024 ability builder", () => {
	test("applies exactly one +2 and one +1 to canonical base scores", () => {
		expect(
			abilityBuildError({
				method: "standard",
				base,
				boosts,
				allowed: ["str", "dex", "con"],
			}),
		).toBeNull();
		expect(previewAbilityScores(base, boosts)).toEqual({
			str: 17,
			dex: 15,
			con: 13,
			int: 12,
			wis: 10,
			cha: 8,
		});
	});

	test("rejects stacking +4 and two +2 choices", () => {
		expect(
			abilityBuildError({
				method: "standard",
				base,
				boosts: { ...boosts, str: 4 },
				allowed: ["str", "dex", "con"],
			}),
		).not.toBeNull();
		expect(
			abilityBuildError({
				method: "standard",
				base,
				boosts: { ...boosts, dex: 2 },
				allowed: ["str", "dex", "con"],
			}),
		).not.toBeNull();
	});

	test("uses the 2024 point-buy budget", () => {
		expect(abilityPointTotal(base)).toBe(27);
		expect(
			abilityPointTotal({
				str: 15,
				dex: 15,
				con: 15,
				int: 15,
				wis: 15,
				cha: 8,
			}),
		).toBeGreaterThan(27);
	});
});

describe("D&D runtime projections", () => {
	test("renders NPC public HP, conditions, and temp-HP-only projections", () => {
		expect(
			dnd5rComponent.stateBars({ hp: 7, maxHp: 12, conditions: ["prone"] })[0],
		).toMatchObject({ key: "hp", current: 7, max: 12 });
		expect(
			dnd5rComponent.statusLabelsOfState({ conditions: ["prone"] }),
		).toContain("倒地");
		expect(dnd5rComponent.stateBars({ tempHp: 4 })[0]).toMatchObject({
			key: "tempHp",
			current: 4,
		});
		expect(dnd5rComponent.stateSummary({ tempHp: 4 })).toContain("4");
	});
});

describe("D&D draft editor", () => {
	test("keeps controls mounted and reports invalid custom attack drafts", () => {
		const sheet = dnd5r.createBlankSheet();
		sheet.customAttacks.push({
			id: "custom-attack",
			name: "",
			damage: { count: 1, sides: 6, type: "bludgeoning" },
			ability: "str",
			proficient: true,
		});
		const validity: boolean[] = [];
		const view = render(
			<DndCharacterCreationEditor
				sheet={sheet}
				onChange={() => undefined}
				showValidation
				onValidityChange={(value) => {
					validity.push(value);
				}}
			/>,
		);
		fireEvent.mouseDown(view.getByRole("tab", { name: "装备" }), { button: 0 });
		expect(
			view
				.getAllByRole("textbox", { name: "攻击名称" })
				.some((input) => (input as HTMLInputElement).value === ""),
		).toBe(true);
		expect(validity).toContain(false);
	});
});
function AbilityDraftHarness({
	onValidityChange,
	onSheetChange,
}: {
	onValidityChange: (valid: boolean) => void;
	onSheetChange: (sheet: dnd5r.CharacterSheet) => void;
}) {
	const [sheet, setSheet] = useState(dnd5r.createBlankSheet);
	return (
		<DndCharacterCreationEditor
			sheet={sheet}
			onChange={(next) => {
				const parsed = dnd5r.CharacterSheet.parse(next);
				setSheet(parsed);
				onSheetChange(parsed);
			}}
			showValidation={false}
			onValidityChange={onValidityChange}
		/>
	);
}

describe("D&D ability draft workflow", () => {
	test("three-plus-one assigns all background abilities and blocks only the pending draft", async () => {
		const validity: boolean[] = [];
		const scores: AbilityScores[] = [];
		const view = render(
			<AbilityDraftHarness
				onValidityChange={(valid) => validity.push(valid)}
				onSheetChange={(sheet) => scores.push(sheet.abilities)}
			/>,
		);
		fireEvent.mouseDown(view.getByRole("tab", { name: "属性" }), { button: 0 });
		fireEvent.click(view.getByText("三项各 +1"));
		await waitFor(() => expect(validity.at(-1)).toBe(false));
		fireEvent.click(view.getByRole("button", { name: "应用并保存为最终属性" }));
		await waitFor(() => expect(validity.at(-1)).toBe(true));
		expect(scores).toEqual([{ ...base, str: 16, dex: 15, con: 14 }]);
	});
});
describe("D&D attack controls", () => {
	test("quick attacks omit implicit ability and grip overrides", () => {
		const sheet = dnd5r.createBlankSheet();
		const target: SnapshotCharacter = {
			characterId: "pc-1",
			name: "测试角色",
			kind: "pc",
			ruleId: "dnd5r",
			currentExpressionKey: null,
			state: null,
			portraits: [],
			claim: null,
			sheet,
		};
		const calls: unknown[][] = [];
		const view = render(
			<DndSessionSheet
				target={target}
				characters={[target]}
				canPerform
				onPerform={(...args) => {
					calls.push(args);
				}}
			/>,
		);
		fireEvent.click(view.getByRole("button", { name: /Longsword/ }));
		expect(calls).toEqual([["attack:longsword"]]);
	});
});

test("searches the creature index and distinguishes the 13 importable presets", () => {
	expect(creatureItems().filter((item) => !item.disabled)).toHaveLength(13);
	const view = render(
		<DndCharacterCreationEditor
			sheet={dnd5r.createBlankSheet()}
			onChange={() => undefined}
			showValidation={false}
			onValidityChange={() => undefined}
		/>,
	);
	fireEvent.mouseDown(view.getByRole("tab", { name: "资料库" }), { button: 0 });
	const search = view.getByRole("searchbox", {
		name: "搜索生物名称或挑战等级",
	});
	fireEvent.change(search, { target: { value: "Aboleth" } });
	expect(
		(view.getByRole("button", { name: /Aboleth.*仅索引/ }) as HTMLButtonElement)
			.disabled,
	).toBe(true);
	fireEvent.change(search, { target: { value: "Goblin Warrior" } });
	expect(
		(
			view.getByRole("button", {
				name: /Goblin Warrior.*可导入/,
			}) as HTMLButtonElement
		).disabled,
	).toBe(false);
});
