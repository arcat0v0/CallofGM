import type { GmConsoleStageCtx } from "@cogm/theme-sdk";
import { PlayStage } from "./play-stage";

export function GmConsoleStage({ view, nodes }: GmConsoleStageCtx) {
	return (
		<div className="relative h-full w-full [--play-chat-inset:0px] [--play-stage-left-inset:0px] lg:[--play-chat-inset:calc(clamp(248px,20vw,292px)+24px)] lg:[--play-stage-left-inset:calc(clamp(248px,20vw,292px)+24px)]">
			<PlayStage
				viewport="desktop"
				view={view}
				nodes={{
					sceneInfo: null,
					portrait: nodes.portrait,
					dialogue: nodes.dialogue,
					audio: null,
				}}
			/>
		</div>
	);
}
