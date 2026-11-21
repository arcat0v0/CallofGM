import type { RandomSource } from "@/platform/ports";
import {
	type RuleSystem,
	type StateMutationResult,
	unsupportedRuleAction,
} from "./rule-system";

export interface SanCheckInput {
	characterId: string;
	sanCurrent: number;
	successLoss: string;
	failureLoss: string;
}

export interface SanityCheckCapability<TState> {
	getSanCurrent(state: TState): number;
	evaluateSanCheck(
		input: SanCheckInput,
		random: RandomSource,
	): { loss: number };
	applySanLoss(state: TState, loss: number): StateMutationResult<TState>;
}

export interface LuckSpendResult<TState> {
	state: TState;
	result: { luckSpent?: number; luckAfter?: number };
}

export interface LuckRecoveryResult<TState> {
	state: TState;
	roll: number;
	before: number;
	after: number;
	gain: number;
}

export interface LuckCapability<TState> {
	getLuckCurrent(state: TState): number;
	spendLuckOnCheck(
		state: TState,
		checkResult: unknown,
		points: number,
	): LuckSpendResult<TState>;
	recoverLuck(state: TState, random: RandomSource): LuckRecoveryResult<TState>;
}

export interface SkillGrowthCapability<TSheet> {
	applySkillGrowthBatch(
		sheet: TSheet,
		gains: readonly { skillKey: string; delta: number }[],
	): {
		sheet: TSheet;
		applied: Array<{ skillKey: string; oldValue: number; newValue: number }>;
	};
}

export function requireSanityCheckCapability<TSheet, TState>(
	rule: RuleSystem<TSheet, TState>,
): SanityCheckCapability<TState> {
	if (
		!("getSanCurrent" in rule && typeof rule.getSanCurrent === "function") ||
		!(
			"evaluateSanCheck" in rule && typeof rule.evaluateSanCheck === "function"
		) ||
		!("applySanLoss" in rule && typeof rule.applySanLoss === "function")
	) {
		unsupportedRuleAction();
	}
	return rule as SanityCheckCapability<TState>;
}

export function requireLuckCapability<TSheet, TState>(
	rule: RuleSystem<TSheet, TState>,
): LuckCapability<TState> {
	if (
		!("getLuckCurrent" in rule && typeof rule.getLuckCurrent === "function") ||
		!(
			"spendLuckOnCheck" in rule && typeof rule.spendLuckOnCheck === "function"
		) ||
		!("recoverLuck" in rule && typeof rule.recoverLuck === "function")
	) {
		unsupportedRuleAction();
	}
	return rule as LuckCapability<TState>;
}

export function requireSkillGrowthCapability<TSheet, TState>(
	rule: RuleSystem<TSheet, TState>,
): SkillGrowthCapability<TSheet> {
	if (
		!(
			"applySkillGrowthBatch" in rule &&
			typeof rule.applySkillGrowthBatch === "function"
		)
	) {
		unsupportedRuleAction();
	}
	return rule as SkillGrowthCapability<TSheet>;
}

/**
 * 车卡属性生成（可选能力）：规则声明 GM 可在提交链接上设定的生成方式，
 * 并由服务端注入随机源一次性掷出结果。通用代码只保存/转发不透明 JSON。
 */
export interface CharacterCreationCapability {
	/** 校验并规范化 GM 提交的生成方式；非法时抛出校验错误 */
	parseCreationOptions(input: unknown): unknown;
	rollCreation(options: unknown, random: RandomSource): unknown;
	/** 结果中可供玩家选择的套数（无需选择时为 1） */
	creationChoiceCount(result: unknown): number;
}

export function findCharacterCreationCapability<TSheet, TState>(
	rule: RuleSystem<TSheet, TState>,
): CharacterCreationCapability | null {
	if (
		"parseCreationOptions" in rule &&
		typeof rule.parseCreationOptions === "function" &&
		"rollCreation" in rule &&
		typeof rule.rollCreation === "function" &&
		"creationChoiceCount" in rule &&
		typeof rule.creationChoiceCount === "function"
	) {
		return rule as unknown as CharacterCreationCapability;
	}
	return null;
}
