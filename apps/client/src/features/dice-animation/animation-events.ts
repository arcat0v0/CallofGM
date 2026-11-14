import type { SessionEvent } from "@cogm/shared";
import { t } from "@/i18n";
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
			kind: "roll",
			faces,
			total,
			rolls,
			label: t("dice.animationResult", { total }),
			skin,
		};
	}

	if (message.type === "check:resolved") {
		if (payload.hidden === true) return null;
		const result = isRecord(payload.result) ? payload.result : null;
		const roll =
			result && typeof result.roll === "number" && Number.isFinite(result.roll)
				? result.roll
				: null;
		if (roll === null) return null;
		const outcome =
			result && typeof result.outcome === "string"
				? result.outcome
				: String(result?.success ?? "unknown");
		return {
			id: `check-${eventId}`,
			kind: "check",
			roll,
			outcome,
			label: t("dice.animationResult", { total: roll }),
			skin,
		};
	}

	return null;
}
