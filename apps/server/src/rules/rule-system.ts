import type { RuleActionCommand, RuleMetadata } from "@cogm/shared";
import type { z } from "zod";
import { AppError } from "@/platform/errors/app-error";
import type { RandomSource } from "@/platform/ports";

export const RULE_API_VERSION = 1;

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

export interface SessionStateContext {
	sessionId: string;
	characterId: string;
}

export type CheckInput = { options: unknown } | { legacy: unknown } | undefined;

export interface StateMutationResult<TSessionState> {
	state: TSessionState;
	/** 越阈提示（重伤线/濒死/单次 SAN 损失 ≥ 5 等），仅提示不自动挂状态 */
	hints: string[];
}

export interface PermanentFieldEditInput {
	field: string;
	value: number;
}

export interface RuntimeCharacter<TSheet, TState> {
	id: string;
	name: string;
	kind: "pc" | "npc";
	sheet: TSheet;
	state: TState;
}

export interface RuleRuntime<TSheet, TState> {
	isGm: boolean;
	requested: boolean;
	hidden: boolean;
	random: RandomSource;
	ruleState: unknown;
	findCharacter(id: string): Promise<RuntimeCharacter<TSheet, TState> | null>;
}

export interface RuleMutation<TState> extends StateMutationResult<TState> {
	characterId: string;
}

export interface RuleCheckResult<TState> {
	result: unknown;
	mutations?: RuleMutation<TState>[];
}

export function unsupportedRuleAction(): never {
	throw new AppError(
		"RULE_ACTION_UNSUPPORTED",
		"This rule system does not support this action",
	);
}

export abstract class RuleSystem<TSheet, TSessionState> {
	abstract readonly id: string;
	abstract readonly metadata: RuleMetadata;
	abstract readonly characterSheetSchema: z.ZodType<TSheet>;
	abstract readonly sessionStateSchema: z.ZodType<TSessionState>;

	abstract validateCheckOptions(
		character: RuntimeCharacter<TSheet, TSessionState>,
		skillKey: string,
		input: CheckInput,
		runtime: RuleRuntime<TSheet, TSessionState>,
	): Promise<unknown>;
	abstract resolveCheck(
		character: RuntimeCharacter<TSheet, TSessionState>,
		skillKey: string,
		input: CheckInput,
		runtime: RuleRuntime<TSheet, TSessionState>,
	): Promise<RuleCheckResult<TSessionState>>;
	applyRuleAction?(
		command: RuleActionCommand,
		runtime: RuleRuntime<TSheet, TSessionState>,
	): Promise<{
		mutations?: RuleMutation<TSessionState>[];
		ruleState?: unknown;
	}>;
	viewRuleState?(
		state: unknown,
		viewer: { isGm: boolean; characterIds: readonly string[] },
	): unknown;
	reconcileRuleState?(
		state: unknown,
		isEnrolled: (characterId: string) => boolean,
	): unknown;
	abstract projectSyncState(state: TSessionState): Record<string, number>;

	/** 新建人物时的规则空卡 */
	abstract createEmptySheet(): TSheet;

	parseCharacterSheet?(
		input: ArrayBuffer,
		options?: CharacterSheetParseOptions,
	): Promise<CharacterSheetPreview<TSheet>>;

	abstract initializeSessionState(
		sheet: TSheet,
		context?: SessionStateContext,
	): TSessionState;
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
	/** GM 状态编辑：规则负责合并、钳制与阈值提示（edit 为 GM 指令的原始 JSON） */
	abstract applyGmStateEdit(
		state: TSessionState,
		edit: Record<string, unknown>,
	): StateMutationResult<TSessionState>;

	abstract viewSessionState(
		state: TSessionState,
		viewer: { hidden: boolean },
	): TSessionState;

	/** 规则声明的终生字段当前取值，供 GM 修改审计比较 */
	abstract readPermanentFields(sheet: TSheet): Record<string, number>;

	/** GM 修改规则声明的终生字段；未知字段抛错 */
	abstract applyPermanentFieldEdit(
		sheet: TSheet,
		edit: PermanentFieldEditInput,
	): TSheet;

	/** 读取规则卡中记录的调查员伙伴角色 ID（可选，供同团双向关联展示） */
	readPartnerCharacterIds?(sheet: TSheet): string[];
}
