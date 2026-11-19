import { describe, expect, test } from "bun:test";
import type { coc7e, SnapshotCharacter } from "@cogm/shared";
import {
	orderBySeverity,
	stateEntries,
} from "../src/features/gm-console/gm-state";
import { getRuleComponent } from "../src/rules/registry";

const rule = getRuleComponent("coc7e");

type CharacterState = coc7e.CharacterSessionState & {
	sessionId: string;
	characterId: string;
};

function state(overrides: Partial<CharacterState> = {}): CharacterState {
	return {
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
		...overrides,
	};
}

function character(
	overrides: Partial<SnapshotCharacter> = {},
): SnapshotCharacter {
	return {
		characterId: "c1",
		name: "远野 澪",
		kind: "pc",
		ruleId: "coc7e",
		currentExpressionKey: "default",
		state: state(),
		portraits: [],
		claim: null,
		...overrides,
	};
}

function critical(state: CharacterState) {
	return stateEntries([character({ state })])[0]?.critical;
}

describe("GM workbench state summary", () => {
	test("status flags outrank missing HP and SAN", () => {
		const wounded = state({ hp: 5, maxHp: 12, statuses: ["major_wound"] });
		const scratched = state({ hp: 9, maxHp: 11, san: 20 });
		expect(rule.stateHealthScore(wounded)).toBeGreaterThan(
			rule.stateHealthScore(scratched),
		);
	});

	test("orders the most urgent character first", () => {
		const entries = stateEntries([
			character(),
			character({
				characterId: "c2",
				name: "白石 拓真",
				state: state({ hp: 5, maxHp: 12, statuses: ["major_wound"] }),
			}),
			character({
				characterId: "c3",
				name: "馆长",
				kind: "npc",
				state: state({ hp: 0, statuses: ["dying"] }),
			}),
		]);
		expect(
			orderBySeverity(entries).map((entry) => entry.character.name),
		).toEqual(["馆长", "白石 拓真", "远野 澪"]);
	});

	test("formats the featured status line", () => {
		expect(
			rule
				.gmStateSummaryLines(
					state({ hp: 5, maxHp: 12, statuses: ["major_wound"] }),
				)
				.join(" · "),
		).toBe("重伤 · HP 5 / 12 · SAN 52 / 58");
		expect(rule.gmStateSummaryLines(state()).join(" · ")).toBe(
			"HP 9 / 11 · SAN 52 / 58",
		);
	});

	test("formats the remaining characters line", () => {
		const entries = stateEntries([
			character(),
			character({
				characterId: "c2",
				name: "白石 拓真",
				state: state({ hp: 5, maxHp: 12 }),
			}),
		]);
		expect(
			entries
				.map(({ character, summary }) => `${character.name} · ${summary}`)
				.join("  ·  "),
		).toBe(
			"远野 澪 · HP 9 / 11 · SAN 52 / 58  ·  白石 拓真 · HP 5 / 12 · SAN 52 / 58",
		);
	});

	test("treats status flags and low HP as critical", () => {
		expect(critical(state({ statuses: ["temp_insanity"] }))).toBe(true);
		expect(critical(state({ hp: 2, maxHp: 12 }))).toBe(true);
		expect(critical(state())).toBe(false);
	});
});
