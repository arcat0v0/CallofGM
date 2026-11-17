export type CheckDiceModifier = {
	kind: "bonus" | "penalty";
	count: number;
	candidates: number[];
	picked: number;
};

function asCount(value: unknown): number {
	return typeof value === "number" && Number.isInteger(value) && value > 0
		? value
		: 0;
}

export function parseTensCandidates(value: unknown): number[] {
	if (!Array.isArray(value)) return [];
	return value.filter(
		(item): item is number =>
			typeof item === "number" &&
			Number.isInteger(item) &&
			item >= 0 &&
			item <= 9,
	);
}

export function checkDiceModifier(
	result: Record<string, unknown>,
): CheckDiceModifier | null {
	const roll =
		typeof result.originalRoll === "number" ? result.originalRoll : result.roll;
	if (typeof roll !== "number") return null;
	const tens = parseTensCandidates(result.tensCandidates);
	if (tens.length < 2) return null;
	const net = asCount(result.bonusDice) - asCount(result.penaltyDice);
	if (net === 0) return null;
	const units = roll % 10;
	const candidates = tens.map((digit) =>
		digit === 0 && units === 0 ? 100 : digit * 10 + units,
	);
	return {
		kind: net > 0 ? "bonus" : "penalty",
		count: Math.abs(net),
		candidates,
		picked: roll,
	};
}
