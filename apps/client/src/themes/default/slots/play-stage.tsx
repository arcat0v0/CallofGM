import type { PlayStageCtx } from "@cogm/theme-sdk";
import { SceneBackdrop } from "@/features/session-stage/scene-backdrop";
import { t } from "@/i18n";

export function PlayStage({ viewport, view, nodes }: PlayStageCtx) {
	const alt = view.sceneName || t("play.currentScene");
	const src = view.sceneBgUrl ?? undefined;

	if (viewport === "portrait") {
		return (
			<div className="bg-background relative h-full w-full overflow-hidden">
				<SceneBackdrop src={src} alt={alt} />
				<div className="from-stage-scrim-strong pointer-events-none absolute inset-x-0 top-0 h-32 bg-linear-to-b to-transparent" />
				<div className="absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-2 px-3.5 pt-2">
					<div className="min-w-0">{nodes.sceneInfo}</div>
					<div className="flex shrink-0 items-center gap-2">{nodes.audio}</div>
				</div>
				{nodes.portrait}
				{nodes.dialogue ? (
					<div className="absolute inset-x-3 bottom-2">{nodes.dialogue}</div>
				) : null}
			</div>
		);
	}

	if (viewport === "landscape") {
		return (
			<div className="bg-background relative h-full min-w-0 flex-1 overflow-hidden">
				<SceneBackdrop src={src} alt={alt} />
				<div className="from-stage-scrim-strong pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b to-transparent" />
				<div className="absolute inset-0 right-[var(--play-chat-inset,0px)] transition-[right] duration-500 ease-expressive-default-spatial">
					<div className="absolute inset-x-0 top-0 z-40 flex h-12 items-center justify-between gap-2 px-3">
						<div className="min-w-0">{nodes.sceneInfo}</div>
						<div className="flex shrink-0 items-center gap-2">
							{nodes.audio}
						</div>
					</div>
					{nodes.portrait}
					{nodes.dialogue ? (
						<div className="absolute inset-x-0 bottom-3 flex justify-center px-4">
							<div className="w-full max-w-[min(720px,100%)]">
								{nodes.dialogue}
							</div>
						</div>
					) : null}
				</div>
			</div>
		);
	}

	return (
		<div className="bg-background relative h-full w-full overflow-hidden">
			<SceneBackdrop src={src} alt={alt} />
			<div className="from-stage-scrim-strong via-stage-scrim/50 pointer-events-none absolute inset-x-0 top-0 h-44 bg-linear-to-b to-transparent" />
			<div className="from-stage-scrim-strong pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-linear-to-t to-transparent" />
			<div className="absolute inset-0 right-[var(--play-chat-inset,0px)] transition-[right] duration-500 ease-expressive-default-spatial">
				<div className="absolute top-5 left-6 z-40 flex flex-col items-start gap-2.5">
					{nodes.sceneInfo ? (
						<div className="bg-md-surface-container-low/72 border border-md-outline-variant/40 shadow-card rounded-xl px-4 py-2.5 backdrop-blur-xl">
							{nodes.sceneInfo}
						</div>
					) : null}
					{nodes.audio}
				</div>
				{nodes.portrait}
				{nodes.dialogue ? (
					<div className="absolute inset-x-0 bottom-6 z-10 flex justify-center px-8">
						<div className="w-full max-w-[860px]">{nodes.dialogue}</div>
					</div>
				) : null}
			</div>
		</div>
	);
}
