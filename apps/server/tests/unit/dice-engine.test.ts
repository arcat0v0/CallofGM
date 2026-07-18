import { expect, test, describe } from "bun:test";
import {
  parseDiceExpression,
  rollDice,
  formatExpression,
  formatRollDetail,
  evaluateLossExpression,
  InvalidDiceExpressionError,
  DICE_LIMITS,
} from "@/rules/dice-engine";
import type { RandomSource } from "@/platform/ports";

/** 确定性随机源：按队列吐出值 */
class FakeRandomSource implements RandomSource {
  private queue: number[];
  constructor(values: number[]) {
    this.queue = [...values];
  }
  random(): number {
    return 0.5;
  }
  randomInt(min: number, max: number): number {
    if (this.queue.length === 0) {
      throw new Error("FakeRandomSource exhausted");
    }
    const value = this.queue.shift()!;
    if (value < min || value > max) {
      throw new Error(`FakeRandomSource value ${value} out of range [${min},${max}]`);
    }
    return value;
  }
}

describe("DiceExpressionParser", () => {
  test("解析合法表达式", () => {
    expect(parseDiceExpression("1d100")).toEqual({ count: 1, faces: 100, modifier: 0 });
    expect(parseDiceExpression("3d6+2")).toEqual({ count: 3, faces: 6, modifier: 2 });
    expect(parseDiceExpression("2D10-3")).toEqual({ count: 2, faces: 10, modifier: -3 });
    expect(parseDiceExpression("d6")).toEqual({ count: 1, faces: 6, modifier: 0 });
    expect(parseDiceExpression(" 4d8 ")).toEqual({ count: 4, faces: 8, modifier: 0 });
  });

  test("拒绝非法表达式", () => {
    for (const expr of ["", "abc", "1d", "d", "1d6+2+3", "1d6*2", "1 d 6", "-3d6", "0d6", "1d1"]) {
      expect(() => parseDiceExpression(expr)).toThrow(InvalidDiceExpressionError);
    }
  });

  test("拒绝超限表达式", () => {
    expect(() => parseDiceExpression(`${DICE_LIMITS.maxCount + 1}d6`)).toThrow();
    expect(() => parseDiceExpression(`1d${DICE_LIMITS.maxFaces + 1}`)).toThrow();
    expect(() => parseDiceExpression(`1d6+${DICE_LIMITS.maxModifier + 1}`)).toThrow();
    expect(() => parseDiceExpression(`1d6-${DICE_LIMITS.maxModifier + 1}`)).toThrow();
    expect(() => parseDiceExpression("1".repeat(DICE_LIMITS.maxExpressionLength + 1))).toThrow();
  });

  test("掷骰合计", () => {
    const random = new FakeRandomSource([4, 2, 5]);
    const term = parseDiceExpression("3d6+2");
    const outcome = rollDice(term, random);
    expect(outcome.rolls).toEqual([4, 2, 5]);
    expect(outcome.total).toBe(13);
    expect(formatExpression(term)).toBe("3d6+2");
    expect(formatRollDetail(term, outcome)).toBe("3d6=[4,2,5]+2");
  });

  test("损失表达式：固定整数与骰点", () => {
    expect(evaluateLossExpression("0", new FakeRandomSource([]))).toBe(0);
    expect(evaluateLossExpression("3", new FakeRandomSource([]))).toBe(3);
    expect(evaluateLossExpression("1d6", new FakeRandomSource([5]))).toBe(5);
    expect(evaluateLossExpression("2d6+1", new FakeRandomSource([3, 4]))).toBe(8);
  });
});
