import { AppError } from "@/platform/errors/app-error";
import type { RandomSource } from "@/platform/ports";

/** 骰点表达式限制：防滥用与资源耗尽 */
export const DICE_LIMITS = {
  maxCount: 50,
  maxFaces: 1000,
  maxModifier: 10000,
  maxExpressionLength: 32,
} as const;

export interface DiceTerm {
  count: number;
  faces: number;
  modifier: number;
}

export class InvalidDiceExpressionError extends AppError {
  constructor(message = "Invalid dice expression") {
    super("INVALID_DICE_EXPRESSION", message, 400);
  }
}

const DICE_PATTERN = /^(\d+)?[dD](\d+)([+-]\d+)?$/;

/**
 * 解析受限骰点表达式 `XdY±Z`（如 `1d100`、`3d6+2`）。
 * 只接受单个骰子项加可选修正值，不支持复杂表达式。
 */
export function parseDiceExpression(input: string): DiceTerm {
  const expression = input.trim();
  if (expression.length === 0 || expression.length > DICE_LIMITS.maxExpressionLength) {
    throw new InvalidDiceExpressionError("Expression is empty or too long");
  }

  const match = DICE_PATTERN.exec(expression);
  if (!match) {
    throw new InvalidDiceExpressionError(`Unsupported dice expression: ${expression}`);
  }

  const count = match[1] ? parseInt(match[1], 10) : 1;
  const faces = parseInt(match[2]!, 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  if (count < 1 || count > DICE_LIMITS.maxCount) {
    throw new InvalidDiceExpressionError(`Dice count must be between 1 and ${DICE_LIMITS.maxCount}`);
  }
  if (faces < 2 || faces > DICE_LIMITS.maxFaces) {
    throw new InvalidDiceExpressionError(`Dice faces must be between 2 and ${DICE_LIMITS.maxFaces}`);
  }
  if (Math.abs(modifier) > DICE_LIMITS.maxModifier) {
    throw new InvalidDiceExpressionError(`Modifier must be within ±${DICE_LIMITS.maxModifier}`);
  }

  return { count, faces, modifier };
}

export interface DiceRollOutcome {
  rolls: number[];
  modifier: number;
  total: number;
}

export function rollDice(term: DiceTerm, random: RandomSource): DiceRollOutcome {
  const rolls: number[] = [];
  let sum = 0;
  for (let i = 0; i < term.count; i++) {
    const value = random.randomInt(1, term.faces);
    rolls.push(value);
    sum += value;
  }
  return { rolls, modifier: term.modifier, total: sum + term.modifier };
}

/** 规范化显示用表达式（如 "3d6+2"） */
export function formatExpression(term: DiceTerm): string {
  const modifier =
    term.modifier > 0 ? `+${term.modifier}` : term.modifier < 0 ? `${term.modifier}` : "";
  return `${term.count}d${term.faces}${modifier}`;
}

/** 掷骰明细（如 "3d6=[4,2,5]+2"） */
export function formatRollDetail(term: DiceTerm, outcome: DiceRollOutcome): string {
  const modifier =
    outcome.modifier > 0 ? `+${outcome.modifier}` : outcome.modifier < 0 ? `${outcome.modifier}` : "";
  return `${term.count}d${term.faces}=[${outcome.rolls.join(",")}]${modifier}`;
}

/**
 * 求值损失类表达式：支持固定整数（"0"、"3"）或骰点表达式（"1d6"、"2d6+1"）。
 * 用于 CoC SAN 损失等场景。
 */
export function evaluateLossExpression(expression: string, random: RandomSource): number {
  const trimmed = expression.trim();
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  const term = parseDiceExpression(trimmed);
  return rollDice(term, random).total;
}
