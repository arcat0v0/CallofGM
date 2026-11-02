import type { PortraitLayout } from "@cogm/shared";

const SLOTS: Record<PortraitLayout, Record<number, number[]>> = {
  auto: {
    1: [50],
    2: [28, 72],
    3: [24, 50, 76],
    4: [16, 38, 62, 84],
  },
  center: {
    1: [50],
    2: [36, 64],
    3: [30, 50, 70],
    4: [28, 44, 56, 72],
  },
  left: {
    1: [30],
    2: [28, 47],
    3: [24, 42, 60],
    4: [18, 34, 50, 66],
  },
  right: {
    1: [70],
    2: [53, 72],
    3: [40, 58, 76],
    4: [34, 50, 66, 82],
  },
  spread: {
    1: [50],
    2: [26, 74],
    3: [20, 50, 80],
    4: [14, 38, 62, 86],
  },
};

const WIDTHS: Record<PortraitLayout, Record<number, number>> = {
  auto: { 1: 48, 2: 36, 3: 30, 4: 23 },
  center: { 1: 48, 2: 28, 3: 27, 4: 21 },
  left: { 1: 44, 2: 26, 3: 23, 4: 19 },
  right: { 1: 44, 2: 26, 3: 23, 4: 19 },
  spread: { 1: 48, 2: 36, 3: 28, 4: 22 },
};

export function portraitSlots(count: number, layout: PortraitLayout): number[] {
  if (count <= 0) {
    return [];
  }
  const fixed = SLOTS[layout][count];
  if (fixed) {
    return fixed;
  }
  return Array.from({ length: count }, (_, index) => 10 + (80 * index) / (count - 1));
}

export function portraitSlotWidths(count: number, layout: PortraitLayout): number {
  if (count <= 0) {
    return 0;
  }
  return WIDTHS[layout][count] ?? Math.max(12, 86 / count);
}

