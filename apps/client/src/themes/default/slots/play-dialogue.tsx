import type { PlayDialogueCtx } from "@cogm/theme-sdk";
import { DialogueBox } from "@/features/session-stage/dialogue-box";

export function PlayDialogue({
	speaker,
	roleLabel,
	expressionLabel,
	text,
	size,
}: PlayDialogueCtx) {
	return (
		<DialogueBox
			speaker={speaker}
			roleLabel={roleLabel}
			expressionLabel={expressionLabel}
			text={text}
			size={size}
		/>
	);
}
