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
