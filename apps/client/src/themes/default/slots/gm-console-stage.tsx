import type { GmConsoleStageCtx } from "@cogm/theme-sdk";
import type { CSSProperties } from "react";
import { PlayStage } from "./play-stage";

const SIDE_INSET = "calc(clamp(248px,20vw,292px) + 24px)";

export function GmConsoleStage({ view, nodes }: GmConsoleStageCtx) {
	return (
		<div
			className="relative h-full w-full"
			style={
				{
					"--play-chat-inset": SIDE_INSET,
					"--play-stage-left-inset": SIDE_INSET,
				} as CSSProperties
			}
		>
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
