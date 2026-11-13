import { describe, expect, test } from "bun:test";
import {
	buildDiceAnimationDice,
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

	test("uses the CC0 set for dice without an olive model", () => {
		const dice = buildDiceAnimationDice({
			id: "roll-2",
			kind: "roll",
			faces: 8,
			total: 3,
			rolls: [3],
			label: "1d8 = 3",
		});
		expect(dice[0]?.asset).toBe("/dice/cc0-black-gold/D8.gltf");
		expect(dice[0]?.value).toBe("3");
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
