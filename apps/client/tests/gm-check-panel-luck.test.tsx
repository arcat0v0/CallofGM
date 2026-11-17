import { beforeEach, describe, expect, test } from "bun:test";
import type { SnapshotCharacter } from "@cogm/shared";
import { fireEvent, render, within } from "@testing-library/react";
import { CheckPanel } from "../src/features/gm-console/check-panel";
import { usePlayStore } from "../src/stores/play-store";

function character(): SnapshotCharacter {
	return {
		characterId: "c1",
		name: "远野 澪",
		kind: "pc",
		ruleId: "coc7e",
		currentExpressionKey: "default",
		state: {
			schemaVersion: 1,
			sessionId: "s1",
			characterId: "c1",
			hp: 9,
			maxHp: 11,
			mp: 8,
			maxMp: 10,
			san: 52,
			maxSan: 58,
			luck: 50,
			statuses: [],
			tags: [],
			growthMarks: [],
			hiddenGrowthMarks: [],
		},
		sheet: {
			schemaVersion: 1,
			profile: { name: "远野 澪" },
			attributes: {
				str: 50,
				con: 50,
				siz: 50,
				dex: 50,
				app: 50,
				int: 50,
				pow: 50,
				edu: 60,
				luck: 50,
			},
			skills: { 侦查: 50 },
			customSkills: {},
			occupation: { name: "记者" },
			era: "modern",
			age: 28,
			weaponSkills: [],
			backstory: "",
			weapons: [],
			armor: { name: "", value: 0, locations: [] },
			gear: [],
			assets: { currency: "CNY", spendingLevel: "", cash: 0, otherAssets: "" },
			spells: [],
			mythosTomes: [],
			encounters: [],
			movementModifier: 0,
			damageBonus: "0",
			build: 0,
			majorWoundThreshold: 0,
		},
		portraits: [],
		claim: null,
	} as unknown as SnapshotCharacter;
}

async function openSkillDropdown(view: ReturnType<typeof render>) {
	const trigger = view.getByRole("combobox", { name: "技能 / 属性" });
	fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
	fireEvent.click(trigger);
	return within(view.baseElement).findByRole("listbox");
}

beforeEach(() => {
	usePlayStore.getState().reset();
	usePlayStore.setState({
		status: "active",
		phase: "performance_time",
		characters: [character()],
	});
});

describe("GM check panel skill dropdown", () => {
	test("does not offer a destiny check shortcut and lists luck as a plain attribute", async () => {
		const view = render(<CheckPanel onClose={() => undefined} />);
		const listbox = await openSkillDropdown(view);
		const options = within(listbox)
			.getAllByRole("option")
			.map((option) => option.textContent?.trim() ?? "");

		expect(options).not.toContain("天命检定");
		expect(options).not.toContain("gm.workbench.destinyCheck");
		expect(options).toContain("幸运");
		expect(options).toContain("侦查");
	});

	test("does not place a destiny check shortcut as the first option", async () => {
		const view = render(<CheckPanel onClose={() => undefined} />);
		const listbox = await openSkillDropdown(view);
		const first =
			within(listbox).getAllByRole("option")[0]?.textContent?.trim() ?? "";

		expect(first).not.toBe("天命检定");
		expect(first).not.toBe("gm.workbench.destinyCheck");
		expect(first).not.toBe("幸运");
	});
});
