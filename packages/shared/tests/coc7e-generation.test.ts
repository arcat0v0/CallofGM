import { describe, expect, it } from "bun:test";
import {
	Coc7eCreationOptions,
	coc7eAttributeSetSummary,
	coc7eCreationChoiceCount,
	coc7eCreationDifferences,
	coc7eFallbackChoiceIndex,
	rollCoc7eCreation,
} from "../src/rules/coc7e";

describe("CoC 7e 车卡属性生成", () => {
	it("applies defaults: destiny 5 without fallback, point buy 460", () => {
		expect(Coc7eCreationOptions.parse({ method: "destiny" })).toEqual({
			method: "destiny",
			count: 5,
			fallbackPoints: null,
		});
		expect(
			Coc7eCreationOptions.parse({
				method: "destiny",
				count: 3,
				fallbackPoints: 480,
			}),
		).toEqual({ method: "destiny", count: 3, fallbackPoints: 480 });
		expect(Coc7eCreationOptions.parse({ method: "pointBuy" })).toEqual({
			method: "pointBuy",
			points: 460,
		});
		expect(
			Coc7eCreationOptions.safeParse({ method: "destiny", count: 11 }).success,
		).toBe(false);
		expect(
			Coc7eCreationOptions.safeParse({
				method: "destiny",
				fallbackPoints: 700,
			}).success,
		).toBe(false);
	});

	it("destiny rolls N sets with 3d6*5 and (2d6+6)*5 formulas", () => {
		const low = rollCoc7eCreation(
			{ method: "destiny", count: 3, fallbackPoints: null },
			() => 1,
		);
		if (low.method !== "destiny") throw new Error("unreachable");
		expect(low.sets).toHaveLength(3);
		expect(low.sets[0]!.attributes.str).toBe(15);
		expect(low.sets[0]!.attributes.siz).toBe(40);
		expect(low.sets[0]!.youngLuck).toBe(15);
		expect(low.fallback).toBeNull();
		expect(coc7eCreationChoiceCount(low)).toBe(3);
		expect(coc7eFallbackChoiceIndex(low)).toBeNull();
		const high = rollCoc7eCreation(
			{ method: "destiny", count: 1, fallbackPoints: null },
			(sides) => sides,
		);
		if (high.method !== "destiny") throw new Error("unreachable");
		expect(high.sets[0]!.attributes.edu).toBe(90);
		expect(high.sets[0]!.attributes.luck).toBe(90);
	});

	it("destiny with fallback pre-rolls one fixed point-buy luck", () => {
		const result = rollCoc7eCreation(
			{ method: "destiny", count: 2, fallbackPoints: 460 },
			() => 3,
		);
		if (result.method !== "destiny") throw new Error("unreachable");
		expect(result.fallback).toEqual({ luck: 45, youngLuck: 45 });
		expect(result.sets).toHaveLength(2);
		expect(coc7eCreationChoiceCount(result)).toBe(3);
		expect(coc7eFallbackChoiceIndex(result)).toBe(2);
	});

	it("point buy rolls only luck (twice for young investigators)", () => {
		const result = rollCoc7eCreation({ method: "pointBuy", points: 460 }, () => 3);
		expect(result).toEqual({ method: "pointBuy", luck: 45, youngLuck: 45 });
	});

	it("summarizes a set like dice bots: HP, DB and totals", () => {
		const summary = coc7eAttributeSetSummary({
			str: 65,
			con: 50,
			siz: 70,
			dex: 60,
			app: 55,
			int: 75,
			pow: 60,
			edu: 80,
			luck: 45,
		});
		expect(summary).toEqual({
			hp: 12,
			damageBonus: "+1d4",
			totalWithoutLuck: 515,
			totalWithLuck: 560,
		});
	});

	it("reports differences against the chosen set, honoring young luck", () => {
		const attributes = {
			str: 50,
			con: 50,
			siz: 50,
			dex: 50,
			app: 50,
			int: 50,
			pow: 50,
			edu: 50,
			luck: 30,
		};
		const result = {
			method: "destiny" as const,
			sets: [{ attributes, youngLuck: 70 }],
			fallback: null,
		};
		expect(coc7eCreationDifferences(result, 0, attributes, 30)).toEqual([]);
		expect(
			coc7eCreationDifferences(result, 0, { ...attributes, luck: 70 }, 17),
		).toEqual([]);
		expect(
			coc7eCreationDifferences(result, 0, { ...attributes, str: 45 }, 30),
		).toEqual([{ key: "str", expected: 50, submitted: 45 }]);
		expect(
			coc7eCreationDifferences(
				{ method: "pointBuy", luck: 40, youngLuck: 20 },
				0,
				{ ...attributes, str: 90, luck: 40 },
				30,
			),
		).toEqual([]);
	});

	it("reports differences against the point-buy fallback and its pre-rolled luck", () => {
		const attributes = {
			str: 60,
			con: 60,
			siz: 60,
			dex: 60,
			app: 50,
			int: 60,
			pow: 50,
			edu: 60,
			luck: 50,
		};
		const result = {
			method: "destiny" as const,
			sets: [
				{ attributes, youngLuck: 20 },
				{ attributes, youngLuck: 85 },
			],
			fallback: { luck: 50, youngLuck: 30 },
		};
		expect(coc7eCreationDifferences(result, 2, attributes, 30)).toEqual([]);
		expect(
			coc7eCreationDifferences(result, 2, { ...attributes, luck: 70 }, 17),
		).toEqual([{ key: "luck", expected: 50, submitted: 70 }]);
		expect(
			coc7eCreationDifferences(result, 2, { ...attributes, luck: 50 }, 17),
		).toEqual([]);
	});
});
