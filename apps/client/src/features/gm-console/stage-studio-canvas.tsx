import type { StageComposition } from "@cogm/shared";
import { RotateCcw } from "lucide-react";
import {
	type CSSProperties,
	type PointerEvent as ReactPointerEvent,
	type RefObject,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { Button } from "@/components/ui/button";
import { DialogueBox } from "@/features/session-stage/dialogue-box";
import {
	PortraitLayer,
	type StageResizeCorner,
} from "@/features/session-stage/portrait-layer";
import {
	clampStageScale,
	clampStageX,
	clampStageY,
	computeSnapGuides,
	type SnapGuide,
} from "@/features/session-stage/portrait-layout";
import { SceneAudioControl } from "@/features/session-stage/scene-audio-control";
import { latestStageDialogue } from "@/features/session-stage/stage-dialogue";
import { t } from "@/i18n";
import { mediaUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";
import type { LoadedTheme } from "@/themes/runtime/loader";
import { ThemeContext, useTheme } from "@/themes/runtime/theme-context";
import { ThemeSlot } from "@/themes/runtime/theme-slot";

export type StudioViewportMode =
	| "gm-console"
	| "desktop-chat"
	| "desktop-full"
	| "mobile-portrait";

interface DragSession {
	kind: "move" | "scale";
	characterId: string;
	corner?: StageResizeCorner;
	startClientX: number;
	startClientY: number;
	startX: number;
	startY: number;
	startScale: number;
	layerWidth: number;
	layerHeight: number;
}

export function StageStudioCanvas({
	composition,
	selectedId,
	onSelect,
	onChangeComposition,
	onCommitComposition,
	viewportMode,
	liveStageRef,
	previewOnly,
	previewTheme,
	previewThemeKey,
	previewScene,
	isCustomPreviewScene,
	onResetPreviewScene,
	expressionOverrides,
	showDialogue,
	showNameplate,
}: {
	composition: StageComposition;
	selectedId: string | null;
	onSelect: (characterId: string | null) => void;
	onChangeComposition: (next: StageComposition) => void;
	onCommitComposition: (next: StageComposition) => void;
	viewportMode: StudioViewportMode;
	liveStageRef?: RefObject<HTMLDivElement | null>;
	previewOnly: boolean;
	previewTheme: LoadedTheme | null;
	previewThemeKey: string;
	previewScene: { id: string; name: string; bgAssetId: string | null } | null;
	isCustomPreviewScene: boolean;
	onResetPreviewScene: () => void;
	expressionOverrides: Record<string, string>;
	showDialogue: boolean;
	showNameplate: boolean;
}) {
	const status = usePlayStore((state) => state.status);
	const phase = usePlayStore((state) => state.phase);
	const latestMessage = usePlayStore((state) =>
		latestStageDialogue(state.messages),
	);
	const stageRootRef = useRef<HTMLDivElement>(null);
	const gmFrameRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<DragSession | null>(null);
	const latestCompositionRef = useRef(composition);
	latestCompositionRef.current = composition;
	const [draggingId, setDraggingId] = useState<string | null>(null);
	const [guides, setGuides] = useState<SnapGuide[]>([]);
	const isGmConsole = viewportMode === "gm-console";
	const gmTheme = useTheme();
	const [gmFrame, setGmFrame] = useState<{
		width: number;
		height: number;
		scale: number;
	} | null>(null);

	useLayoutEffect(() => {
		const frame = gmFrameRef.current;
		const liveStage = liveStageRef?.current;
		if (!isGmConsole || !frame || !liveStage) return;

		const measure = () => {
			const width = liveStage.clientWidth;
			const height = liveStage.clientHeight;
			if (!width || !height) {
				setGmFrame(null);
				return;
			}
			const scale = Math.min(
				frame.clientWidth / width,
				frame.clientHeight / height,
			);
			if (scale > 0) setGmFrame({ width, height, scale });
		};

		measure();
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(measure);
		observer.observe(frame);
		observer.observe(liveStage);
		return () => observer.disconnect();
	}, [isGmConsole, liveStageRef]);

	const dialogue = showDialogue ? (
		latestMessage ? (
			<DialogueBox
				speaker={latestMessage.speakerName}
				roleLabel={latestMessage.speakerRoleLabel || undefined}
				expressionLabel={latestMessage.expressionLabel}
				text={latestMessage.body}
				size={viewportMode === "mobile-portrait" ? "sm" : "md"}
				className={isGmConsole ? "w-[min(760px,100%)]" : undefined}
			/>
		) : (
			<DialogueBox
				speaker={t("gm.stageStudio.sampleSpeaker")}
				text={t("gm.stageStudio.sampleDialogue")}
				size={viewportMode === "mobile-portrait" ? "sm" : "md"}
				className={isGmConsole ? "w-[min(760px,100%)]" : undefined}
			/>
		)
	) : null;

	function findPortraitLayerRect(): DOMRect | null {
		const layer = stageRootRef.current?.querySelector<HTMLElement>(
			"[data-stage-portrait-layer]",
		);
		return layer?.getBoundingClientRect() ?? null;
	}

	function startMove(
		characterId: string,
		event: ReactPointerEvent<HTMLElement>,
	) {
		if (previewOnly || event.button !== 0) return;
		const item = latestCompositionRef.current.items.find(
			(entry) => entry.characterId === characterId,
		);
		const rect = findPortraitLayerRect();
		if (!item || !rect || rect.width <= 0 || rect.height <= 0) return;
		event.preventDefault();
		event.stopPropagation();
		dragRef.current = {
			kind: "move",
			characterId,
			startClientX: event.clientX,
			startClientY: event.clientY,
			startX: item.x,
			startY: item.y,
			startScale: item.scale,
			layerWidth: rect.width,
			layerHeight: rect.height,
		};
		setDraggingId(characterId);
	}

	function startScale(
		characterId: string,
		corner: StageResizeCorner,
		event: ReactPointerEvent<HTMLElement>,
	) {
		if (previewOnly || event.button !== 0) return;
		const item = latestCompositionRef.current.items.find(
			(entry) => entry.characterId === characterId,
		);
		const rect = findPortraitLayerRect();
		if (!item || !rect || rect.width <= 0 || rect.height <= 0) return;
		event.preventDefault();
		event.stopPropagation();
		dragRef.current = {
			kind: "scale",
			characterId,
			corner,
			startClientX: event.clientX,
			startClientY: event.clientY,
			startX: item.x,
			startY: item.y,
			startScale: item.scale,
			layerWidth: rect.width,
			layerHeight: rect.height,
		};
		setDraggingId(characterId);
	}

	useEffect(() => {
		if (!draggingId) return;

		function onPointerMove(event: PointerEvent) {
			const drag = dragRef.current;
			if (!drag) return;
			const current = latestCompositionRef.current;

			if (drag.kind === "move") {
				const deltaXPct =
					((event.clientX - drag.startClientX) / drag.layerWidth) * 100;
				const deltaYPct =
					(-(event.clientY - drag.startClientY) / drag.layerHeight) * 100;
				const rawX = drag.startX + deltaXPct;
				const rawY = drag.startY + deltaYPct;

				if (event.altKey) {
					setGuides([]);
					const nextX = clampStageX(rawX);
					const nextY = clampStageY(rawY);
					const next: StageComposition = {
						...current,
						mode: "custom",
						items: current.items.map((item) =>
							item.characterId === drag.characterId
								? { ...item, x: nextX, y: nextY }
								: item,
						),
					};
					latestCompositionRef.current = next;
					onChangeComposition(next);
				} else {
					const snapped = computeSnapGuides(
						drag.characterId,
						rawX,
						rawY,
						current.items,
					);
					setGuides(snapped.guides);
					const next: StageComposition = {
						...current,
						mode: "custom",
						items: current.items.map((item) =>
							item.characterId === drag.characterId
								? { ...item, x: snapped.x, y: snapped.y }
								: item,
						),
					};
					latestCompositionRef.current = next;
					onChangeComposition(next);
				}
				return;
			}

			// Scale handle drag: vertical & horizontal drag outwards increases scale.
			const dx = event.clientX - drag.startClientX;
			const dy = event.clientY - drag.startClientY;
			const xSign = drag.corner === "ne" || drag.corner === "se" ? 1 : -1;
			const ySign = drag.corner === "nw" || drag.corner === "ne" ? -1 : 1;
			const signedDelta = (dx * xSign + dy * ySign) / (drag.layerHeight * 0.72);
			const nextScale = clampStageScale(drag.startScale + signedDelta);
			const next: StageComposition = {
				...current,
				mode: "custom",
				items: current.items.map((item) =>
					item.characterId === drag.characterId
						? { ...item, scale: nextScale }
						: item,
				),
			};
			latestCompositionRef.current = next;
			onChangeComposition(next);
		}

		function onPointerUp() {
			if (!dragRef.current) return;
			dragRef.current = null;
			setDraggingId(null);
			setGuides([]);
			onCommitComposition(latestCompositionRef.current);
		}

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerUp);
		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerUp);
		};
	}, [draggingId, onChangeComposition, onCommitComposition]);

	const isMobilePortrait = viewportMode === "mobile-portrait";
	const playViewport = isMobilePortrait ? "portrait" : "desktop";
	const chatInsetStyle: CSSProperties | undefined =
		viewportMode === "desktop-chat"
			? ({ "--play-chat-inset": "24%" } as CSSProperties)
			: ({ "--play-chat-inset": "0px" } as CSSProperties);

	const interactive = previewOnly
		? undefined
		: {
				selectedId,
				draggingId,
				onSelect: (id: string) => onSelect(id),
				onPointerDownMove: startMove,
				onPointerDownScale: startScale,
			};
	const deselectOnBackground = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (
			!previewOnly &&
			!(event.target as HTMLElement).closest("[data-stage-character]")
		) {
			onSelect(null);
		}
	};

	const portraitNode = (
		<PortraitLayer
			audience="player"
			compact={isMobilePortrait}
			showNameplate={showNameplate}
			overlayNameplate={isGmConsole}
			compositionOverride={composition}
			expressionOverrides={expressionOverrides}
			disableTransitions={Boolean(draggingId)}
			interactive={interactive}
			className={isMobilePortrait ? "top-[52px] bottom-2" : undefined}
		>
			{!previewOnly && guides.length > 0 ? (
				<SnapGuidesOverlay guides={guides} />
			) : null}
		</PortraitLayer>
	);
	const stageView = {
		sceneName: previewScene?.name ?? t("play.currentScene"),
		sceneBgUrl: mediaUrl(previewScene?.bgAssetId),
		status,
		phase,
		hasDialogue: showDialogue,
	};

	const stageSlot = (
		<ThemeSlot
			key={`${previewThemeKey}-${playViewport}`}
			name="play.stage"
			ctx={{
				viewport: playViewport,
				view: stageView,
				nodes: {
					sceneInfo: (
						<ThemeSlot name="play.scene-info" ctx={{ variant: playViewport }} />
					),
					portrait: portraitNode,
					dialogue,
					audio: <SceneAudioControl variant={playViewport} />,
				},
			}}
		/>
	);

	return (
		<div className="bg-md-surface-container-lowest relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden p-3 sm:p-5">
			{isCustomPreviewScene && previewScene ? (
				<div className="bg-md-tertiary-container/90 text-md-on-tertiary-container absolute top-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full px-3 py-1 text-label-small-emph shadow-card backdrop-blur-md">
					<span>
						{t("gm.stageStudio.previewSceneBadge", {
							name: previewScene.name,
						})}
					</span>
					<Button
						type="button"
						variant="ghost"
						size="xs"
						className="text-md-on-tertiary-container hover:bg-md-on-tertiary-container/10 h-6 px-2 text-label-small"
						onClick={onResetPreviewScene}
					>
						<RotateCcw className="size-3" />
						{t("gm.stageStudio.previewSceneReset")}
					</Button>
				</div>
			) : null}

			<ThemeContext.Provider
				value={
					isGmConsole
						? gmTheme
						: { theme: previewTheme, error: null, loading: false }
				}
			>
				{isGmConsole ? (
					<div ref={gmFrameRef} className="relative min-h-0 w-full flex-1">
						<div
							ref={stageRootRef}
							onPointerDown={deselectOnBackground}
							className={cn(
								"overflow-hidden rounded-2xl",
								gmFrame
									? "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
									: "relative size-full",
							)}
							style={
								gmFrame
									? {
											width: gmFrame.width,
											height: gmFrame.height,
											scale: gmFrame.scale,
										}
									: undefined
							}
						>
							<ThemeSlot
								name="gm-console.stage"
								ctx={{
									view: stageView,
									nodes: {
										sceneInfo: null,
										portrait: portraitNode,
										dialogue,
										audio: <SceneAudioControl variant="desktop" />,
									},
								}}
							/>
							{!previewOnly && composition.items.length === 0 ? (
								<EmptyCanvasHint />
							) : null}
						</div>
					</div>
				) : isMobilePortrait ? (
					<div className="bg-md-surface-container-low border-md-outline-variant/50 flex h-full max-h-[680px] aspect-[9/16] max-w-full flex-col gap-2 overflow-hidden rounded-2xl border p-2 shadow-modal">
						<div
							ref={stageRootRef}
							onPointerDown={deselectOnBackground}
							className="relative h-[44%] w-full shrink-0 overflow-hidden rounded-xl"
						>
							{stageSlot}
						</div>
						<div className="bg-md-surface-container/70 border-md-outline-variant/30 text-md-on-surface-variant flex min-h-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-dashed p-4 text-center text-label-medium">
							<span>{t("gm.stageStudio.chatSafeAreaLabel")}</span>
						</div>
					</div>
				) : (
					<div
						ref={stageRootRef}
						style={chatInsetStyle}
						onPointerDown={deselectOnBackground}
						className="border-md-outline-variant/40 relative aspect-[16/9] max-h-full w-full max-w-full overflow-hidden rounded-2xl border shadow-modal"
					>
						{stageSlot}

						{viewportMode === "desktop-chat" ? (
							<div
								aria-hidden
								className={cn(
									"pointer-events-none absolute top-3 right-3 bottom-3 z-30 flex w-[calc(24%-0.75rem)] flex-col items-center justify-center rounded-xl border p-3 text-center transition-opacity duration-200",
									previewOnly
										? "bg-stage-glass/65 border-stage-glass-border"
										: "bg-md-surface-container-low/75 border-md-outline-variant/50 border-dashed",
								)}
							>
								<span className="text-md-on-surface-variant text-label-medium">
									{t("gm.stageStudio.chatSafeAreaLabel")}
								</span>
							</div>
						) : null}

						{!previewOnly && composition.items.length === 0 ? (
							<EmptyCanvasHint />
						) : null}
					</div>
				)}
			</ThemeContext.Provider>

			{!previewOnly ? (
				<p className="text-md-on-surface-variant mt-2.5 text-center text-label-small">
					{t("gm.stageStudio.dragHint")}
				</p>
			) : null}
		</div>
	);
}

function EmptyCanvasHint() {
	return (
		<div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-6">
			<div className="bg-md-surface-container-low/85 border-md-outline-variant/40 text-md-on-surface-variant rounded-full border px-4 py-2 text-label-large backdrop-blur-md">
				{t("gm.stageStudio.emptyCanvasHint")}
			</div>
		</div>
	);
}

function SnapGuidesOverlay({ guides }: { guides: SnapGuide[] }) {
	return (
		<div className="pointer-events-none absolute inset-0 z-50">
			{guides.map((guide) =>
				guide.axis === "x" ? (
					<div
						key={`x-${guide.value}-${guide.kind}`}
						style={{ left: `${guide.value}%` }}
						className={cn(
							"absolute inset-y-0 w-px -translate-x-1/2",
							guide.kind === "center" ? "bg-md-primary" : "bg-md-secondary/85",
						)}
					/>
				) : (
					<div
						key={`y-${guide.value}-${guide.kind}`}
						style={{ bottom: `${guide.value}%` }}
						className={cn(
							"absolute inset-x-0 h-px",
							guide.kind === "baseline"
								? "bg-md-primary"
								: "bg-md-secondary/85",
						)}
					/>
				),
			)}
		</div>
	);
}
