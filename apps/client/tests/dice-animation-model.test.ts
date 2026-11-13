import { describe, expect, test } from "bun:test";
import {
	buildDiceAnimationDice,
	computeDiceGridLayout,
	d100Digits,
	normalizeRollValue,
	parseDiceFaces,
} from "@/features/dice-animation/model";

describe("dice animation model", () => {
	test("splits authoritative d100 results into two dice", () => {
		expect(d100Digits(47)).toEqual([4, 7]);
		expect(d100Digits(100)).toEqual([10, 0]);
		expect(d100Digits(1)).toEqual([0, 1]);
	});

	test("uses the 00 face for a d100 result of 100", () => {
		const dice = buildDiceAnimationDice({
			id: "roll-100",
			kind: "roll",
			faces: 100,
			total: 100,
			rolls: [100],
			label: "1d100 = 100",
		});
		expect(dice.map((die) => die.value)).toEqual(["00", "0"]);
	});

	test("uses the 00 tens face for d100 results between 1 and 9", () => {
		for (const roll of [1, 5, 9]) {
			const dice = buildDiceAnimationDice({
				id: `roll-${roll}`,
				kind: "roll",
				faces: 100,
				total: roll,
				rolls: [roll],
				label: `1d100 = ${roll}`,
			});
			expect(dice.map((die) => die.value)).toEqual(["00", String(roll)]);
		}
	});

	test("splits d100 rolls individually even with modifiers or multiple dice", () => {
		const modified = buildDiceAnimationDice({
			id: "roll-mod",
			kind: "roll",
			faces: 100,
			total: 55,
			rolls: [50],
			label: "1d100+5 = 55",
		});
		expect(modified.map((die) => die.value)).toEqual(["50", "0"]);

		const multi = buildDiceAnimationDice({
			id: "roll-multi",
			kind: "roll",
			faces: 100,
			total: 41,
			rolls: [34, 7],
			label: "2d100 = 41",
		});
		expect(multi.map((die) => die.value)).toEqual(["30", "4", "00", "7"]);
	});

	test("fits single and 50-dice rolls within the frustum on desktop and mobile", () => {
		for (const [width, height] of [
			[640, 320],
			[350, 260],
		] as const) {
			for (const count of [1, 2, 4, 6, 50, 100]) {
				const layout = computeDiceGridLayout(count, width, height);
				expect(layout.positions).toHaveLength(count);
				expect(layout.dieWorldSize).toBeGreaterThan(0);
				for (const pos of layout.positions) {
					expect(Math.abs(pos.x) + layout.dieWorldSize / 2).toBeLessThanOrEqual(
						layout.usableWidth / 2 + 1e-6,
					);
					expect(Math.abs(pos.y) + layout.dieWorldSize / 2).toBeLessThanOrEqual(
						layout.usableHeight / 2 + 1e-6,
					);
				}
			}
		}
	});

	test("uses a single olive die for common direct rolls", () => {
		const dice = buildDiceAnimationDice({
			id: "roll-1",
			kind: "roll",
			faces: 6,
			total: 5,
			rolls: [5],
			label: "1d6 = 5",
		});
		expect(dice).toEqual([
			{
				asset: "/dice/olive/d6.gltf",
				value: "5",
				orientationHint: "/dice/orientations/d6.json",
			},
		]);
	});

	test("uses custom olive models and orientation maps for d4, d8, and d12", () => {
		for (const faces of [4, 8, 12]) {
			const dice = buildDiceAnimationDice({
				id: `roll-${faces}`,
				kind: "roll",
				faces,
				total: 3,
				rolls: [3],
				label: `1d${faces} = 3`,
			});
			expect(dice).toEqual([
				{
					asset: `/dice/olive/d${faces}.gltf`,
					value: "3",
					orientationHint: `/dice/orientations/d${faces}.json`,
				},
			]);
		}
	});

	test("uses the authoritative check roll for the percentile pair", () => {
		const dice = buildDiceAnimationDice({
			id: "check-1",
			kind: "check",
			roll: 72,
			outcome: "failure",
			label: "侦查 72",
		});
		expect(dice.map((die) => die.value)).toEqual(["70", "2"]);
	});

	test("parses only supported single dice expressions", () => {
		expect(parseDiceFaces("3d6+2")).toBe(6);
		expect(parseDiceFaces("1D100")).toBe(100);
		expect(parseDiceFaces("1d6+2+3")).toBeNull();
	});

	test("keeps non-percentile values unchanged", () => {
		expect(normalizeRollValue(20, 20)).toBe(20);
		expect(normalizeRollValue(100, 100)).toBe(0);
	});
});
