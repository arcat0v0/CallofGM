import { coc7e, PerformCheckCommand, type RuleMetadata } from "@cogm/shared";
import { AppError } from "@/platform/errors/app-error";
import { validationFailed } from "@/platform/errors/validation";
import type { RandomSource } from "@/platform/ports";
import type {
	LuckCapability,
	LuckRecoveryResult,
	LuckSpendResult,
	SanCheckInput,
	SanityCheckCapability,
	SkillGrowthCapability,
} from "@/rules/capabilities";
import { evaluateLossExpression } from "@/rules/dice-engine";
import {
	type CharacterSheetPreview,
	type CheckInput,
	type PermanentFieldEditInput,
	RULE_API_VERSION,
	type RuleCheckResult,
	type RuleRuntime,
	RuleSystem,
	type RuntimeCharacter,
	type SessionStateContext,
	type StateMutationResult,
	unsupportedRuleAction,
} from "@/rules/rule-system";
import { parseCoc7eCharacterSheet } from "./excel-parser";
import { mergeCoc7eSheetPatch } from "./merge-patch";

const COC7E_PERMANENT_FIELDS = [
	"str",
	"con",
	"siz",
	"dex",
	"app",
	"int",
	"pow",
	"edu",
	"luck",
] as const;

const LegacyCheckOptions = PerformCheckCommand.pick({
	difficulty: true,
	bonusDice: true,
	penaltyDice: true,
});
type SkillCheckInput = Pick<
	PerformCheckCommand,
	"difficulty" | "bonusDice" | "penaltyDice"
> & {
	characterId: string;
	skillKey: string;
	targetValue: number;
};
type Character = RuntimeCharacter<
	coc7e.Coc7eCharacterSheet,
	coc7e.CharacterSessionState
>;
type Runtime = RuleRuntime<
	coc7e.Coc7eCharacterSheet,
	coc7e.CharacterSessionState
>;

export class Coc7eRuleSystem
	extends RuleSystem<coc7e.Coc7eCharacterSheet, coc7e.CharacterSessionState>
	implements
		SanityCheckCapability<coc7e.CharacterSessionState>,
		LuckCapability<coc7e.CharacterSessionState>,
		SkillGrowthCapability<coc7e.Coc7eCharacterSheet>
{
	readonly id = "coc7e";
	readonly metadata: RuleMetadata = {
		id: "coc7e",
		name: "克苏鲁的呼唤 第 7 版",
		version: "2.0.0",
		apiVersion: RULE_API_VERSION,
		description:
			"Call of Cthulhu 7th Edition：完整人物卡、技能专攻、衍生数值、理智检定与成长标记。",
		permanentSheetFields: [...COC7E_PERMANENT_FIELDS],
		permanentFieldRange: { min: 1, max: 99 },
	};
	readonly characterSheetSchema = coc7e.Coc7eCharacterSheet;
	readonly sessionStateSchema = coc7e.CharacterSessionState;
	readonly publicStateFields = coc7e.CharacterPublicStateField.options;

	createEmptySheet(): coc7e.Coc7eCharacterSheet {
		return coc7e.createEmptyCoc7eSheet({
			str: 50,
			con: 50,
			siz: 50,
			dex: 50,
			app: 50,
			int: 50,
			pow: 50,
			edu: 50,
			luck: 50,
		});
	}

	projectPublicSheet(
		sheet: coc7e.Coc7eCharacterSheet,
	): coc7e.Coc7eCharacterSheet {
		return coc7e.projectPublicCoc7eSheet(sheet);
	}

	recalculateStateOnSync(
		state: coc7e.CharacterSessionState,
		newSheet: coc7e.Coc7eCharacterSheet,
	): coc7e.CharacterSessionState {
		return coc7e.recalculateCoc7eStateOnSync(state, newSheet);
	}

	projectSyncState({ hp, maxHp, mp, maxMp, san, maxSan }: coc7e.CharacterSessionState) {
		return { hp, maxHp, mp, maxMp, san, maxSan };
	}

	mergeSheetPatch(
		base: coc7e.Coc7eCharacterSheet,
		patch: unknown,
	): coc7e.Coc7eCharacterSheet {
		return mergeCoc7eSheetPatch(base, patch);
	}

	readPermanentFields(
		sheet: coc7e.Coc7eCharacterSheet,
	): Record<string, number> {
		const result: Record<string, number> = {};
		for (const field of COC7E_PERMANENT_FIELDS) {
			result[field] = sheet.attributes[field];
		}
		return result;
	}

	readPartnerCharacterIds(sheet: coc7e.Coc7eCharacterSheet): string[] {
		const profile = sheet.backgroundProfile;
		const ids = profile.partners
			.map((partner) => partner.characterId)
			.filter((id): id is string => Boolean(id));
		if (ids.length === 0 && profile.partnerCharacterId) {
			ids.push(profile.partnerCharacterId);
		}
		return ids;
	}

	applyPermanentFieldEdit(
		sheet: coc7e.Coc7eCharacterSheet,
		edit: PermanentFieldEditInput,
	): coc7e.Coc7eCharacterSheet {
		if (!(COC7E_PERMANENT_FIELDS as readonly string[]).includes(edit.field)) {
			throw new AppError(
				"PERMANENT_FIELD_NOT_EDITABLE",
				`${edit.field} is not a permanent field of coc7e`,
				400,
			);
		}
		return this.characterSheetSchema.parse({
			...sheet,
			attributes: {
				...sheet.attributes,
				[edit.field]: Math.min(99, Math.max(1, Math.trunc(edit.value))),
			},
		});
	}

	applySkillGrowthBatch(
		sheet: coc7e.Coc7eCharacterSheet,
		gains: readonly { skillKey: string; delta: number }[],
	) {
		const applied: Array<{
			skillKey: string;
			oldValue: number;
			newValue: number;
		}> = [];
		for (const { skillKey, delta } of gains) {
			if (!coc7e.coc7eSkillGrowthAllowed(skillKey, 0)) continue;
			const before = this.getSkillTargetValue(sheet, skillKey) ?? 0;
			const value = Math.min(
				999,
				Math.max(0, before + Math.max(0, Math.trunc(delta))),
			);
			const canonicalKey =
				coc7e.canonicalizeCoc7eSkillKey(skillKey) ?? skillKey;
			sheet = this.characterSheetSchema.parse({
				...sheet,
				skills: { ...sheet.skills, [canonicalKey]: value },
			});
			const after = this.getSkillTargetValue(sheet, skillKey) ?? before;
			if (after !== before)
				applied.push({ skillKey, oldValue: before, newValue: after });
		}
		return { sheet, applied };
	}

	async parseCharacterSheet(
		input: ArrayBuffer,
		options?: import("@/rules/rule-system").CharacterSheetParseOptions,
	): Promise<CharacterSheetPreview<coc7e.Coc7eCharacterSheet>> {
		return parseCoc7eCharacterSheet(input, options);
	}

	initializeSessionState(
		sheet: coc7e.Coc7eCharacterSheet,
		context?: SessionStateContext,
	): coc7e.CharacterSessionState {
		const derived = coc7e.deriveCoc7eSheetStats(sheet);
		return {
			schemaVersion: 1,
			sessionId: context?.sessionId ?? "",
			characterId: context?.characterId ?? "",
			hp: derived.maxHp,
			maxHp: derived.maxHp,
			mp: derived.maxMp,
			maxMp: derived.maxMp,
			san: derived.initialSan,
			maxSan: derived.maxSan,
			luck: sheet.attributes.luck,
			statuses: [],
			tags: [],
			growthMarks: [],
			hiddenGrowthMarks: [],
		};
	}

	private readCheckInput(
		character: Character,
		skillKey: string,
		input: CheckInput,
	): SkillCheckInput {
		if (input && "options" in input) unsupportedRuleAction();
		const options = LegacyCheckOptions.safeParse(input ? input.legacy : {});
		if (!options.success) throw validationFailed(options.error);
		const targetValue = this.getSkillTargetValue(character.sheet, skillKey);
		if (targetValue === null)
			throw new AppError(
				"SKILL_NOT_FOUND",
				"Skill or attribute not found on character sheet",
				400,
			);
		return {
			...options.data,
			targetValue,
			characterId: character.id,
			skillKey,
		};
	}

	async validateCheckOptions(
		character: Character,
		skillKey: string,
		input: CheckInput,
	): Promise<undefined> {
		this.readCheckInput(character, skillKey, input);
		return undefined;
	}

	async resolveCheck(
		character: Character,
		skillKey: string,
		input: CheckInput,
		runtime: Runtime,
	): Promise<RuleCheckResult<coc7e.CharacterSessionState>> {
		const result = this.evaluateSkillCheck(
			this.readCheckInput(character, skillKey, input),
			runtime.random,
		);
		if (!result.growthEligible) return { result };
		const state = runtime.hidden
			? this.markSkillGrowthHidden(character.state, skillKey)
			: this.markSkillGrowth(character.state, skillKey);
		return {
			result,
			mutations: [{ characterId: character.id, state, hints: [] }],
		};
	}

	evaluateSkillCheck(
		input: SkillCheckInput,
		random: RandomSource,
	): coc7e.SkillCheckResult {
		const {
			characterId,
			skillKey,
			targetValue,
			difficulty,
			bonusDice,
			penaltyDice,
		} = input;
		const unitsDigit = random.randomInt(0, 9);
		const netBonus = Math.max(0, bonusDice - penaltyDice);
		const netPenalty = Math.max(0, penaltyDice - bonusDice);
		const numTensDice = Math.max(netBonus, netPenalty) + 1;
		const tensCandidates: number[] = [];
		for (let i = 0; i < numTensDice; i++) {
			tensCandidates.push(random.randomInt(0, 9));
		}

		const rollValues = tensCandidates.map((tensDigit) => {
			if (tensDigit === 0 && unitsDigit === 0) {
				return 100;
			}
			return tensDigit * 10 + unitsDigit;
		});

		let selectedValue = rollValues[0] ?? 100;
		if (netBonus > 0) {
			selectedValue = Math.min(...rollValues);
		} else if (netPenalty > 0) {
			selectedValue = Math.max(...rollValues);
		}

		const outcome = coc7e.coc7eSkillOutcome(targetValue, selectedValue);
		const success = coc7e.coc7eSkillCheckSuccess(outcome, difficulty);

		return {
			characterId,
			skillKey,
			targetValue,
			difficulty,
			bonusDice,
			penaltyDice,
			tensCandidates,
			roll: selectedValue,
			outcome,
			success,
			growthEligible:
				coc7e.coc7eSkillGrowthAllowed(skillKey, bonusDice) &&
				(outcome === "critical" ||
					outcome === "extreme_success" ||
					outcome === "hard_success" ||
					outcome === "regular_success"),
		};
	}

	evaluateSanCheck(
		input: SanCheckInput,
		random: RandomSource,
	): coc7e.SanCheckResult {
		const { characterId, sanCurrent, successLoss, failureLoss } = input;
		const roll = random.randomInt(1, 100);
		const success = roll <= sanCurrent;
		const lossExpression = success ? successLoss : failureLoss;
		const loss = Math.max(0, evaluateLossExpression(lossExpression, random));
		const sanAfter = Math.max(0, sanCurrent - loss);

		return {
			characterId,
			sanBefore: sanCurrent,
			roll,
			success,
			lossExpression,
			loss,
			sanAfter,
		};
	}

	getSkillTargetValue(
		sheet: coc7e.Coc7eCharacterSheet,
		skillKey: string,
	): number | null {
		return coc7e.coc7eSkillTargetValue(sheet, skillKey);
	}

	getSanCurrent(state: coc7e.CharacterSessionState): number {
		return state.san;
	}

	applyGmStateEdit(
		state: coc7e.CharacterSessionState,
		edit: Record<string, unknown>,
	): StateMutationResult<coc7e.CharacterSessionState> {
		const next: coc7e.CharacterSessionState = {
			...state,
			statuses: [...state.statuses],
			tags: [...state.tags],
			growthMarks: [...state.growthMarks],
			hiddenGrowthMarks: [...state.hiddenGrowthMarks],
		};
		const hints: string[] = [];

		const parsedEdit = coc7e.Coc7eStateEditInput.safeParse(edit);
		if (!parsedEdit.success) {
			const field = parsedEdit.error.issues[0]?.path.join(".") || "value";
			throw new AppError(
				"STATE_EDIT_OUT_OF_RANGE",
				`${field} must stay within the CoC 7e range (0-99)`,
				400,
				{ field },
			);
		}
		const editInput = parsedEdit.data;

		const readInt = (key: keyof typeof editInput): number | undefined => {
			const value = editInput[key];
			return typeof value === "number" && Number.isInteger(value)
				? value
				: undefined;
		};
		const readStringArray = (key: keyof typeof editInput): string[] => {
			const value = editInput[key];
			return Array.isArray(value)
				? value.filter((v): v is string => typeof v === "string")
				: [];
		};

		const maxHp = readInt("maxHp") ?? next.maxHp;
		const maxMp = readInt("maxMp") ?? next.maxMp;
		const maxSan = readInt("maxSan") ?? next.maxSan;
		next.maxHp = Math.min(99, Math.max(1, maxHp));
		next.maxMp = Math.min(99, Math.max(0, maxMp));
		next.maxSan = Math.min(99, Math.max(0, maxSan));

		const hpDelta = readInt("hpDelta") ?? 0;
		const mpDelta = readInt("mpDelta") ?? 0;
		const sanDelta = readInt("sanDelta") ?? 0;
		const luckDelta = readInt("luckDelta") ?? 0;

		const hpBefore = next.hp;
		const sanBefore = next.san;

		next.hp = this.clamp(readInt("hp") ?? next.hp + hpDelta, 0, next.maxHp);
		next.mp = this.clamp(readInt("mp") ?? next.mp + mpDelta, 0, next.maxMp);
		next.san = this.clamp(
			readInt("san") ?? next.san + sanDelta,
			0,
			next.maxSan,
		);
		next.luck = this.clamp(
			readInt("luck") ?? next.luck + luckDelta,
			0,
			99,
		);

		const hpLoss = hpBefore - next.hp;
		if (hpLoss > 0 && hpLoss * 2 >= next.maxHp) {
			hints.push(`单次伤害 ${hpLoss} 达到 HP 上限一半，考虑标记「重伤」`);
		}
		if (next.hp === 0 && hpBefore > 0) {
			hints.push("HP 归零，考虑标记「濒死」或「死亡」");
		}
		const sanLoss = sanBefore - next.san;
		if (sanLoss >= 5) {
			hints.push(`单次 SAN 损失 ${sanLoss} ≥ 5，考虑标记「临时疯狂」`);
		}

		for (const status of readStringArray("addStatuses")) {
			const parsed = coc7e.CharacterStatusFlag.safeParse(status);
			if (parsed.success && !next.statuses.includes(parsed.data)) {
				next.statuses.push(parsed.data);
			}
		}
		const removeStatuses = new Set(readStringArray("removeStatuses"));
		if (removeStatuses.size > 0) {
			next.statuses = next.statuses.filter((s) => !removeStatuses.has(s));
		}

		for (const tag of readStringArray("addTags")) {
			if (tag.trim() !== "" && !next.tags.includes(tag)) {
				next.tags.push(tag);
			}
		}
		const removeTags = new Set(readStringArray("removeTags"));
		if (removeTags.size > 0) {
			next.tags = next.tags.filter((t) => !removeTags.has(t));
		}

		const validated = this.sessionStateSchema.parse(next);
		return { state: validated, hints };
	}

	getLuckCurrent(state: coc7e.CharacterSessionState): number {
		return state.luck;
	}

	spendLuckOnCheck(
		state: coc7e.CharacterSessionState,
		checkResult: unknown,
		points: number,
	): LuckSpendResult<coc7e.CharacterSessionState> {
		const parsed = coc7e.SkillCheckResult.safeParse(checkResult);
		if (!parsed.success) {
			throw new AppError(
				"LUCK_SPEND_NOT_ALLOWED",
				"Only skill or attribute check results can be amended with luck",
				400,
			);
		}
		const result = parsed.data;
		if (
			result.skillKey === "luck" ||
			result.skillKey === "san" ||
			result.outcome === "fumble" ||
			result.pushed === true
		) {
			throw new AppError(
				"LUCK_SPEND_NOT_ALLOWED",
				"This check cannot be amended with luck",
				400,
			);
		}
		if (result.luckSpent !== undefined) {
			throw new AppError(
				"LUCK_SPEND_ALREADY_USED",
				"Luck has already been spent on this check",
				409,
			);
		}
		if (!Number.isInteger(points) || points < 1) {
			throw new AppError(
				"LUCK_SPEND_INVALID_POINTS",
				"Luck points must be a positive integer",
				400,
			);
		}
		if (points > state.luck) {
			throw new AppError(
				"LUCK_SPEND_INSUFFICIENT",
				"Not enough current luck",
				400,
				{ luckCurrent: state.luck, points },
			);
		}
		const amended = coc7e.applyLuckSpend(result, points, state.luck);
		if (!amended) {
			throw new AppError(
				"LUCK_SPEND_INVALID_POINTS",
				"Luck points do not match an available improvement tier",
				400,
			);
		}
		const next: coc7e.CharacterSessionState = {
			...state,
			luck: state.luck - points,
			growthMarks: state.growthMarks.filter(
				(skillKey) => skillKey !== result.skillKey,
			),
			hiddenGrowthMarks: state.hiddenGrowthMarks.filter(
				(skillKey) => skillKey !== result.skillKey,
			),
		};
		return {
			state: this.sessionStateSchema.parse(next),
			result: amended,
		};
	}

	recoverLuck(
		state: coc7e.CharacterSessionState,
		random: RandomSource,
	): LuckRecoveryResult<coc7e.CharacterSessionState> {
		const before = state.luck;
		const roll = random.randomInt(1, 100);
		const rolledGain = roll > before ? random.randomInt(1, 10) : 0;
		const after = Math.min(99, before + rolledGain);
		return {
			state: this.sessionStateSchema.parse({ ...state, luck: after }),
			roll,
			before,
			after,
			gain: after - before,
		};
	}

	applySanLoss(
		state: coc7e.CharacterSessionState,
		loss: number,
	): StateMutationResult<coc7e.CharacterSessionState> {
		const hints: string[] = [];
		const next: coc7e.CharacterSessionState = {
			...state,
			san: Math.max(0, state.san - Math.max(0, loss)),
		};
		if (loss >= 5) {
			hints.push(`单次 SAN 损失 ${loss} ≥ 5，考虑标记「临时疯狂」`);
		}
		const validated = this.sessionStateSchema.parse(next);
		return { state: validated, hints };
	}

	markSkillGrowth(
		state: coc7e.CharacterSessionState,
		skillKey: string,
	): coc7e.CharacterSessionState {
		if (
			!coc7e.coc7eSkillGrowthAllowed(skillKey, 0) ||
			state.growthMarks.includes(skillKey)
		) {
			return state;
		}
		return this.sessionStateSchema.parse({
			...state,
			growthMarks: [...state.growthMarks, skillKey],
		});
	}

	markSkillGrowthHidden(
		state: coc7e.CharacterSessionState,
		skillKey: string,
	): coc7e.CharacterSessionState {
		if (
			!coc7e.coc7eSkillGrowthAllowed(skillKey, 0) ||
			state.hiddenGrowthMarks.includes(skillKey)
		) {
			return state;
		}
		return this.sessionStateSchema.parse({
			...state,
			hiddenGrowthMarks: [...state.hiddenGrowthMarks, skillKey],
		});
	}

	projectPublicSessionState(
		state: coc7e.CharacterSessionState,
		fields: readonly string[],
	): unknown {
		const selected = [...new Set(fields)];
		if (selected.length === 0) {
			return null;
		}
		const invalid = selected.find(
			(field) =>
				!(
					coc7e.CharacterPublicStateField.options as readonly string[]
				).includes(field),
		);
		if (invalid !== undefined) {
			throw new AppError(
				"VALIDATION_FAILED",
				`${invalid} is not a public state field of coc7e`,
				400,
			);
		}
		const projected: Record<string, unknown> = {};
		if (selected.includes("hp")) {
			projected.hp = state.hp;
			projected.maxHp = state.maxHp;
		}
		if (selected.includes("mp")) {
			projected.mp = state.mp;
			projected.maxMp = state.maxMp;
		}
		if (selected.includes("san")) {
			projected.san = state.san;
			projected.maxSan = state.maxSan;
		}
		if (selected.includes("statuses")) {
			projected.statuses = state.statuses;
		}
		return coc7e.CharacterPublicSessionState.parse(projected);
	}

	viewSessionState(
		state: coc7e.CharacterSessionState,
		viewer: { hidden: boolean },
	): coc7e.CharacterSessionState {
		if (viewer.hidden) {
			return state;
		}
		return {
			...state,
			hiddenGrowthMarks: [],
		};
	}

	private clamp(value: number, min: number, max: number): number {
		return Math.min(max, Math.max(min, value));
	}
}
