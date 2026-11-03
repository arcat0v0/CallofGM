import type { GmConsoleStageCtx } from "@cogm/theme-sdk";
import { SceneBackdrop } from "@/features/session-stage/scene-backdrop";
import { t } from "@/i18n";

export function GmConsoleStage({ view, nodes }: GmConsoleStageCtx) {
	const alt = view.sceneName || t("play.currentScene");
	return (
		<div className="bg-md-surface-container-lowest relative h-full w-full overflow-hidden">
			<SceneBackdrop
				src={view.sceneBgUrl ?? undefined}
				alt={alt}
				className="bg-md-surface-container-lowest"
				imageClassName="object-top"
			/>
			<div className="pointer-events-none absolute inset-x-0 top-0 h-[42%] bg-linear-to-b from-md-surface-container-lowest/88 via-md-surface-container-lowest/20 to-transparent" />
			<div className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-linear-to-t from-md-surface-container-lowest/92 to-transparent" />
			<div className="absolute inset-0 z-10 px-[calc(clamp(248px,20vw,292px)+24px)] pt-[clamp(80px,9vh,104px)]">
				<div className="relative h-full w-full">{nodes.portrait}</div>
				{nodes.dialogue ? (
					<div className="absolute inset-x-0 bottom-6 z-20 flex justify-center px-[calc(clamp(248px,20vw,292px)+24px)]">
						{nodes.dialogue}
					</div>
				) : null}
			</div>
		</div>
	);
}
