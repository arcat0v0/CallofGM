import { describe, expect, test } from "bun:test";
import { canPlayerInitiateDiceRoll, decideChatMessage } from "@cogm/shared";

describe("chat policy shared by server authority and client input state", () => {
	test("GM may act in every phase", () => {
		for (const phase of [
			"free_discussion",
			"performance_time",
			"forced_cg",
			"free_performance",
		] as const) {
			expect(decideChatMessage(phase, "gm", null, "roleplay")).toEqual({
				kind: "immediate",
				channel: "roleplay",
			});
			expect(canPlayerInitiateDiceRoll(phase, "gm", null)).toBe(true);
		}
	});

	test("PC chat follows the phase matrix", () => {
		expect(
			decideChatMessage("free_discussion", "player", "pc", "roleplay"),
		).toEqual({ kind: "immediate", channel: "ooc" });
		expect(
			decideChatMessage("performance_time", "player", "pc", "roleplay"),
		).toEqual({ kind: "queued", channel: "roleplay" });
		expect(
			decideChatMessage("performance_time", "player", "pc", "ooc"),
		).toEqual({ kind: "forbidden" });
		expect(decideChatMessage("forced_cg", "player", "pc", "ooc")).toEqual({
			kind: "forbidden",
		});
		expect(
			decideChatMessage("free_performance", "player", "pc", "ooc"),
		).toEqual({ kind: "immediate", channel: "ooc" });
	});

	test("OB chat is always queued or forbidden", () => {
		expect(
			decideChatMessage("free_discussion", "player", "ob", "roleplay"),
		).toEqual({ kind: "queued", channel: "ooc" });
		expect(
			decideChatMessage("free_performance", "player", "ob", "ooc"),
		).toEqual({ kind: "queued", channel: "ooc" });
		expect(
			decideChatMessage("performance_time", "player", "ob", "ooc"),
		).toEqual({ kind: "forbidden" });
		expect(decideChatMessage("forced_cg", "player", "ob", "ooc")).toEqual({
			kind: "forbidden",
		});
	});

	test("OB never initiates dice rolls", () => {
		for (const phase of [
			"free_discussion",
			"performance_time",
			"forced_cg",
			"free_performance",
		] as const) {
			expect(canPlayerInitiateDiceRoll(phase, "player", "ob")).toBe(false);
		}
	});

	test("PC roll permission matches the OOC channel decision", () => {
		expect(canPlayerInitiateDiceRoll("free_discussion", "player", "pc")).toBe(
			true,
		);
		expect(canPlayerInitiateDiceRoll("free_performance", "player", "pc")).toBe(
			true,
		);
		expect(canPlayerInitiateDiceRoll("performance_time", "player", "pc")).toBe(
			false,
		);
		expect(canPlayerInitiateDiceRoll("forced_cg", "player", "pc")).toBe(false);
	});
});
