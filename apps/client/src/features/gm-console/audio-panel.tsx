import {
	ListMusic,
	Music2,
	Pause,
	Play,
	Repeat2,
	SkipBack,
	SkipForward,
	SlidersHorizontal,
	Volume1,
	Volume2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectItem } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { t } from "@/i18n";
import { formatDurationMmSs } from "@/lib/format";
import { usePlayStore } from "@/stores/play-store";
import { AudioLibrary } from "./audio-library";
import { trackSourceLabel, useBgmPlayback } from "./gm-audio";
import { GmPanelShell, GmSelectField } from "./gm-panel-fields";

const FADE_OPTIONS = [
	{ value: "500", labelKey: "gm.workbench.fadeFast" },
	{ value: "1000", labelKey: "gm.workbench.fadeNormal" },
	{ value: "2000", labelKey: "gm.workbench.fadeSlow" },
	{ value: "2500", labelKey: "gm.workbench.fadeSlowest" },
] as const;

function AudioPanel({ onClose }: { onClose: () => void }) {
	const {
		bgm,
		bgmTracks,
		connected,
		snapshotReady,
		current,
		durationMs,
		displayPosition,
		displayVolume,
		setSeekDraft,
		setVolumeDraft,
		commitVolume,
		sendBgm,
		playTrack,
		togglePlay,
		previous,
		next,
		seek,
		commandPending,
		commandError,
	} = useBgmPlayback();
	const playbackStatus = usePlayStore((state) => state.audioPlaybackStatus);
	const playbackError = usePlayStore((state) => state.audioPlaybackError);
	const retryPlayback = usePlayStore((state) => state.retryAudioPlayback);
	const [fadeMs, setFadeMs] = useState("1000");
	const [activeTab, setActiveTab] = useState("library");
	const lastAudibleVolume = useRef(displayVolume > 0 ? displayVolume : 80);
	const hasCurrent = Boolean(bgm?.trackId);
	const controlsDisabled = !connected || !snapshotReady || commandPending;
	const currentDisabled = controlsDisabled || !hasCurrent;

	useEffect(() => {
		if (displayVolume > 0) {
			lastAudibleVolume.current = displayVolume;
		}
	}, [displayVolume]);

	function toggleFade() {
		const volume = displayVolume > 0 ? 0 : lastAudibleVolume.current;
		sendBgm("volume", { volume, transitionMs: Number(fadeMs) });
	}

	return (
		<GmPanelShell
			title={t("gm.workbench.audioTitle")}
			subtitle={t("gm.workbench.audioSubtitle")}
			onClose={onClose}
			className="w-[min(880px,calc(100vw-24px))] max-h-[calc(100dvh-176px)] xl:max-h-[calc(100dvh-112px)] [&>div]:[scrollbar-width:thin] [&>div]:[scrollbar-color:var(--color-scrollbar)_transparent]"
		>
			{!connected ? (
				<p role="alert" className="text-danger text-body-medium">
					{t("gm.workbench.audioDisconnected")}
				</p>
			) : null}
			{commandError ? (
				<p role="alert" className="text-danger text-body-medium">
					{commandError}
				</p>
			) : null}
			{!snapshotReady ? (
				<p
					role="status"
					className="text-md-on-surface-variant text-body-medium"
				>
					{t("gm.workbench.snapshotLoading")}
				</p>
			) : null}

			<div className="grid min-w-0 items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-6">
				<div className="flex min-w-0 flex-col gap-4 md:sticky md:top-0">
					<section
						aria-label={t("gm.workbench.currentPlayback")}
						className="flex flex-col gap-3"
					>
						<h3 className="text-md-on-surface text-title-medium-emph">
							{t("gm.workbench.currentPlayback")}
						</h3>
						{hasCurrent ? (
							<div className="bg-md-surface-container flex flex-col gap-3 rounded-xl p-4">
								<div className="flex items-center gap-3">
									<Music2
										className="text-accent-hover size-5 shrink-0"
										aria-hidden="true"
									/>
									<div className="flex min-w-0 flex-1 flex-col gap-0.5">
										<span className="text-md-on-surface truncate text-title-large">
											{current?.name ?? bgm?.name ?? t("gm.console.audioNone")}
										</span>
										<span
											className="text-md-on-surface-variant text-label-medium"
											aria-live="polite"
										>
											{bgm?.playing
												? t("gm.workbench.currentSynchronized")
												: t("gm.workbench.currentPaused")}
										</span>
										<span className="text-md-on-surface-variant truncate text-label-small">
											{trackSourceLabel(
												current?.source ?? bgm?.source ?? "upload",
											)}
											{current?.artists.length
												? ` · ${current.artists.join(" / ")}`
												: ""}
										</span>
									</div>
								</div>
								<Slider
									wavy
									value={[displayPosition]}
									min={0}
									max={Math.max(durationMs, 1)}
									playing={Boolean(bgm?.playing)}
									disabled={currentDisabled || durationMs <= 0}
									aria-label={t("gm.console.progressAria")}
									aria-valuetext={t("gm.workbench.progressValue", {
										position: formatDurationMmSs(displayPosition),
										duration: formatDurationMmSs(durationMs),
									})}
									className="[&_[data-slot=slider-track]]:bg-md-outline-variant! [&_[data-slot=slider-thumb]]:h-9! [&_[data-slot=slider-thumb]]:w-1! min-h-9!"
									onValueChange={(value) => setSeekDraft(value[0] ?? 0)}
									onValueCommit={(value) => seek(value[0] ?? 0)}
								/>
								<div className="flex items-center justify-between">
									<span className="text-md-on-surface-variant font-mono text-label-medium tabular-nums">
										{formatDurationMmSs(displayPosition)}
									</span>
									<span className="text-md-on-surface-variant font-mono text-label-medium tabular-nums">
										{formatDurationMmSs(durationMs)}
									</span>
								</div>
								<div className="flex items-center justify-center gap-3">
									<Button
										type="button"
										variant="tertiary"
										size="icon-sm"
										className="bg-md-surface-container-highest size-12"
										aria-label={t("gm.workbench.previousTrackInList")}
										disabled={controlsDisabled || bgmTracks.length < 2}
										onClick={previous}
									>
										<SkipBack />
									</Button>
									<Button
										type="button"
										variant="primary"
										size="icon-md"
										aria-label={
											bgm?.playing
												? t("gm.console.audioPause")
												: t("gm.console.audioPlay")
										}
										disabled={currentDisabled}
										onClick={togglePlay}
									>
										{bgm?.playing ? <Pause /> : <Play />}
									</Button>
									<Button
										type="button"
										variant="tertiary"
										size="icon-sm"
										className="bg-md-surface-container-highest size-12"
										aria-label={t("gm.workbench.nextTrackInList")}
										disabled={controlsDisabled || bgmTracks.length < 2}
										onClick={next}
									>
										<SkipForward />
									</Button>
								</div>
							</div>
						) : (
							<div className="bg-md-surface-container-low flex items-center gap-3 rounded-xl p-4">
								<Music2
									className="text-md-on-surface-variant size-5 shrink-0"
									aria-hidden="true"
								/>
								<div className="flex min-w-0 flex-col gap-0.5">
									<p className="text-md-on-surface text-body-large">
										{t("gm.workbench.emptyPlaybackTitle")}
									</p>
									<p className="text-md-on-surface-variant text-body-medium">
										{t("gm.workbench.emptyPlaybackHint")}
									</p>
								</div>
							</div>
						)}
						{playbackStatus === "loading" ? (
							<p
								role="status"
								className="text-md-on-surface-variant text-body-medium"
							>
								{t("stage.audioLoading")}
							</p>
						) : null}
						{playbackError ? (
							<div
								role="alert"
								className="flex items-center justify-between gap-3 text-danger"
							>
								<span className="text-body-medium">{playbackError}</span>
								<Button
									type="button"
									variant="dangerSoft"
									size="xs"
									className="min-h-11"
									onClick={retryPlayback}
								>
									{t("stage.audioRetry")}
								</Button>
							</div>
						) : null}
					</section>

					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between gap-3">
							<span className="text-md-on-surface text-label-large">
								{t("gm.workbench.groupVolume")}
							</span>
							<span
								className="text-md-on-surface-variant font-mono text-label-medium tabular-nums"
								aria-live="polite"
							>
								{displayVolume}%
							</span>
						</div>
						<div className="flex items-center gap-3">
							<Volume1
								className="text-md-on-surface-variant size-5 shrink-0"
								aria-hidden="true"
							/>
							<Slider
								value={[displayVolume]}
								min={0}
								max={100}
								disabled={currentDisabled}
								aria-label={t("gm.workbench.groupVolume")}
								aria-valuetext={`${displayVolume}%`}
								className="[&_[data-slot=slider-track]]:bg-md-surface-container-highest! [&_[data-slot=slider-thumb]]:h-9! [&_[data-slot=slider-thumb]]:w-1!"
								onValueChange={(value) => setVolumeDraft(value[0] ?? 0)}
								onValueCommit={(value) => commitVolume(value[0] ?? 0)}
							/>
							<Volume2
								className="text-md-on-surface-variant size-5 shrink-0"
								aria-hidden="true"
							/>
						</div>
					</div>
				</div>
				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className="min-w-0 gap-4"
				>
					<TabsList
						className="h-12 w-full"
						aria-label={t("gm.workbench.audioWorkspace")}
					>
						<TabsTrigger value="library" className="h-10 px-3">
							<ListMusic aria-hidden="true" />
							{t("gm.workbench.trackLibrary")}
						</TabsTrigger>
						<TabsTrigger value="settings" className="h-10 px-3">
							<SlidersHorizontal aria-hidden="true" />
							{t("gm.workbench.playbackSettings")}
						</TabsTrigger>
					</TabsList>
					<TabsContent
						value="library"
						forceMount
						hidden={activeTab !== "library"}
						className="data-[state=inactive]:hidden"
					>
						<AudioLibrary
							currentTrackId={bgm?.trackId ?? null}
							controlsDisabled={controlsDisabled}
							playTrack={playTrack}
						/>
					</TabsContent>
					<TabsContent value="settings" className="flex flex-col gap-4">
						<div className="flex items-center justify-between gap-3 rounded-xl bg-md-surface-container p-4">
							<div className="flex min-w-0 items-start gap-3">
								<Repeat2
									className="mt-0.5 size-5 shrink-0 text-md-on-surface-variant"
									aria-hidden="true"
								/>
								<div className="flex flex-col gap-1">
									<span className="text-md-on-surface text-label-large">
										{t("gm.workbench.loopCurrent")}
									</span>
									<span className="text-md-on-surface-variant text-body-small">
										{bgm?.loop
											? t("gm.workbench.loopCurrentOn")
											: t("gm.workbench.loopCurrentOff")}
									</span>
								</div>
							</div>
							<Switch
								checked={Boolean(bgm?.loop)}
								aria-label={t("gm.workbench.loopCurrent")}
								disabled={currentDisabled}
								onCheckedChange={(checked) =>
									sendBgm("loop", { loop: checked })
								}
							/>
						</div>
						<div className="flex flex-col gap-3 rounded-xl bg-md-surface-container p-4">
							<h3 className="text-md-on-surface text-label-large">
								{t("gm.workbench.fade")}
							</h3>
							<p className="text-md-on-surface-variant text-body-small">
								{t("gm.workbench.fadeHint")}
							</p>
							<GmSelectField
								label={t("gm.workbench.fadeDuration")}
								value={fadeMs}
								onValueChange={setFadeMs}
								disabled={currentDisabled}
							>
								{FADE_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{t(option.labelKey)}
									</SelectItem>
								))}
							</GmSelectField>
							<Button
								type="button"
								variant="tonal"
								size="sm"
								disabled={currentDisabled}
								onClick={toggleFade}
							>
								{displayVolume > 0
									? t("gm.workbench.fadeOutToSilence")
									: t("gm.workbench.fadeInToVolume", {
											volume: lastAudibleVolume.current,
										})}
							</Button>
						</div>
					</TabsContent>
				</Tabs>
			</div>
		</GmPanelShell>
	);
}

export { AudioPanel };
