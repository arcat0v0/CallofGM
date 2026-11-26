import type {
	SetExpressionCommand,
	StageComposition,
	StagePresetDto,
	StagePresetsResponse,
} from "@cogm/shared";
import {
	Eye,
	IdCard,
	Layers,
	MessageSquareText,
	MonitorPlay,
	Pencil,
	RotateCcw,
	Send,
	Trash2,
	X,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
	clampStageX,
	clampStageY,
	materializeComposition,
	removeCharacterFromComposition,
	reorderLayerInComposition,
	stageCompositionsEqual,
} from "@/features/session-stage/portrait-layout";
import { t } from "@/i18n";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { sendSessionCommand } from "@/lib/session-socket";
import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";
import { type LoadedTheme, loadTheme } from "@/themes/runtime/loader";
import {
	StageStudioCanvas,
	type StudioViewportMode,
} from "./stage-studio-canvas";
import { StageStudioSidebar } from "./stage-studio-sidebar";

function stageExpressionsFor(
	composition: StageComposition,
	draft: Record<string, string>,
): SetExpressionCommand[] {
	return composition.items.flatMap(({ characterId }) => {
		const expressionKey = draft[characterId];
		return expressionKey ? [{ characterId, expressionKey }] : [];
	});
}

export function StageStudio() {
	const sessionId = usePlayStore((state) => state.sessionId);
	const status = usePlayStore((state) => state.status);
	const scene = usePlayStore((state) => state.scene);
	const scenes = usePlayStore((state) => state.catalogScenes);
	const themeId = usePlayStore((state) => state.themeId);
	const characters = usePlayStore((state) => state.characters);
	const portraitLayout = usePlayStore((state) => state.portraitLayout);
	const portraitScale = usePlayStore((state) => state.portraitScale);
	const stageComposition = usePlayStore((state) => state.stageComposition);
	const stagePresets = usePlayStore((state) => state.stagePresets);
	const stageDraft = usePlayStore((state) => state.stageDraft);
	const stageExpressionDraft = usePlayStore(
		(state) => state.stageExpressionDraft,
	);
	const stageDraftBaseRevision = usePlayStore(
		(state) => state.stageDraftBaseRevision,
	);
	const stageLiveRevision = usePlayStore((state) => state.stageLiveRevision);
	const stageLiveSync = usePlayStore((state) => state.stageLiveSync);
	const setStageDraft = usePlayStore((state) => state.setStageDraft);
	const setStageExpressionDraft = usePlayStore(
		(state) => state.setStageExpressionDraft,
	);
	const clearStageDraft = usePlayStore((state) => state.clearStageDraft);
	const setStageLiveSync = usePlayStore((state) => state.setStageLiveSync);
	const setStagePresets = usePlayStore((state) => state.setStagePresets);

	const ended = status === "ended";
	const liveSyncId = useId();
	const [open, setOpen] = useState(false);
	const [previewOnly, setPreviewOnly] = useState(false);
	const [viewportMode, setViewportMode] =
		useState<StudioViewportMode>("desktop-chat");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [previewSceneId, setPreviewSceneId] = useState<string | null>(null);
	const [showDialogue, setShowDialogue] = useState(true);
	const [showNameplate, setShowNameplate] = useState(true);
	const [playerTheme, setPlayerTheme] = useState<LoadedTheme | null>(null);
	const [presetSaving, setPresetSaving] = useState(false);
	const [conflictDismissedRev, setConflictDismissedRev] = useState<number>(0);

	const previewThemeId =
		typeof window !== "undefined" &&
		new URLSearchParams(window.location.search).get("theme") === "default"
			? null
			: themeId;

	useEffect(() => {
		if (!open || !previewThemeId) {
			setPlayerTheme(null);
			return;
		}
		let cancelled = false;
		void loadTheme(previewThemeId)
			.then((loadedTheme) => {
				if (!cancelled) {
					setPlayerTheme(loadedTheme);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setPlayerTheme(null);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [open, previewThemeId]);

	const liveMaterialized = useMemo(
		() =>
			materializeComposition(
				characters,
				stageComposition,
				portraitLayout,
				portraitScale,
			),
		[characters, stageComposition, portraitLayout, portraitScale],
	);

	const activeComposition = stageDraft ?? liveMaterialized;
	const hasUnsavedDraft =
		!ended &&
		((stageDraft !== null &&
			!stageCompositionsEqual(stageDraft, liveMaterialized)) ||
			stageExpressionsFor(activeComposition, stageExpressionDraft).length > 0);
	const hasLiveConflict =
		hasUnsavedDraft &&
		stageLiveRevision > stageDraftBaseRevision &&
		conflictDismissedRev < stageLiveRevision;

	const effectivePreviewOnly = ended || previewOnly;

	const resolvedPreviewScene = useMemo(() => {
		if (previewSceneId) {
			const match = scenes.find((item) => item.id === previewSceneId);
			if (match) {
				return {
					id: match.id,
					name: match.name,
					bgAssetId: match.bgAssetId ?? null,
				};
			}
		}
		return scene;
	}, [previewSceneId, scenes, scene]);

	const publishComposition = useCallback(
		(next: StageComposition, draft = stageExpressionDraft) => {
			if (ended) return false;
			const expressions = stageExpressionsFor(next, draft);
			const sent = sendSessionCommand("stage:layout", {
				layout: portraitLayout,
				scale: portraitScale,
				composition: next,
				...(expressions.length > 0 ? { expressions } : {}),
			});
			if (!sent) {
				toast.error(t("chat.notConnected"));
				return false;
			}
			return true;
		},
		[ended, portraitLayout, portraitScale, stageExpressionDraft],
	);

	const handleChangeComposition = useCallback(
		(next: StageComposition) => {
			setStageDraft(
				stageCompositionsEqual(next, liveMaterialized) ? null : next,
			);
		},
		[liveMaterialized, setStageDraft],
	);

	const handleCommitComposition = useCallback(
		(next: StageComposition) => {
			if (stageLiveSync && !ended) {
				publishComposition(next);
			}
		},
		[stageLiveSync, ended, publishComposition],
	);

	function handleChangeExpression(characterId: string, key: string | null) {
		const next = { ...stageExpressionDraft };
		const live = characters.find(
			(character) => character.characterId === characterId,
		);
		if (key && (stageLiveSync || key !== live?.currentExpressionKey)) {
			next[characterId] = key;
		} else {
			delete next[characterId];
		}
		setStageExpressionDraft(next);
		if (stageLiveSync && next[characterId]) {
			publishComposition(activeComposition, next);
		}
	}

	// Keep selectedId valid if staged items change.
	useEffect(() => {
		if (!open) return;
		if (
			selectedId &&
			!activeComposition.items.some((item) => item.characterId === selectedId)
		) {
			setSelectedId(activeComposition.items[0]?.characterId ?? null);
		}
	}, [open, selectedId, activeComposition.items]);

	// Keyboard nudging inside edit mode.
	useEffect(() => {
		if (!open || effectivePreviewOnly || !selectedId) return;
		const currentSelectedId = selectedId;

		function onKeyDown(event: KeyboardEvent) {
			const target = event.target;
			if (target instanceof HTMLElement) {
				const tag = target.tagName.toLowerCase();
				if (
					tag === "input" ||
					tag === "textarea" ||
					tag === "select" ||
					target.isContentEditable ||
					target.getAttribute("role") === "slider"
				) {
					return;
				}
			}
			const item = activeComposition.items.find(
				(entry) => entry.characterId === currentSelectedId,
			);
			if (!item) return;

			const step = event.shiftKey ? 5 : 1;
			let next: StageComposition | null = null;
			if (event.key === "ArrowLeft") {
				next = {
					...activeComposition,
					mode: "custom",
					items: activeComposition.items.map((entry) =>
						entry.characterId === currentSelectedId
							? { ...entry, x: clampStageX(entry.x - step) }
							: entry,
					),
				};
			} else if (event.key === "ArrowRight") {
				next = {
					...activeComposition,
					mode: "custom",
					items: activeComposition.items.map((entry) =>
						entry.characterId === currentSelectedId
							? { ...entry, x: clampStageX(entry.x + step) }
							: entry,
					),
				};
			} else if (event.key === "ArrowUp") {
				next = {
					...activeComposition,
					mode: "custom",
					items: activeComposition.items.map((entry) =>
						entry.characterId === currentSelectedId
							? { ...entry, y: clampStageY(entry.y + step) }
							: entry,
					),
				};
			} else if (event.key === "ArrowDown") {
				next = {
					...activeComposition,
					mode: "custom",
					items: activeComposition.items.map((entry) =>
						entry.characterId === currentSelectedId
							? { ...entry, y: clampStageY(entry.y - step) }
							: entry,
					),
				};
			} else if (event.key === "Delete" || event.key === "Backspace") {
				next = removeCharacterFromComposition(
					activeComposition,
					currentSelectedId,
				);
			} else if (event.key.toLowerCase() === "f") {
				next = {
					...activeComposition,
					mode: "custom",
					items: activeComposition.items.map((entry) =>
						entry.characterId === currentSelectedId
							? { ...entry, flipX: !entry.flipX }
							: entry,
					),
				};
			} else if (event.key === "[") {
				next = reorderLayerInComposition(
					activeComposition,
					currentSelectedId,
					"backward",
				);
			} else if (event.key === "]") {
				next = reorderLayerInComposition(
					activeComposition,
					currentSelectedId,
					"forward",
				);
			}

			if (next) {
				event.preventDefault();
				handleChangeComposition(next);
				handleCommitComposition(next);
			}
		}

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		open,
		effectivePreviewOnly,
		selectedId,
		activeComposition,
		handleChangeComposition,
		handleCommitComposition,
	]);

	async function handleSavePreset(name: string): Promise<boolean> {
		if (!sessionId || presetSaving) return false;
		setPresetSaving(true);
		try {
			const res = await api<StagePresetsResponse>(
				`/gm/sessions/${encodeURIComponent(sessionId)}/stage-presets`,
				{
					method: "POST",
					body: JSON.stringify({ name, composition: activeComposition }),
				},
			);
			setStagePresets(res.presets);
			toast.success(t("gm.stageStudio.presetSaved", { name }));
			return true;
		} catch (error) {
			toast.error(errorText(error, "gm.stageStudio.presetSaveFailed"));
			return false;
		} finally {
			setPresetSaving(false);
		}
	}

	async function handleOverwritePreset(preset: StagePresetDto) {
		if (!sessionId || presetSaving) return;
		setPresetSaving(true);
		try {
			const res = await api<StagePresetsResponse>(
				`/gm/sessions/${encodeURIComponent(sessionId)}/stage-presets`,
				{
					method: "POST",
					body: JSON.stringify({
						id: preset.id,
						name: preset.name,
						composition: activeComposition,
					}),
				},
			);
			setStagePresets(res.presets);
			toast.success(t("gm.stageStudio.presetUpdated", { name: preset.name }));
		} catch (error) {
			toast.error(errorText(error, "gm.stageStudio.presetSaveFailed"));
		} finally {
			setPresetSaving(false);
		}
	}

	async function handleDeletePreset(preset: StagePresetDto) {
		if (!sessionId || presetSaving) return;
		setPresetSaving(true);
		try {
			const res = await api<StagePresetsResponse>(
				`/gm/sessions/${encodeURIComponent(sessionId)}/stage-presets/${encodeURIComponent(preset.id)}`,
				{ method: "DELETE" },
			);
			setStagePresets(res.presets);
			toast.success(t("gm.stageStudio.presetDeleted", { name: preset.name }));
		} catch (error) {
			toast.error(errorText(error, "gm.stageStudio.presetDeleteFailed"));
		} finally {
			setPresetSaving(false);
		}
	}

	function handleLoadPreset(preset: StagePresetDto) {
		const activeIds = new Set(characters.map((c) => c.characterId));
		const next: StageComposition = {
			...preset.composition,
			items: preset.composition.items.filter((item) =>
				activeIds.has(item.characterId),
			),
		};
		handleChangeComposition(next);
		handleCommitComposition(next);
		setSelectedId(next.items[0]?.characterId ?? null);
		toast.success(t("gm.stageStudio.presetLoaded", { name: preset.name }));
	}

	function handleToggleLiveSync(enabled: boolean) {
		setStageLiveSync(enabled);
		if (enabled && hasUnsavedDraft) {
			publishComposition(activeComposition);
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					type="button"
					variant="tertiary"
					size="sm"
					aria-label={t("gm.stageStudio.triggerAria")}
					title={
						hasUnsavedDraft
							? t("gm.stageStudio.triggerDraftHint")
							: t("gm.stageStudio.triggerAria")
					}
					className={cn(
						"bg-md-surface-container-low text-md-on-surface-variant border-md-outline-variant/50 relative size-9 rounded-full border px-0 sm:size-auto sm:h-9 sm:gap-2 sm:px-3.5 lg:h-10 lg:px-4",
						hasUnsavedDraft &&
							"border-md-primary/70 text-md-primary bg-md-primary-container/30",
					)}
				>
					<Layers className="size-4 lg:size-5" />
					<span className="hidden sm:inline">
						{t("gm.stageStudio.triggerShort")}
					</span>
					{hasUnsavedDraft ? (
						<span
							aria-hidden
							className="bg-md-primary ring-md-surface-container-lowest absolute top-0.5 right-0.5 size-2.5 rounded-full ring-2"
						/>
					) : null}
				</Button>
			</DialogTrigger>

			<DialogContent
				showCloseButton={false}
				className="bg-md-surface-container-low border-md-outline-variant/50 flex h-[min(92dvh,960px)] w-[min(97vw,1680px)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl p-0 max-sm:p-0!"
			>
				<DialogHeader className="sr-only">
					<DialogTitle>
						{ended ? t("gm.stageStudio.titleEnded") : t("gm.stageStudio.title")}
					</DialogTitle>
					<DialogDescription>
						{t("gm.stageStudio.description")}
					</DialogDescription>
				</DialogHeader>

				{/* Top Toolbar */}
				<div className="border-md-outline-variant/40 bg-md-surface-container-low flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
					<div className="flex items-center gap-2.5">
						<span className="text-md-on-surface flex items-center gap-2 text-title-medium-emph">
							<MonitorPlay className="text-md-primary size-5" />
							{ended
								? t("gm.stageStudio.titleEnded")
								: t("gm.stageStudio.title")}
						</span>
						{ended ? (
							<Badge variant="soft" tone="default" size="sm">
								{t("gm.stageStudio.statusEnded")}
							</Badge>
						) : stageLiveSync ? (
							<Badge variant="soft" tone="accent" size="sm">
								{t("gm.stageStudio.statusLiveSync")}
							</Badge>
						) : hasUnsavedDraft ? (
							<Badge variant="soft" tone="warning" size="sm">
								{t("gm.stageStudio.statusDraft")}
							</Badge>
						) : (
							<Badge variant="soft" tone="default" size="sm">
								{t("gm.stageStudio.statusSynced")}
							</Badge>
						)}
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<SegmentedControl
							value={viewportMode}
							options={[
								{
									value: "desktop-chat",
									label: t("gm.stageStudio.viewportDesktopChat"),
								},
								{
									value: "desktop-full",
									label: t("gm.stageStudio.viewportDesktopFull"),
								},
								{
									value: "mobile-portrait",
									label: t("gm.stageStudio.viewportPortrait"),
								},
							]}
							aria-label={t("gm.stageStudio.viewportAria")}
							onValueChange={setViewportMode}
							className="h-8 w-auto"
							itemClassName="h-full px-2.5 text-label-small"
						/>

						{scenes.length > 0 ? (
							<Select
								value={previewSceneId ?? "__live__"}
								onValueChange={(value) =>
									setPreviewSceneId(value === "__live__" ? null : value)
								}
							>
								<SelectTrigger
									aria-label={t("gm.stageStudio.previewSceneLabel")}
									className="h-8 w-40 text-label-small"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__live__">
										{t("gm.stageStudio.previewSceneLive")}
									</SelectItem>
									{scenes.map((item) => (
										<SelectItem key={item.id} value={item.id}>
											{item.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : null}

						<Button
							type="button"
							variant={showDialogue ? "secondary" : "tertiary"}
							size="xs"
							className="h-8 gap-1.5 px-2.5 text-label-small"
							onClick={() => setShowDialogue((value) => !value)}
						>
							<MessageSquareText className="size-3.5" />
							<span className="hidden md:inline">
								{t("gm.stageStudio.toggleDialogue")}
							</span>
						</Button>

						<Button
							type="button"
							variant={showNameplate ? "secondary" : "tertiary"}
							size="xs"
							className="h-8 gap-1.5 px-2.5 text-label-small"
							onClick={() => setShowNameplate((value) => !value)}
						>
							<IdCard className="size-3.5" />
							<span className="hidden md:inline">
								{t("gm.stageStudio.toggleNameplate")}
							</span>
						</Button>

						{!ended ? (
							<Button
								type="button"
								variant={previewOnly ? "primary" : "tertiary"}
								size="xs"
								className="h-8 gap-1.5 px-3 text-label-small"
								onClick={() => setPreviewOnly((value) => !value)}
							>
								{previewOnly ? (
									<>
										<Pencil className="size-3.5" />
										{t("gm.stageStudio.backToEdit")}
									</>
								) : (
									<>
										<Eye className="size-3.5" />
										{t("gm.stageStudio.purePreview")}
									</>
								)}
							</Button>
						) : null}

						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label={t("common.close")}
							onClick={() => setOpen(false)}
						>
							<X className="size-4" />
						</Button>
					</div>
				</div>

				{/* External live update notice */}
				{hasLiveConflict ? (
					<div className="bg-md-warning-container/45 border-md-outline-variant/40 text-md-on-warning-container flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-label-medium">
						<span>{t("gm.stageStudio.conflictBanner")}</span>
						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="tertiary"
								size="xs"
								className="h-7 px-2.5"
								onClick={() => {
									clearStageDraft();
									setConflictDismissedRev(stageLiveRevision);
								}}
							>
								{t("gm.stageStudio.conflictReload")}
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="xs"
								className="h-7 px-2.5"
								onClick={() => setConflictDismissedRev(stageLiveRevision)}
							>
								{t("gm.stageStudio.conflictKeep")}
							</Button>
						</div>
					</div>
				) : null}

				{/* Main Workspace: Interactive Canvas + Sidebar */}
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
					<StageStudioCanvas
						composition={activeComposition}
						selectedId={selectedId}
						onSelect={setSelectedId}
						onChangeComposition={handleChangeComposition}
						onCommitComposition={handleCommitComposition}
						viewportMode={viewportMode}
						previewOnly={effectivePreviewOnly}
						previewTheme={playerTheme}
						previewThemeKey={previewThemeId ?? "default"}
						previewScene={resolvedPreviewScene}
						isCustomPreviewScene={Boolean(
							previewSceneId && previewSceneId !== scene?.id,
						)}
						onResetPreviewScene={() => setPreviewSceneId(null)}
						expressionOverrides={stageExpressionDraft}
						showDialogue={showDialogue}
						showNameplate={showNameplate}
					/>

					{!effectivePreviewOnly ? (
						<StageStudioSidebar
							characters={characters}
							composition={activeComposition}
							selectedId={selectedId}
							onSelect={setSelectedId}
							onChangeComposition={handleChangeComposition}
							onCommitComposition={handleCommitComposition}
							expressionOverrides={stageExpressionDraft}
							onSetExpressionOverride={handleChangeExpression}
							presets={stagePresets}
							presetSaving={presetSaving}
							onSavePreset={handleSavePreset}
							onOverwritePreset={handleOverwritePreset}
							onDeletePreset={handleDeletePreset}
							onLoadPreset={handleLoadPreset}
						/>
					) : null}
				</div>

				{/* Bottom Publish Bar */}
				{!ended ? (
					<div className="border-md-outline-variant/40 bg-md-surface-container-low flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5">
						<div className="flex flex-wrap items-center gap-4">
							<label
								htmlFor={liveSyncId}
								className="flex cursor-pointer items-center gap-2"
							>
								<Switch
									id={liveSyncId}
									size="sm"
									checked={stageLiveSync}
									aria-label={t("gm.stageStudio.liveSync")}
									onCheckedChange={handleToggleLiveSync}
								/>
								<span className="text-md-on-surface text-label-large">
									{t("gm.stageStudio.liveSync")}
								</span>
								<span className="text-md-on-surface-variant hidden text-label-small sm:inline">
									{t("gm.stageStudio.liveSyncHint")}
								</span>
							</label>
						</div>

						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={activeComposition.items.length === 0}
								className="text-danger h-9 gap-1.5"
								onClick={() => {
									const next: StageComposition = {
										mode: "custom",
										emphasizeSpeaker: activeComposition.emphasizeSpeaker,
										items: [],
									};
									handleChangeComposition(next);
									handleCommitComposition(next);
									setSelectedId(null);
								}}
							>
								<Trash2 className="size-4" />
								{t("gm.stageStudio.clearStage")}
							</Button>

							<Button
								type="button"
								variant="tertiary"
								size="sm"
								disabled={!hasUnsavedDraft}
								className="h-9 gap-1.5"
								onClick={() => clearStageDraft()}
							>
								<RotateCcw className="size-4" />
								{t("gm.stageStudio.discardDraft")}
							</Button>

							<Button
								type="button"
								variant="primary"
								size="sm"
								disabled={!hasUnsavedDraft}
								className="h-9 gap-2 px-5"
								onClick={() => {
									publishComposition(activeComposition);
								}}
							>
								<Send className="size-4" />
								{t("gm.stageStudio.publish")}
							</Button>
						</div>
					</div>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
