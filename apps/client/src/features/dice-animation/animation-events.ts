import type { SessionEvent } from "@cogm/shared";
import { t } from "@/i18n";
import { getRuleComponent } from "@/rules/registry";
import {
	type DiceAnimationRequest,
	type DiceSkin,
	parseDiceFaces,
} from "./model";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function diceAnimationFromMessage(
	message: SessionEvent,
	skin: DiceSkin = "olive",
): DiceAnimationRequest | null {
	if (
		message.replayed === true ||
		typeof message.eventId !== "number" ||
		!isRecord(message.payload) ||
		(message.type !== "dice:rolled" && message.type !== "check:resolved")
	) {
		return null;
	}
	const payload = message.payload;
	const eventId = String(message.eventId);

	if (message.type === "dice:rolled") {
		if (payload.hidden === true) return null;
		const result = isRecord(payload.result) ? payload.result : null;
		if (!result || typeof result.expression !== "string") return null;
		const faces = parseDiceFaces(result.expression);
		const total =
			typeof result.total === "number" && Number.isFinite(result.total)
				? result.total
				: null;
		if (faces === null || total === null) return null;
		const rolls = Array.isArray(result.rolls)
			? result.rolls.filter(
					(value): value is number =>
						typeof value === "number" && Number.isFinite(value),
				)
			: [];
		if (rolls.length === 0) return null;
		return {
			id: `dice-${eventId}`,
			eventId: message.eventId,
			kind: "roll",
			faces,
			total,
			rolls,
			label: t("dice.animationResult", { total }),
			skin,
		};
	}
	if (payload.hidden === true || !isRecord(payload.result)) return null;
	const result = payload.result;
	const rule = getRuleComponent(
		typeof result.ruleId === "string" ? result.ruleId : undefined,
	);
	const animation = rule.buildCheckDiceAnimation(result);
	return animation
		? { ...animation, id: `check-${eventId}`, eventId: message.eventId, skin }
		: null;
}
