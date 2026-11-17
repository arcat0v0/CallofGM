import { describe, expect, test } from "bun:test";
import { coc7e } from "../src";

describe("CoC 7e luck spending keeps the session variant", () => {
	const unstamped: coc7e.SkillCheckResult = {
		characterId: "c1",
		skillKey: "侦查",
		targetValue: 96,
		difficulty: "regular",
		bonusDice: 0,
		penaltyDice: 0,
		tensCandidates: [9],
		roll: 97,
		outcome: "failure",
		success: false,
		growthEligible: false,
	};

	test("applyLuckSpend uses the given variant for its option lookup", () => {
		const options = coc7e.luckSpendOptions(unstamped, 99, "wide");
		expect(options.map((option) => option.points)).toEqual([49, 78]);
		const amended = coc7e.applyLuckSpend(unstamped, 49, 99, "wide");
		expect(amended?.roll).toBe(48);
		expect(amended?.outcome).toBe("hard_success");
		expect(amended?.success).toBe(true);
		expect(amended?.criticalVariant).toBe("wide");
	});

	test("a spend that the variant forbids is rejected instead of silently re-graded", () => {
		expect(coc7e.applyLuckSpend(unstamped, 1, 99, "wide")).toBeNull();
	});

	test("spending luck never yields a fumble under the active variant", () => {
		const variants: coc7e.Coc7eCriticalVariant[] = [
			"rulebook",
			"simple",
			"wide",
			"doubles",
			"strict",
		];
		for (const variant of variants) {
			for (let target = 5; target <= 99; target++) {
				for (let roll = 2; roll <= 100; roll++) {
					const check: coc7e.SkillCheckResult = {
						...unstamped,
						targetValue: target,
						roll,
						tensCandidates: [Math.floor(roll / 10)],
					};
					for (const option of coc7e.luckSpendOptions(
						check,
						99,
						variant,
					)) {
						const amended = coc7e.applyLuckSpend(
							check,
							option.points,
							99,
							variant,
						);
						expect(amended).not.toBeNull();
						expect(amended?.outcome).not.toBe("fumble");
						expect(amended?.success).toBe(true);
					}
				}
			}
		}
	});
});
