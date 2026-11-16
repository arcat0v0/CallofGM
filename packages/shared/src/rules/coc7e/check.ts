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

export function coc7eSkillOutcome(
	targetValue: number,
	roll: number,
): CheckOutcome {
	if (roll === 1) {
		return "critical";
	}
	const isFumble = targetValue >= 50 ? roll === 100 : roll >= 96;
	if (isFumble) {
		return "fumble";
	}
	if (roll <= Math.floor(targetValue / 5)) {
		return "extreme_success";
	}
	if (roll <= Math.floor(targetValue / 2)) {
		return "hard_success";
	}
	if (roll <= targetValue) {
		return "regular_success";
	}
	return "failure";
}

export function coc7eSkillCheckSuccess(
	outcome: CheckOutcome,
	difficulty: CheckDifficulty,
): boolean {
	switch (outcome) {
		case "critical":
		case "extreme_success":
			return true;
		case "hard_success":
			return difficulty !== "extreme";
		case "regular_success":
			return difficulty === "regular";
		default:
			return false;
	}
}

export function coc7eDifficultyThreshold(
	targetValue: number,
	difficulty: CheckDifficulty,
): number {
	if (difficulty === "extreme") {
		return Math.floor(targetValue / 5);
	}
	if (difficulty === "hard") {
		return Math.floor(targetValue / 2);
	}
	return targetValue;
}

export const SkillCheckResult = z.object({
	characterId: z.string(),
	skillKey: z.string(),
	targetValue: z.number().int().min(0).max(999),
	difficulty: CheckDifficulty,
	bonusDice: z.number().int().min(0).max(2),
	penaltyDice: z.number().int().min(0).max(2),
	tensCandidates: z.array(z.number().int().min(0).max(9)),
	roll: z.number().int().min(1).max(100),
	outcome: CheckOutcome,
	/** 是否达到 GM 指定难度 */
	success: z.boolean(),
	/** 掷出常规成功及以上（成长标记用，与难度无关） */
	growthEligible: z.boolean(),
	/** 花费幸运改骰的点数；存在时不可再次花费 */
	luckSpent: z.number().int().min(1).max(99).optional(),
	/** 改骰前的原始掷值 */
	originalRoll: z.number().int().min(1).max(100).optional(),
	/** 改骰前的当前幸运 */
	luckBefore: z.number().int().min(0).max(99).optional(),
	/** 改骰后的当前幸运 */
	luckAfter: z.number().int().min(0).max(99).optional(),
	/** 孤注一掷结果；v1 无入口，预留给服务端禁用手表 */
	pushed: z.boolean().optional(),
});
export type SkillCheckResult = z.infer<typeof SkillCheckResult>;

export interface LuckSpendCheck {
	skillKey: string;
	targetValue: number;
	difficulty: CheckDifficulty;
	roll: number;
	outcome: CheckOutcome;
	luckSpent?: number;
	pushed?: boolean;
}

export interface LuckSpendOption {
	points: number;
	outcome: "regular_success" | "hard_success" | "extreme_success";
	success: boolean;
}

const LUCK_OUTCOME_RANK: Record<CheckOutcome, number> = {
	failure: 0,
	regular_success: 1,
	hard_success: 2,
	extreme_success: 3,
	critical: 4,
	fumble: 0,
};

/**
 * 计算一次检定可花费幸运到达的档位。
 * 只返回能实际改善判级且达到本次检定难度的档位；幸运检定、SAN、伤害类结果、
 * 天然大失败、孤注一掷与已改过的检定返回空。
 */
export function luckSpendOptionsFor(
	check: LuckSpendCheck,
	luckCurrent: number,
): LuckSpendOption[] {
	if (
		check.skillKey === "luck" ||
		check.skillKey === "san" ||
		check.pushed === true ||
		check.luckSpent !== undefined ||
		check.outcome === "critical" ||
		check.outcome === "fumble" ||
		luckCurrent <= 0
	) {
		return [];
	}
	const currentRank = LUCK_OUTCOME_RANK[check.outcome];
	const candidates: Array<{
		outcome: LuckSpendOption["outcome"];
		threshold: number;
	}> = [
		{ outcome: "regular_success", threshold: check.targetValue },
		{ outcome: "hard_success", threshold: Math.floor(check.targetValue / 2) },
		{
			outcome: "extreme_success",
			threshold: Math.floor(check.targetValue / 5),
		},
	];
	const options: LuckSpendOption[] = [];
	const seenPoints = new Set<number>();
	for (const candidate of candidates) {
		if (candidate.threshold < 1) {
			continue;
		}
		const points = check.roll - candidate.threshold;
		if (points <= 0 || points > luckCurrent || seenPoints.has(points)) {
			continue;
		}
		seenPoints.add(points);
		const nextRoll = check.roll - points;
		const outcome =
			nextRoll === 1 ? "extreme_success" : candidate.outcome;
		if (LUCK_OUTCOME_RANK[outcome] <= currentRank) {
			continue;
		}
		const success = coc7eSkillCheckSuccess(outcome, check.difficulty);
		if (!success) {
			continue;
		}
		options.push({ points, outcome, success });
	}
	return options.sort((a, b) => a.points - b.points);
}

export function luckSpendOptions(
	result: SkillCheckResult,
	luckCurrent: number,
): LuckSpendOption[] {
	return luckSpendOptionsFor(result, luckCurrent);
}

/** 返回改骰后的检定结果；点数不是可达档位时返回 null。 */
export function applyLuckSpend(
	result: SkillCheckResult,
	points: number,
	luckCurrent: number,
): SkillCheckResult | null {
	const options = luckSpendOptions(result, luckCurrent);
	if (!options.some((option) => option.points === points)) {
		return null;
	}
	const originalRoll = result.originalRoll ?? result.roll;
	const roll = originalRoll - points;
	const outcome: CheckOutcome =
		roll === 1
			? "extreme_success"
			: coc7eSkillOutcome(result.targetValue, roll);
	const success = coc7eSkillCheckSuccess(outcome, result.difficulty);
	return {
		...result,
		roll,
		outcome,
		success,
		growthEligible: false,
		luckSpent: points,
		originalRoll,
		luckBefore: luckCurrent,
		luckAfter: luckCurrent - points,
	};
}

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
