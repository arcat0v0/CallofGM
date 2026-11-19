import { type CheckRequestDto, dnd5r } from "@cogm/shared";
import { t } from "@/i18n";
import { stampOutcome } from "../check-outcome";
import type {
	RuleCheckDiceAnimation,
	RuleCheckEvent,
	RuleCheckEventView,
} from "../types";
import { checkLabel, damageLabel, signed } from "./labels";

export function formatCheckRequest(request: CheckRequestDto): string {
	const options = dnd5r.CheckOptions.safeParse(request.options);
	const parts = [checkLabel(request.skillKey)];
	if (options.success) {
		parts.push(t(`dnd5r.check.mode.${options.data.mode ?? "normal"}`));
		if (options.data.dc !== undefined) parts.push(`DC ${options.data.dc}`);
	}
	return parts.join(" · ");
}

export function formatCheckEvent({
	skillKey,
	characterId,
	result,
}: RuleCheckEvent): RuleCheckEventView {
	const skill = skillKey ? checkLabel(skillKey) : t("chat.role.check");
	const success = typeof result.success === "boolean" ? result.success : null;
	const outcome = typeof result.outcome === "string" ? result.outcome : "";
	const stamp = stampOutcome(outcome, success);
	const label = outcome
		? t(`dnd5r.outcome.${outcome}`)
		: success === true
			? t("message.outcome.success")
			: t("message.outcome.failure");
	const parsed = dnd5r.CheckResult.safeParse(result);
	if (!parsed.success) {
		return {
			roleLabel: t("chat.role.check"),
			summaryText: `${skill} ${String(result.roll)}/${String(result.targetValue)} · ${label}`,
			check: {
				skill,
				skillKey,
				characterId,
				roll: typeof result.roll === "number" ? result.roll : 0,
				target: typeof result.targetValue === "number" ? result.targetValue : 0,
				difficulty: t("dnd5r.check.d20"),
				outcomeKey: outcome,
				outcome: stamp,
				label,
			},
		};
	}
	const d20 = parsed.data;
	const mode = t(`dnd5r.check.mode.${d20.mode}`);
	const dc = d20.dc === null ? "" : ` · DC ${d20.dc}`;
	const damage = d20.damage
		? ` · ${t("chat.d20Damage", { total: d20.damage.total, type: damageLabel(d20.damage.type) })}`
		: "";
	return {
		roleLabel: t("chat.role.check"),
		summaryText: `${skill} · ${d20.total} (${d20.rolls.join("/")}${signed(d20.modifier)})${dc} · ${label}${damage}`,
		check: {
			skill,
			skillKey,
			characterId,
			roll: d20.roll,
			target: d20.dc ?? 0,
			difficulty: mode,
			outcomeKey: outcome,
			outcome: stamp,
			label,
			d20,
		},
	};
}

export function buildCheckDiceAnimation(
	result: Record<string, unknown>,
): RuleCheckDiceAnimation | null {
	const parsed = dnd5r.CheckResult.safeParse(result);
	if (!parsed.success) return null;
	const { rolls, total } = parsed.data;
	return {
		kind: "roll",
		faces: 20,
		rolls,
		total,
		label: t("dice.animationResult", { total }),
	};
}
