import { describe, expect, test } from "bun:test";
import { coc7e } from "../src";

function outcome(
	variant: coc7e.Coc7eCriticalVariant,
	targetValue: number,
	roll: number,
	requiredSuccess = targetValue,
) {
	return coc7e.coc7eSkillOutcome(
		targetValue,
		roll,
		variant,
		requiredSuccess,
	);
}

describe("CoC 7e critical/fumble variants", () => {
	test("rulebook uses 01 and a difficulty-adjusted fumble threshold", () => {
		expect(outcome("rulebook", 60, 1)).toBe("critical");
		expect(outcome("rulebook", 60, 96)).toBe("failure");
		expect(outcome("rulebook", 60, 100)).toBe("fumble");
		expect(outcome("rulebook", 40, 96)).toBe("fumble");
		expect(outcome("rulebook", 60, 96, 30)).toBe("fumble");
		expect(outcome("rulebook", 60, 30, 30)).toBe("hard_success");
	});

	test("simple keeps 01/100 regardless of skill", () => {
		expect(outcome("simple", 99, 1)).toBe("critical");
		expect(outcome("simple", 60, 96)).toBe("failure");
		expect(outcome("simple", 60, 100)).toBe("fumble");
	});

	test("flat5 uses 01-05 and 96-100", () => {
		expect(outcome("flat5", 60, 5)).toBe("critical");
		expect(outcome("flat5", 60, 6)).toBe("extreme_success");
		expect(outcome("flat5", 60, 95)).toBe("failure");
		expect(outcome("flat5", 60, 96)).toBe("fumble");
	});

	test("target5 keeps both rules inside the success chance", () => {
		expect(outcome("target5", 40, 5)).toBe("critical");
		expect(outcome("target5", 3, 3)).toBe("critical");
		expect(outcome("target5", 3, 4)).toBe("failure");
		expect(outcome("target5", 40, 96)).toBe("fumble");
		expect(outcome("target5", 97, 96)).toBe("regular_success");
		expect(outcome("target5", 97, 100)).toBe("fumble");
	});

	test("doubles treats successful doubles as criticals and failed doubles as fumbles", () => {
		expect(outcome("doubles", 60, 1)).toBe("critical");
		expect(outcome("doubles", 60, 11)).toBe("critical");
		expect(outcome("doubles", 60, 55)).toBe("critical");
		expect(outcome("doubles", 60, 66)).toBe("fumble");
		expect(outcome("doubles", 60, 99)).toBe("fumble");
		expect(outcome("doubles", 60, 100)).toBe("fumble");
		expect(outcome("doubles", 60, 61)).toBe("failure");
		expect(outcome("doubles", 60, 33, 30)).toBe("fumble");
	});
});

describe("CoC 7e luck spending under variants", () => {
	test("cannot buy a critical even when the amended roll falls in the critical band", () => {
		const failed: coc7e.SkillCheckResult = {
			characterId: "c1",
			skillKey: "侦查",
			targetValue: 4,
			difficulty: "regular",
			bonusDice: 0,
			penaltyDice: 0,
			tensCandidates: [0],
			roll: 5,
			outcome: "failure",
			success: false,
			growthEligible: false,
			criticalVariant: "flat5",
		};
		const amended = coc7e.applyLuckSpend(failed, 1, 10);
		expect(amended?.roll).toBe(4);
		expect(amended?.outcome).toBe("regular_success");
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
			coc7e.parseCoc7eSessionRules({ criticalVariant: "flat5" }),
		).toEqual({
			allowLuckSpend: true,
			criticalVariant: "flat5",
		});
	});
});
