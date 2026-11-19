import type { ChatCheckOutcome } from "@/features/chat/types";

export function stampOutcome(
	outcome: string,
	success: boolean | null,
): ChatCheckOutcome {
	if (outcome === "critical" || outcome === "fumble") {
		return outcome;
	}
	return success === false ? "failure" : "success";
}
