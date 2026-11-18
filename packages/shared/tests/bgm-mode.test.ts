import { describe, expect, test } from "bun:test";
import { BgmState, UpdateBgmCommand } from "../src/stage";

describe("BGM playback modes", () => {
	test.each(["off", "single", "list", "shuffle"])("accepts mode %s", (mode) => {
		expect(
			UpdateBgmCommand.parse({ action: "mode", mode, expectedVersion: 2 }),
		).toMatchObject({ mode });
		expect(
			BgmState.parse({
				trackId: "track",
				playing: true,
				mode,
				volume: 80,
				seekOffsetMs: 0,
				startedAtMs: 0,
				version: 2,
			}),
		).toMatchObject({ mode });
	});

	test("rejects invalid modes and retired loop commands", () => {
		expect(
			UpdateBgmCommand.safeParse({
				action: "mode",
				mode: "invalid",
				expectedVersion: 0,
			}).success,
		).toBe(false);
		expect(
			UpdateBgmCommand.safeParse({
				action: "loop",
				loop: true,
				expectedVersion: 0,
			}).success,
		).toBe(false);
	});

	test.each(["ended", "next", "previous"])(
		"accepts server-selected action %s",
		(action) => {
			expect(
				UpdateBgmCommand.safeParse({ action, expectedVersion: 4 }).success,
			).toBe(true);
		},
	);
});
