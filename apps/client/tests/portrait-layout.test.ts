import { describe, expect, test } from "bun:test";
import type { SnapshotCharacter, StageComposition } from "@cogm/shared";
import {
	addCharacterToComposition,
	applyQuickPreset,
	computeSnapGuides,
	materializeComposition,
	portraitSlots,
	portraitSlotWidths,
	removeCharacterFromComposition,
	reorderLayerInComposition,
	resolveStagePlacements,
	stageCompositionsEqual,
} from "@/features/session-stage/portrait-layout";

function makeChar(
	id: string,
	kind: "pc" | "npc" = "pc",
	currentExpressionKey: string | null = null,
): SnapshotCharacter {
	return {
		characterId: id,
		name: `角色-${id}`,
		kind,
		ruleId: "coc7e",
		currentExpressionKey,
		state: null,
		portraits: [],
		claim: null,
		sheet: null,
	};
}

describe("portraitSlots", () => {
	test("single portrait follows the chosen side", () => {
		expect(portraitSlots(1, "auto")).toEqual([50]);
		expect(portraitSlots(1, "left")).toEqual([30]);
		expect(portraitSlots(1, "right")).toEqual([70]);
	});

	test("two portraits separate according to layout", () => {
		expect(portraitSlots(2, "auto")).toEqual([28, 72]);
		expect(portraitSlots(2, "center")).toEqual([36, 64]);
		expect(portraitSlots(2, "left")).toEqual([28, 47]);
		expect(portraitSlots(2, "right")).toEqual([53, 72]);
		expect(portraitSlots(2, "spread")).toEqual([26, 74]);
	});

	test("two portraits in auto/spread do not overlap", () => {
		for (const layout of ["auto", "spread"] as const) {
			const [left, right] = portraitSlots(2, layout);
			const width = portraitSlotWidths(2, layout);
			expect(left! + width / 2).toBeLessThan(right! - width / 2);
		}
	});

	test("slot width shrinks as more portraits share the stage", () => {
		expect(portraitSlotWidths(1, "auto")).toBeGreaterThan(
			portraitSlotWidths(2, "auto"),
		);
		expect(portraitSlotWidths(2, "auto")).toBeGreaterThan(
			portraitSlotWidths(3, "auto"),
		);
		expect(portraitSlotWidths(3, "auto")).toBeGreaterThan(
			portraitSlotWidths(4, "auto"),
		);
	});

	test("three and four portraits keep a visual center", () => {
		expect(portraitSlots(3, "spread")).toEqual([20, 50, 80]);
		expect(portraitSlots(4, "auto")).toEqual([16, 38, 62, 84]);
		expect(portraitSlots(4, "center")).toEqual([28, 44, 56, 72]);
	});

	test("more than four portraits fall back to evenly spaced slots", () => {
		const slots = portraitSlots(5, "auto");
		expect(slots).toHaveLength(5);
		expect(slots[0]).toBe(10);
		expect(slots[4]).toBe(90);
		expect([...slots].sort((a, b) => a - b)).toEqual(slots);
	});

	test("empty stage has no slots", () => {
		expect(portraitSlots(0, "auto")).toEqual([]);
	});
});

describe("StageComposition helpers", () => {
	const chars = [
		makeChar("pc-1", "pc"),
		makeChar("pc-2", "pc"),
		makeChar("npc-1", "npc", null),
		makeChar("npc-2", "npc", "smile"),
	];

	test("auto mode renders PCs and NPCs with an active expression", () => {
		const placements = resolveStagePlacements(chars, null, "auto", "md");
		expect(placements.map((p) => p.character.characterId)).toEqual([
			"pc-1",
			"pc-2",
			"npc-2",
		]);
		expect(placements.map((p) => p.x)).toEqual([24, 50, 76]);
	});

	test("custom mode honors explicit roster including empty stage and skips removed characters", () => {
		const empty: StageComposition = {
			mode: "custom",
			emphasizeSpeaker: true,
			items: [],
		};
		expect(resolveStagePlacements(chars, empty, "auto", "md")).toEqual([]);

		const custom: StageComposition = {
			mode: "custom",
			emphasizeSpeaker: false,
			items: [
				{
					characterId: "npc-1",
					x: 4,
					y: 40,
					scale: 1.7,
					flipX: true,
					zIndex: 20,
				},
				{
					characterId: "removed-npc",
					x: 50,
					y: 0,
					scale: 1,
					flipX: false,
					zIndex: 10,
				},
			],
		};
		const desktop = resolveStagePlacements(chars, custom, "auto", "md");
		expect(desktop).toHaveLength(1);
		expect(desktop[0]).toMatchObject({
			x: 4,
			y: 40,
			scale: 1.7,
			flipX: true,
			zIndex: 20,
		});

		const compact = resolveStagePlacements(chars, custom, "auto", "md", {
			clampForCompact: true,
		});
		expect(compact[0]).toMatchObject({
			x: 12,
			y: 25,
			scale: 1.25,
		});
	});

	test("add/remove/reorder manage stage items cleanly", () => {
		let comp = materializeComposition(chars.slice(0, 1), null, "auto", "md");
		expect(comp.items).toHaveLength(1);
		expect(comp.items[0]!.x).toBe(50);

		comp = addCharacterToComposition(comp, "npc-1");
		expect(comp.items).toHaveLength(2);
		expect(comp.items[1]!.x).not.toBe(50);

		const front = reorderLayerInComposition(comp, "pc-1", "front");
		const pc1 = front.items.find((i) => i.characterId === "pc-1")!;
		const npc1 = front.items.find((i) => i.characterId === "npc-1")!;
		expect(pc1.zIndex).toBeGreaterThan(npc1.zIndex);

		const back = reorderLayerInComposition(front, "pc-1", "back");
		expect(
			back.items.find((i) => i.characterId === "pc-1")!.zIndex,
		).toBeLessThan(back.items.find((i) => i.characterId === "npc-1")!.zIndex);

		const removed = removeCharacterFromComposition(back, "pc-1");
		expect(removed.items.map((i) => i.characterId)).toEqual(["npc-1"]);
	});

	test("quick presets arrange duel, trio and clear formations", () => {
		const initial: StageComposition = {
			mode: "custom",
			emphasizeSpeaker: true,
			items: [
				{
					characterId: "pc-1",
					x: 10,
					y: 10,
					scale: 0.8,
					flipX: false,
					zIndex: 10,
				},
				{
					characterId: "npc-1",
					x: 90,
					y: -5,
					scale: 1.2,
					flipX: false,
					zIndex: 12,
				},
			],
		};

		const duel = applyQuickPreset("duel", initial, chars);
		expect(duel.items.map((i) => i.x)).toEqual([24, 76]);
		expect(duel.items.map((i) => i.flipX)).toEqual([false, true]);

		const trioInput = addCharacterToComposition(initial, "pc-2");
		const trio = applyQuickPreset("trio", trioInput, chars);
		expect(trio.items).toHaveLength(3);
		const centerItem = trio.items.find((i) => i.x === 50)!;
		expect(centerItem.scale).toBeGreaterThan(1);
		expect(centerItem.zIndex).toBe(
			Math.max(...trio.items.map((item) => item.zIndex)),
		);

		const cleared = applyQuickPreset("clear", trio, chars);
		expect(cleared.items).toEqual([]);
	});

	test("snap guides magnetize to center, thirds, baseline and peer alignment", () => {
		const items = [
			{ characterId: "pc-1", x: 50, y: 0, scale: 1, flipX: false, zIndex: 10 },
			{ characterId: "pc-2", x: 26, y: 12, scale: 1, flipX: false, zIndex: 12 },
		];
		const snappedCenter = computeSnapGuides("pc-1", 51.1, 0.8, items);
		expect(snappedCenter.x).toBe(50);
		expect(snappedCenter.y).toBe(0);
		expect(snappedCenter.guides).toHaveLength(2);

		// Symmetric mirror of pc-2 (x=26 -> mirror x=74) and same Y=12
		const snappedMirror = computeSnapGuides("pc-1", 74.6, 11.4, items);
		expect(snappedMirror.x).toBe(74);
		expect(snappedMirror.y).toBe(12);
	});

	test("stageCompositionsEqual ignores item array ordering", () => {
		const a: StageComposition = {
			mode: "custom",
			emphasizeSpeaker: true,
			items: [
				{ characterId: "a", x: 25, y: 0, scale: 1, flipX: false, zIndex: 10 },
				{ characterId: "b", x: 75, y: 0, scale: 1, flipX: true, zIndex: 12 },
			],
		};
		const b: StageComposition = {
			mode: "custom",
			emphasizeSpeaker: true,
			items: [a.items[1]!, a.items[0]!],
		};
		expect(stageCompositionsEqual(a, b)).toBe(true);
		expect(stageCompositionsEqual(a, { ...b, emphasizeSpeaker: false })).toBe(
			false,
		);
	});
});
