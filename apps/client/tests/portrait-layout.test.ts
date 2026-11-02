import { describe, expect, test } from "bun:test";
import { portraitSlotWidths, portraitSlots } from "@/features/session-stage/portrait-layout";

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
    expect(portraitSlotWidths(1, "auto")).toBeGreaterThan(portraitSlotWidths(2, "auto"));
    expect(portraitSlotWidths(2, "auto")).toBeGreaterThan(portraitSlotWidths(3, "auto"));
    expect(portraitSlotWidths(3, "auto")).toBeGreaterThan(portraitSlotWidths(4, "auto"));
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
