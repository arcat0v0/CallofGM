import type { z } from "zod";
import type { RandomSource } from "@/platform/ports";

export const RULE_API_VERSION = 1;

export interface RuleMetadata {
	id: string;
	name: string;
	/** 规则实现自身 semver */
	version: string;
	/** 与核心契约兼容的版本；不匹配的规则不出现在选择器 */
	apiVersion: number;
	description: string;
	/** 本规则声明 GM 可跨团修正的终生字段 */
	permanentSheetFields: string[];
}

export interface CharacterSheetPreview<T> {
	characterName: string;
	sheetData: T;
	errors: Array<{
		cell: string;
		message: string;
	}>;
	warnings?: Array<{
		cell: string;
		message: string;
	}>;
	patch?: unknown;
	providedFields?: string[];
	nameProvided?: boolean;
}

export interface CharacterSheetParseOptions {
	partial?: boolean;
}

export interface SkillCheckInput {
	characterId: string;
	skillKey: string;
	targetValue: number;
	difficulty: "regular" | "hard" | "extreme";
	bonusDice: number;
	penaltyDice: number;
}

export interface SanCheckInput {
	characterId: string;
	sanCurrent: number;
	/** 成功时损失表达式（如 "0"、"1"、"1d3"） */
	successLoss: string;
	/** 失败时损失表达式（如 "1d6"、"1d10"） */
	failureLoss: string;
}

export interface StateMutationResult<TSessionState> {
	state: TSessionState;
	/** 越阈提示（重伤线/濒死/单次 SAN 损失 ≥ 5 等），仅提示不自动挂状态 */
	hints: string[];
}

export interface LuckSpendResult<TSessionState> {
	state: TSessionState;
	result: unknown;
}

export interface LuckRecoveryResult<TSessionState> {
	state: TSessionState;
	roll: number;
	before: number;
	after: number;
	gain: number;
}

export interface PermanentFieldEditInput {
	field: string;
	value: number;
}

export abstract class RuleSystem<TSheet, TSessionState> {
	abstract readonly id: string;
	abstract readonly metadata: RuleMetadata;
	abstract readonly characterSheetSchema: z.ZodType<TSheet>;
	abstract readonly sessionStateSchema: z.ZodType<TSessionState>;

	/** 新建人物时的规则空卡 */
	abstract createEmptySheet(): TSheet;

	parseCharacterSheet?(
		input: ArrayBuffer,
		options?: CharacterSheetParseOptions,
	): Promise<CharacterSheetPreview<TSheet>>;

	abstract initializeSessionState(sheet: TSheet): TSessionState;
	abstract recalculateStateOnSync(
		state: TSessionState,
		newSheet: TSheet,
	): TSessionState;
	abstract projectPublicSheet(sheet: TSheet): unknown;
	abstract mergeSheetPatch(base: TSheet, patch: unknown): TSheet;
	abstract readonly publicStateFields: readonly string[];
	abstract projectPublicSessionState(
		state: TSessionState,
		fields: readonly string[],
	): unknown;
	abstract evaluateSkillCheck(
		input: SkillCheckInput,
		random: RandomSource,
	): unknown;
	abstract evaluateSanCheck(
		input: SanCheckInput,
		random: RandomSource,
	): unknown;

	/** 从人物卡读取指定技能/属性的目标值；不存在返回 null */
	abstract getSkillTargetValue(sheet: TSheet, skillKey: string): number | null;

	/** 从团内状态读取当前 SAN（无 SAN 概念的规则应抛出 RULE_ACTION_UNSUPPORTED） */
	abstract getSanCurrent(state: TSessionState): number;

	/** GM 状态编辑：规则负责合并、钳制与阈值提示（edit 为 GM 指令的原始 JSON） */
	abstract applyGmStateEdit(
		state: TSessionState,
		edit: Record<string, unknown>,
	): StateMutationResult<TSessionState>;

	/** 当前幸运值（无幸运概念的规则应抛出 RULE_ACTION_UNSUPPORTED） */
	abstract getLuckCurrent(state: TSessionState): number;

	/** 花费幸运修正一条检定结果；不可花费时抛出对应错误 */
	abstract spendLuckOnCheck(
		state: TSessionState,
		checkResult: unknown,
		points: number,
	): LuckSpendResult<TSessionState>;

	/** 幸运恢复检定；结果由通用业务层广播 */
	abstract recoverLuck(
		state: TSessionState,
		random: RandomSource,
	): LuckRecoveryResult<TSessionState>;

	/** SAN 自动扣减（理智检定入口） */
	abstract applySanLoss(
		state: TSessionState,
		loss: number,
	): StateMutationResult<TSessionState>;

	abstract viewSessionState(
		state: TSessionState,
		viewer: { hidden: boolean },
	): TSessionState;

	/** 鉴定常规成功及以上时的成长标记写入 */
	abstract markSkillGrowth(
		state: TSessionState,
		skillKey: string,
	): TSessionState;

	abstract markSkillGrowthHidden(
		state: TSessionState,
		skillKey: string,
	): TSessionState;

	/** 规则声明的终生字段当前取值，供 GM 修改审计比较 */
	abstract readPermanentFields(sheet: TSheet): Record<string, number>;

	/** GM 修改规则声明的终生字段；未知字段抛错 */
	abstract applyPermanentFieldEdit(
		sheet: TSheet,
		edit: PermanentFieldEditInput,
	): TSheet;

	/** 增量成长写回人物卡技能（结团确认后调用）；不存在的技能按本次增量新建 */
	abstract applySkillGrowth(
		sheet: TSheet,
		skillKey: string,
		delta: number,
	): TSheet;

	/** 读取规则卡中记录的调查员伙伴角色 ID（可选，供同团双向关联展示） */
	readPartnerCharacterIds?(sheet: TSheet): string[];
}
