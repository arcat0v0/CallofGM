import type { ChatMessage } from "@/features/chat/types";

export function latestStageDialogue(messages: readonly ChatMessage[]) {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (
			message &&
			message.tone !== "ooc" &&
			!message.pending &&
			!message.rejected
		) {
			return message;
		}
	}
	return undefined;
}
