import type { MyClaimResponse } from "@cogm/shared";

export type PlayEntryGate =
	| { state: "checking" }
	| { state: "no-seat"; ended: boolean }
	| { state: "ready" }
	| { state: "error" };

export function resolvePlayEntry(input: {
	claim: MyClaimResponse | null;
	failed: boolean;
}): PlayEntryGate {
	if (input.failed) {
		return { state: "error" };
	}
	if (!input.claim) {
		return { state: "checking" };
	}
	if (input.claim.isGm || input.claim.claim) {
		return { state: "ready" };
	}
	return { state: "no-seat", ended: input.claim.sessionStatus === "ended" };
}
