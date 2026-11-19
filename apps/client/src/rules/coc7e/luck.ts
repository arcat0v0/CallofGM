import { coc7e } from "@cogm/shared";
import { sendSessionCommand } from "@/lib/session-socket";
import { formatRecovery } from "./check-view";
import { parseCocState } from "./sheet-data";

export function luckSpendOptions(check: unknown, luckCurrent: number) {
	if (!check || typeof check !== "object") {
		return [];
	}
	const value = check as Record<string, unknown>;
	const difficulty = coc7e.CheckDifficulty.safeParse(value.difficulty);
	const outcome = coc7e.CheckOutcome.safeParse(value.outcome);
	if (
		typeof value.skillKey !== "string" ||
		typeof value.targetValue !== "number" ||
		typeof value.roll !== "number" ||
		!difficulty.success ||
		!outcome.success ||
		!Number.isFinite(luckCurrent)
	) {
		return [];
	}
	return coc7e
		.luckSpendOptionsFor(
			{
				skillKey: value.skillKey,
				targetValue: value.targetValue,
				difficulty: difficulty.data,
				roll: value.roll,
				outcome: outcome.data,
				luckSpent:
					typeof value.luckSpent === "number" ? value.luckSpent : undefined,
				pushed: value.pushed === true,
			},
			luckCurrent,
		)
		.map((option) => ({
			...option,
			label: coc7e.CheckOutcomeLabel[option.outcome],
		}));
}

export const luck = {
	readCurrent: (state: unknown) => parseCocState(state)?.luck ?? null,
	spendOptions: luckSpendOptions,
	recover: (characterId: string) =>
		Boolean(sendSessionCommand("luck:recover", { characterId })),
	formatRecovery,
};
