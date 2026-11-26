import type { CatalogHandoutDto, SceneDto, TrackDto } from "@cogm/shared";
import { useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useDiceEventStore } from "@/features/dice-animation/dice-event-store";
import { GmHistoryOverlay } from "@/features/history/gm-history-overlay";
import { ConnectionBanner } from "@/features/play/connection-banner";
import { SessionTerminalOverlay } from "@/features/play/session-terminal-overlay";
import { DialogueBox } from "@/features/session-stage/dialogue-box";
import { PortraitLayer } from "@/features/session-stage/portrait-layer";
import { SceneAudioControl } from "@/features/session-stage/scene-audio-control";
import { SessionLoadingTransition } from "@/features/session-stage/session-loading-transition";
import { latestStageDialogue } from "@/features/session-stage/stage-dialogue";
import { t, useI18nVersion } from "@/i18n";
import { fetchAllPages, mediaUrl } from "@/lib/api";
import { usePlayAudio } from "@/lib/bgm";
import { useSessionConnection } from "@/lib/use-session-connection";
import { usePlayStore } from "@/stores/play-store";
import { GmThemeScope } from "@/themes/runtime/gm-theme-scope";
import { ThemeSlot } from "@/themes/runtime/theme-slot";
import { GmChatPanel } from "./gm-chat-panel";
import { GmPanel } from "./gm-panel";
import { GmToolProvider } from "./gm-tool-context";
import { GmToolDock } from "./gm-tool-dock";
import { GmTopBar } from "./gm-top-bar";

function GmConsoleView() {
	useI18nVersion();
	const { sessionId } = useParams({ from: "/gm/session/$sessionId" });
	const observeMessage = useDiceEventStore((state) => state.observe);
	const { retry, voice } = useSessionConnection(sessionId, {
		ensurePlayer: false,
		onLiveEvent: observeMessage,
	});
	usePlayAudio();
	const status = usePlayStore((state) => state.status);
	const phase = usePlayStore((state) => state.phase);
	const scene = usePlayStore((state) => state.scene);
	const latest = usePlayStore((state) => latestStageDialogue(state.messages));
	const moduleId = usePlayStore((state) => state.moduleId);
	const snapshotReady = usePlayStore((state) => state.snapshotReady);
	const storeSessionId = usePlayStore((state) => state.sessionId);
	const terminal = usePlayStore((state) => state.terminal);
	const setCatalog = usePlayStore((state) => state.setCatalog);
	const catalogRevision = usePlayStore((state) => state.catalogRevision);
	const setCatalogStatus = usePlayStore((state) => state.setCatalogStatus);
	const [historyOpen, setHistoryOpen] = useState(false);
	const liveStageRef = useRef<HTMLDivElement>(null);
	const ready = snapshotReady && storeSessionId === sessionId;

	useEffect(() => {
		if (!moduleId) {
			return;
		}
		let cancelled = false;
		setCatalogStatus("loading");
		void (async () => {
			try {
				const [scenes, tracks, handouts] = await Promise.all([
					fetchAllPages<SceneDto>(
						`/gm/modules/${encodeURIComponent(moduleId)}/scenes`,
					),
					fetchAllPages<TrackDto>(
						`/gm/modules/${encodeURIComponent(moduleId)}/tracks`,
					),
					fetchAllPages<CatalogHandoutDto>(
						`/gm/modules/${encodeURIComponent(moduleId)}/handouts`,
					),
				]);
				if (
					cancelled ||
					usePlayStore.getState().catalogRevision !== catalogRevision
				) {
					return;
				}
				setCatalog({ scenes, tracks, handouts });
			} catch {
				if (
					!cancelled &&
					usePlayStore.getState().catalogRevision === catalogRevision
				) {
					setCatalogStatus("error");
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [catalogRevision, moduleId, setCatalog, setCatalogStatus]);

	const dialogue = latest ? (
		<DialogueBox
			speaker={latest.speakerName}
			roleLabel={latest.speakerRoleLabel || undefined}
			expressionLabel={latest.expressionLabel}
			text={latest.body}
			size="md"
			className="w-[min(760px,100%)]"
		/>
	) : null;

	const sceneBgUrl = mediaUrl(scene?.bgAssetId);

	const stage = (
		<div ref={liveStageRef} className="relative size-full">
			<ThemeSlot
				name="gm-console.stage"
				ctx={{
					view: {
						sceneName: scene?.name ?? t("play.consoleFallback"),
						sceneBgUrl,
						status,
						phase,
						hasDialogue: Boolean(latest),
					},
					nodes: {
						sceneInfo: null,
						portrait: <PortraitLayer showNameplate={false} />,
						dialogue,
						audio: <SceneAudioControl variant="desktop" />,
					},
				}}
			/>
		</div>
	);

	const terminalOverlay = (
		<SessionTerminalOverlay sessionId={sessionId} onRetry={retry} />
	);

	return (
		<GmThemeScope>
			<GmToolProvider>
				<div className="bg-background relative h-dvh w-full overflow-hidden">
					<SessionLoadingTransition
						ready={ready}
						suppressed={Boolean(terminal)}
						variant="console"
						eyebrow={t("gm.workbench.role")}
						title={t("gm.workbench.loadingTitle")}
						description={t("gm.workbench.loadingDescription")}
						preloadImageUrl={sceneBgUrl}
						fallbackOverlay={terminalOverlay}
					>
						<ThemeSlot
							name="gm-console.layout"
							ctx={{
								nodes: {
									topbar: <GmTopBar liveStageRef={liveStageRef} />,
									controls: <GmPanel />,
									stage,
									chat: (
										<GmChatPanel onOpenHistory={() => setHistoryOpen(true)} />
									),
									dock: <GmToolDock voice={voice} />,
									overlays: terminalOverlay,
									connection: <ConnectionBanner />,
									endedBanner: null,
								},
								view: { sessionId, status },
							}}
						/>
						<GmHistoryOverlay
							open={historyOpen}
							onOpenChange={setHistoryOpen}
						/>
					</SessionLoadingTransition>
				</div>
			</GmToolProvider>
		</GmThemeScope>
	);
}

export { GmConsoleView };
