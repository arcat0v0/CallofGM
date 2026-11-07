import { coc7e } from "@cogm/shared";
import { AppError } from "@/platform/errors/app-error";
import type { RandomSource } from "@/platform/ports";
import { evaluateLossExpression } from "@/rules/dice-engine";
import {
	type CharacterSheetPreview,
	type PermanentFieldEditInput,
	RULE_API_VERSION,
	type RuleMetadata,
	RuleSystem,
	type SanCheckInput,
	type SkillCheckInput,
	type StateMutationResult,
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

export class Coc7eRuleSystem extends RuleSystem<
	coc7e.Coc7eCharacterSheet,
	coc7e.CharacterSessionState
> {
	readonly id = "coc7e";
	readonly metadata: RuleMetadata = {
		id: "coc7e",
		name: "克苏鲁的呼唤 第 7 版",
		version: "2.0.0",
		apiVersion: RULE_API_VERSION,
		description:
			"Call of Cthulhu 7th Edition：完整人物卡、技能专攻、衍生数值、理智检定与成长标记。",
		permanentSheetFields: [...COC7E_PERMANENT_FIELDS],
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

	applySkillGrowth(
		sheet: coc7e.Coc7eCharacterSheet,
		skillKey: string,
		delta: number,
	): coc7e.Coc7eCharacterSheet {
		const current =
			sheet.skills[skillKey] ??
			coc7e.coc7eSkillTargetValue(sheet, skillKey) ??
			0;
		const next = Math.min(
			999,
			Math.max(0, current + Math.max(0, Math.trunc(delta))),
		);
		const canonicalKey = coc7e.canonicalizeCoc7eSkillKey(skillKey) ?? skillKey;
		return this.characterSheetSchema.parse({
			...sheet,
			skills: { ...sheet.skills, [canonicalKey]: next },
		});
	}

	async parseCharacterSheet(
		input: ArrayBuffer,
		options?: import("@/rules/rule-system").CharacterSheetParseOptions,
	): Promise<CharacterSheetPreview<coc7e.Coc7eCharacterSheet>> {
		return parseCoc7eCharacterSheet(input, options);
	}

	initializeSessionState(
		sheet: coc7e.Coc7eCharacterSheet,
	): coc7e.CharacterSessionState {
		const derived = coc7e.deriveCoc7eSheetStats(sheet);
		return {
			schemaVersion: 1,
			sessionId: "",
			characterId: "",
			hp: derived.maxHp,
			maxHp: derived.maxHp,
			mp: derived.maxMp,
			maxMp: derived.maxMp,
			san: derived.initialSan,
			maxSan: derived.maxSan,
			statuses: [],
			tags: [],
			growthMarks: [],
			hiddenGrowthMarks: [],
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

		let outcome: coc7e.CheckOutcome;
		const isFumble =
			targetValue >= 50 ? selectedValue === 100 : selectedValue >= 96;

		if (selectedValue === 1) {
			outcome = "critical";
		} else if (isFumble) {
			outcome = "fumble";
		} else if (selectedValue <= Math.floor(targetValue / 5)) {
			outcome = "extreme_success";
		} else if (selectedValue <= Math.floor(targetValue / 2)) {
			outcome = "hard_success";
		} else if (selectedValue <= targetValue) {
			outcome = "regular_success";
		} else {
			outcome = "failure";
		}

		// 判定是否达到 GM 指定的难度等级：常规需常规成功及以上，困难需困难成功及以上，极难需极难成功及以上
		let success: boolean;
		switch (outcome) {
			case "critical":
			case "extreme_success":
				success = true;
				break;
			case "hard_success":
				success = difficulty !== "extreme";
				break;
			case "regular_success":
				success = difficulty === "regular";
				break;
			default:
				success = false;
		}

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

		const hpBefore = next.hp;
		const sanBefore = next.san;

		next.hp = this.clamp(readInt("hp") ?? next.hp + hpDelta, 0, next.maxHp);
		next.mp = this.clamp(readInt("mp") ?? next.mp + mpDelta, 0, next.maxMp);
		next.san = this.clamp(
			readInt("san") ?? next.san + sanDelta,
			0,
			next.maxSan,
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
