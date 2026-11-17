import { describe, expect, test } from "bun:test";
import { coc7e } from "../src";

function outcome(
	variant: coc7e.Coc7eCriticalVariant,
	targetValue: number,
	roll: number,
) {
	return coc7e.coc7eSkillOutcome(targetValue, roll, variant);
}

describe("CoC 7e critical/fumble variants", () => {
	test("rulebook uses 01 and the skill-based fumble threshold", () => {
		expect(outcome("rulebook", 60, 1)).toBe("critical");
		expect(outcome("rulebook", 60, 96)).toBe("failure");
		expect(outcome("rulebook", 60, 100)).toBe("fumble");
		expect(outcome("rulebook", 40, 96)).toBe("fumble");
		expect(outcome("rulebook", 50, 96)).toBe("failure");
		expect(outcome("rulebook", 49, 96)).toBe("fumble");
	});

	test("simple keeps 01/100 regardless of skill", () => {
		expect(outcome("simple", 99, 1)).toBe("critical");
		expect(outcome("simple", 60, 96)).toBe("failure");
		expect(outcome("simple", 60, 100)).toBe("fumble");
	});

	test("wide uses 01-05 and 96-100", () => {
		expect(outcome("wide", 50, 5)).toBe("critical");
		expect(outcome("wide", 50, 6)).toBe("extreme_success");
		expect(outcome("wide", 50, 95)).toBe("failure");
		expect(outcome("wide", 50, 96)).toBe("fumble");
	});

	test("strict uses 98-100 for high skills and 96-100 for low skills", () => {
		expect(outcome("strict", 60, 98)).toBe("fumble");
		expect(outcome("strict", 60, 97)).toBe("failure");
		expect(outcome("strict", 30, 96)).toBe("fumble");
		expect(outcome("strict", 30, 1)).toBe("critical");
	});

	test("doubles treats successful doubles as criticals and failed doubles as fumbles", () => {
		expect(outcome("doubles", 50, 1)).toBe("critical");
		expect(outcome("doubles", 50, 22)).toBe("critical");
		expect(outcome("doubles", 50, 55)).toBe("fumble");
		expect(outcome("doubles", 50, 11)).toBe("critical");
		expect(outcome("doubles", 50, 10)).toBe("extreme_success");
		expect(outcome("doubles", 50, 66)).toBe("fumble");
		expect(outcome("doubles", 50, 100)).toBe("fumble");
	});
});

describe("CoC 7e luck spending under variants", () => {
	test("wide can turn an amended roll of 04 into a critical, but 01 stays extreme", () => {
		const failed: coc7e.SkillCheckResult = {
			characterId: "c1",
			skillKey: "侦查",
			targetValue: 20,
			difficulty: "regular",
			bonusDice: 0,
			penaltyDice: 0,
			tensCandidates: [3],
			roll: 30,
			outcome: "failure",
			success: false,
			growthEligible: false,
			criticalVariant: "wide",
		};
		const options = coc7e.luckSpendOptions(failed, 30);
		expect(options).toContainEqual({
			points: 26,
			outcome: "critical",
			success: true,
		});
		const amended = coc7e.applyLuckSpend(failed, 26, 30);
		expect(amended?.roll).toBe(4);
		expect(amended?.outcome).toBe("critical");

		const low: coc7e.SkillCheckResult = {
			...failed,
			targetValue: 5,
			tensCandidates: [2],
			roll: 20,
			criticalVariant: "wide",
		};
		const toOne = coc7e.applyLuckSpend(low, 19, 20);
		expect(toOne?.roll).toBe(1);
		expect(toOne?.outcome).toBe("extreme_success");
	});
});

describe("CoC 7e session rule settings", () => {
	test("defaults preserve the current behavior", () => {
		expect(coc7e.parseCoc7eSessionRules(undefined)).toEqual({
			allowLuckSpend: true,
			criticalVariant: "rulebook",
		});
	});

	test("reads a rule-specific object with defaults for missing keys", () => {
		expect(
			coc7e.parseCoc7eSessionRules({ criticalVariant: "wide" }),
		).toEqual({
			allowLuckSpend: true,
			criticalVariant: "wide",
		});
	});
});
