import { type CheckRequestDto, coc7e } from "@cogm/shared";
import { t } from "@/i18n";
import { stampOutcome } from "../check-outcome";
import type {
	RuleCheckDiceAnimation,
	RuleCheckEvent,
	RuleCheckEventView,
} from "../types";
import { checkDiceModifier, parseTensCandidates } from "./check-dice";
import {
	difficultyLabel,
	difficultyThreshold,
	outcomeLabel,
} from "./sheet-data";

export function formatCheckRequest(request: CheckRequestDto): string {
	return `${coc7e.coc7eSkillLabel(request.skillKey)} · ${difficultyLabel(request.difficulty)}`;
}

export function formatCheckEvent({
	skillKey,
	characterId,
	result,
}: RuleCheckEvent): RuleCheckEventView {
	const skill =
		skillKey === "luck"
			? t("chat.destinyCheck")
			: skillKey
				? coc7e.coc7eSkillLabel(skillKey)
				: t("chat.role.check");
	const success = typeof result.success === "boolean" ? result.success : null;
	const outcome = typeof result.outcome === "string" ? result.outcome : "";
	const stamp = stampOutcome(outcome, success);
	const label = outcome
		? outcomeLabel(outcome)
		: success === true
			? t("message.outcome.success")
			: t("message.outcome.failure");
	if (skillKey === "san") {
		const roll = result.roll;
		const loss = result.loss;
		const after = result.sanAfter;
		const before = result.sanBefore;
		const rollValue = typeof roll === "number" ? roll : 0;
		const afterValue = typeof after === "number" ? after : 0;
		const lossValue = typeof loss === "number" ? loss : 0;
		const beforeValue =
			typeof before === "number" ? before : afterValue + lossValue;
		const ok =
			success === true
				? t("message.outcome.success")
				: t("message.outcome.failure");
		return {
			roleLabel: t("chat.role.san"),
			summaryText: t("message.sanCheck", {
				roll: String(rollValue),
				outcome: ok,
				loss: String(lossValue),
				after: String(afterValue),
			}),
			check: {
				skill,
				roll: rollValue,
				target: beforeValue,
				difficulty: "regular",
				outcome: stamp,
				label,
				san: { before: beforeValue, after: afterValue, loss: lossValue },
			},
		};
	}
	const roll = result.roll;
	const target = result.targetValue;
	const difficulty =
		coc7e.CheckDifficulty.safeParse(result.difficulty).data ?? "regular";
	const context =
		typeof target === "number"
			? difficulty === "regular"
				? t("message.checkTarget", { target })
				: t("message.checkThreshold", {
						target,
						label: difficultyLabel(difficulty),
						threshold: difficultyThreshold(target, difficulty),
					})
			: null;
	const targetValue = typeof target === "number" ? target : 0;
	const threshold = difficultyThreshold(targetValue, difficulty);
	const luckSpent =
		typeof result.luckSpent === "number" ? result.luckSpent : undefined;
	const originalRoll =
		typeof result.originalRoll === "number" ? result.originalRoll : undefined;
	const luckBefore =
		typeof result.luckBefore === "number" ? result.luckBefore : undefined;
	const luckAfter =
		typeof result.luckAfter === "number" ? result.luckAfter : undefined;
	return {
		roleLabel: t("chat.role.check"),
		summaryText: `${skill} ${String(roll)}/${String(target)} · ${label}${context ? `（${context}）` : ""}`,
		check: {
			skill,
			skillKey,
			characterId,
			baseTarget: targetValue,
			skillNote:
				skillKey === "luck"
					? t("chat.luckCheckValue", {
							roll: String(roll ?? 0),
							target: String(targetValue),
						})
					: undefined,
			roll: typeof roll === "number" ? roll : 0,
			target: threshold,
			difficulty: difficultyLabel(difficulty),
			difficultyKey: difficulty,
			outcomeKey: outcome,
			outcome: stamp,
			label,
			luckSpent,
			originalRoll,
			luckBefore,
			luckAfter,
			pushed: result.pushed === true,
			diceModifier: checkDiceModifier(result) ?? undefined,
		},
	};
}

export function buildCheckDiceAnimation(
	result: Record<string, unknown>,
): RuleCheckDiceAnimation | null {
	const roll =
		typeof result.roll === "number" && Number.isFinite(result.roll)
			? result.roll
			: null;
	if (roll === null) return null;
	const outcome =
		typeof result.outcome === "string"
			? result.outcome
			: String(result.success ?? "unknown");
	const modifier = checkDiceModifier(result);
	const tensCandidates = parseTensCandidates(result.tensCandidates);
	return {
		kind: "check",
		roll,
		outcome,
		...(modifier ? { tensCandidates } : {}),
		label: t("dice.animationResult", { total: roll }),
		...(modifier
			? {
					caption: t(
						modifier.kind === "bonus"
							? "dice.animationBonus"
							: "dice.animationPenalty",
						{
							candidates: modifier.candidates.join(" / "),
							picked: modifier.picked,
						},
					),
				}
			: {}),
	};
}

export function formatRecovery(payload: Record<string, unknown>): string {
	const roll = typeof payload.roll === "number" ? payload.roll : 0;
	const before =
		typeof payload.luckBefore === "number" ? payload.luckBefore : 0;
	const after =
		typeof payload.luckAfter === "number" ? payload.luckAfter : before;
	const gain = typeof payload.gain === "number" ? payload.gain : 0;
	return gain > 0
		? t("message.luckRecovered", {
				roll: String(roll),
				before: String(before),
				gain: String(gain),
				after: String(after),
			})
		: t("message.luckRecoveryNoGain", {
				roll: String(roll),
				before: String(before),
			});
}
