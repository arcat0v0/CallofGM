import { describe, expect, test } from "bun:test";
import type { SnapshotCharacter } from "@cogm/shared";
import {
	isCritical,
	orderBySeverity,
	othersLine,
	severityScore,
	stateEntries,
	statusLine,
} from "../src/features/gm-console/gm-state";
import type { parseCocState } from "../src/lib/coc-live";

type CharacterState = NonNullable<ReturnType<typeof parseCocState>>;

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
		currentExpressionKey: "default",
		state: state(),
		portraits: [],
		claim: null,
		...overrides,
	};
}

describe("GM workbench state summary", () => {
	test("status flags outrank missing HP and SAN", () => {
		const wounded = state({ hp: 5, maxHp: 12, statuses: ["major_wound"] });
		const scratched = state({ hp: 9, maxHp: 11, san: 20 });
		expect(severityScore(wounded)).toBeGreaterThan(severityScore(scratched));
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
			statusLine(state({ hp: 5, maxHp: 12, statuses: ["major_wound"] })),
		).toBe("重伤 · HP 5 / 12 · SAN 52 / 58");
		expect(statusLine(state())).toBe("HP 9 / 11 · SAN 52 / 58");
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
		expect(othersLine(entries)).toBe(
			"远野 澪 · HP 9 / 11 · SAN 52 / 58  ·  白石 拓真 · HP 5 / 12 · SAN 52 / 58",
		);
	});

	test("treats status flags and low HP as critical", () => {
		expect(isCritical(state({ statuses: ["temp_insanity"] }))).toBe(true);
		expect(isCritical(state({ hp: 2, maxHp: 12 }))).toBe(true);
		expect(isCritical(state())).toBe(false);
	});
});
