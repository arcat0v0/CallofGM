import { describe, expect, test } from "bun:test";
import { coc7e } from "../src";

function result(
	overrides: Partial<coc7e.SkillCheckResult> = {},
): coc7e.SkillCheckResult {
	return {
		characterId: "c1",
		skillKey: "侦查",
		targetValue: 60,
		difficulty: "regular",
		bonusDice: 0,
		penaltyDice: 0,
		tensCandidates: [6],
		roll: 63,
		outcome: "failure",
		success: false,
		growthEligible: false,
		criticalVariant: "rulebook",
		...overrides,
	};
}

describe("CoC 7e luck spend options", () => {
	test("offers regular and hard tiers within current luck", () => {
		const options = coc7e.luckSpendOptions(result(), 50);
		expect(options).toEqual([
			{ points: 3, outcome: "regular_success", success: true },
			{ points: 33, outcome: "hard_success", success: true },
		]);
	});

	test("includes extreme tier only when current luck is enough", () => {
		expect(coc7e.luckSpendOptions(result(), 50)).not.toContainEqual({
			points: 51,
			outcome: "extreme_success",
			success: true,
		});
		expect(coc7e.luckSpendOptions(result(), 60)).toContainEqual({
			points: 51,
			outcome: "extreme_success",
			success: true,
		});
	});

	test("hard checks only offer tiers that meet the requested difficulty", () => {
		const options = coc7e.luckSpendOptions(
			result({ difficulty: "hard" }),
			50,
		);
		expect(options).toEqual([
			{ points: 33, outcome: "hard_success", success: true },
		]);
	});

	test("natural fumble, critical, luck checks, SAN and pushed rolls cannot spend", () => {
		expect(
			coc7e.luckSpendOptions(result({ roll: 100, outcome: "fumble" }), 99),
		).toEqual([]);
		expect(
			coc7e.luckSpendOptions(result({ roll: 1, outcome: "critical" }), 99),
		).toEqual([]);
		expect(
			coc7e.luckSpendOptions(result({ skillKey: "luck" }), 99),
		).toEqual([]);
		expect(coc7e.luckSpendOptions(result({ skillKey: "san" }), 99)).toEqual([]);
		expect(coc7e.luckSpendOptions(result({ pushed: true }), 99)).toEqual([]);
		expect(coc7e.luckSpendOptions(result({ luckSpent: 3 }), 99)).toEqual([]);
	});
});

describe("CoC 7e apply luck spend", () => {
	test("subtracts points, raises the outcome and preserves the original roll", () => {
		const amended = coc7e.applyLuckSpend(result(), 33, 50);
		expect(amended).not.toBeNull();
		expect(amended).toMatchObject({
			roll: 30,
			outcome: "hard_success",
			success: true,
			growthEligible: false,
			luckSpent: 33,
			originalRoll: 63,
			luckBefore: 50,
			luckAfter: 17,
		});
	});

	test("rolling down to 01 is an extreme success, not a critical", () => {
		const amended = coc7e.applyLuckSpend(
			result({ targetValue: 5, roll: 20 }),
			19,
			20,
		);
		expect(amended?.roll).toBe(1);
		expect(amended?.outcome).toBe("extreme_success");
		expect(amended?.success).toBe(true);
	});

	test("rejects points that are not an available tier", () => {
		expect(coc7e.applyLuckSpend(result(), 32, 50)).toBeNull();
		expect(coc7e.applyLuckSpend(result(), 51, 50)).toBeNull();
	});
});
