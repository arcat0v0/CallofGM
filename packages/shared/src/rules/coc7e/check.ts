import { z } from "zod";

export const CheckDifficulty = z.enum(["regular", "hard", "extreme"]);
export type CheckDifficulty = z.infer<typeof CheckDifficulty>;

export const CheckDifficultyLabel: Record<CheckDifficulty, string> = {
  regular: "常规",
  hard: "困难",
  extreme: "极难",
};

export const CheckOutcome = z.enum([
  "critical",
  "extreme_success",
  "hard_success",
  "regular_success",
  "failure",
  "fumble",
]);
export type CheckOutcome = z.infer<typeof CheckOutcome>;

export const CheckOutcomeLabel: Record<CheckOutcome, string> = {
  critical: "大成功",
  extreme_success: "极难成功",
  hard_success: "困难成功",
  regular_success: "常规成功",
  failure: "失败",
  fumble: "大失败",
};

export const SkillCheckResult = z.object({
  characterId: z.string(),
  skillKey: z.string(),
  targetValue: z.number().int().min(1).max(99),
  difficulty: CheckDifficulty,
  bonusDice: z.number().int().min(0).max(2),
  penaltyDice: z.number().int().min(0).max(2),
  tensCandidates: z.array(z.number().int().min(0).max(9)),
  roll: z.number().int().min(1).max(100),
  outcome: CheckOutcome,
  success: z.boolean(),
});
export type SkillCheckResult = z.infer<typeof SkillCheckResult>;

export const SanCheckResult = z.object({
  characterId: z.string(),
  sanBefore: z.number().int().min(0),
  roll: z.number().int().min(1).max(100),
  success: z.boolean(),
  lossExpression: z.string(),
  loss: z.number().int().min(0),
  sanAfter: z.number().int().min(0),
});
export type SanCheckResult = z.infer<typeof SanCheckResult>;

export const CheckRequest = z.object({
  id: z.string(),
  sessionId: z.string(),
  characterId: z.string(),
  skillKey: z.string(),
  difficulty: CheckDifficulty,
  bonusDice: z.number().int().min(0).max(2),
  penaltyDice: z.number().int().min(0).max(2),
  hidden: z.boolean(),
  sanLossExpression: z.string().optional(),
});
export type CheckRequest = z.infer<typeof CheckRequest>;
