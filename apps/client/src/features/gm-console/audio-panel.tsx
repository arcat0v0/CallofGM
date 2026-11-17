import type { TrackDto } from "@cogm/shared";
import {
	Check,
	CloudLightning,
	DoorOpen,
	ListMusic,
	LoaderCircle,
	Music2,
	Pause,
	Play,
	Repeat2,
	SkipBack,
	SkipForward,
	Volume1,
	Volume2,
	Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectItem } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { t } from "@/i18n";
import { formatDurationMmSs } from "@/lib/format";
import { sendSessionCommand } from "@/lib/session-socket";
import { usePlayStore } from "@/stores/play-store";
import { useBgmPlayback } from "./gm-audio";
import { GmField, GmPanelShell, GmSelectField } from "./gm-panel-fields";
import { MusicSourcePanel } from "./music-source-panel";

const FADE_OPTIONS = [
	{ value: "500", labelKey: "gm.workbench.fadeFast" },
	{ value: "1000", labelKey: "gm.workbench.fadeNormal" },
	{ value: "2000", labelKey: "gm.workbench.fadeSlow" },
	{ value: "2500", labelKey: "gm.workbench.fadeSlowest" },
] as const;

const SE_ICONS = [CloudLightning, DoorOpen, Zap];

function trackSourceLabel(source: TrackDto["source"]) {
	if (source === "netease") {
		return t("gm.workbench.trackSourceNetease");
	}
	if (source === "qq") {
		return t("gm.workbench.trackSourceQq");
	}
	return t("gm.workbench.trackSourceUpload");
}

function AudioPanel({ onClose }: { onClose: () => void }) {
	const {
		bgm,
		catalogTracks,
		bgmTracks,
		soundEffects,
		catalogStatus,
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
	const reloadCatalog = usePlayStore((state) => state.reloadCatalog);
	const moduleId = usePlayStore((state) => state.moduleId);
	const addCatalogTrack = usePlayStore((state) => state.addCatalogTrack);
	const playbackStatus = usePlayStore((state) => state.audioPlaybackStatus);
	const playbackError = usePlayStore((state) => state.audioPlaybackError);
	const retryPlayback = usePlayStore((state) => state.retryAudioPlayback);
	const [fadeMs, setFadeMs] = useState("1000");
	const lastAudibleVolume = useRef(displayVolume > 0 ? displayVolume : 80);
	const hasCurrent = Boolean(bgm?.trackId);
	const controlsDisabled = !connected || !snapshotReady || commandPending;
	const currentDisabled = controlsDisabled || !hasCurrent;
	const catalogLoading =
		catalogStatus === "idle" || catalogStatus === "loading";

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
			className="w-[min(584px,calc(100vw-48px))]"
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
									{trackSourceLabel(current?.source ?? bgm?.source ?? "upload")}
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

			<section
				aria-label={t("gm.workbench.trackLibrary")}
				className="flex flex-col gap-2"
			>
				<h3 className="text-md-on-surface text-title-medium-emph">
					{t("gm.workbench.trackLibrary")}
				</h3>
				{catalogStatus === "error" ? (
					<div
						role="alert"
						className="flex items-center justify-between gap-3 rounded-xl bg-md-error-container p-3 text-md-on-error-container"
					>
						<span className="text-body-medium">
							{t("gm.workbench.catalogLoadFailed")}
						</span>
						<Button
							type="button"
							variant="tertiary"
							size="xs"
							onClick={reloadCatalog}
						>
							{t("gm.workbench.retryCatalog")}
						</Button>
					</div>
				) : catalogLoading ? (
					<p
						role="status"
						className="text-md-on-surface-variant flex items-center gap-2 p-2 text-body-medium"
					>
						<LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
						{t("gm.workbench.catalogLoading")}
					</p>
				) : bgmTracks.length === 0 ? (
					<div className="text-md-on-surface-variant flex items-center gap-2 rounded-xl bg-md-surface-container-low p-3 text-body-medium">
						<ListMusic className="size-4 shrink-0" aria-hidden="true" />
						{t("gm.workbench.noBgmTracks")}
					</div>
				) : (
					<ul className="flex max-h-56 flex-col gap-1 overflow-y-auto overscroll-contain">
						{bgmTracks.map((track) => {
							const active = track.id === bgm?.trackId;
							return (
								<li key={track.id}>
									<Button
										type="button"
										variant={active ? "secondary" : "ghost"}
										size="sm"
										className="h-auto min-h-11 w-full justify-start px-3"
										aria-label={t(
											active
												? "gm.workbench.restartTrack"
												: "gm.workbench.playTrack",
											{ name: track.name },
										)}
										aria-current={active ? "true" : undefined}
										disabled={controlsDisabled}
										onClick={() => playTrack(track.id, active)}
									>
										{active ? (
											<Check data-icon="inline-start" />
										) : (
											<Play data-icon="inline-start" />
										)}
										<span className="flex min-w-0 flex-1 flex-col text-left">
											<span className="truncate">{track.name}</span>
											<span className="text-label-small opacity-70">
												{trackSourceLabel(track.source)}
												{track.artists.length
													? ` · ${track.artists.join(" / ")}`
													: ""}
											</span>
										</span>
										<span className="font-mono text-label-small tabular-nums">
											{formatDurationMmSs(track.duration)}
										</span>
									</Button>
								</li>
							);
						})}
					</ul>
				)}
				<MusicSourcePanel
					moduleId={moduleId}
					tracks={catalogTracks}
					onAdded={addCatalogTrack}
				/>
			</section>

			<section
				aria-label={t("gm.workbench.playbackSettings")}
				className="flex flex-col gap-3"
			>
				<h3 className="text-md-on-surface text-title-medium-emph">
					{t("gm.workbench.playbackSettings")}
				</h3>
				<div className="flex flex-col gap-3 sm:flex-row">
					<GmField
						label={t("gm.workbench.loopCurrent")}
						className="min-h-16 justify-center"
					>
						<span className="text-md-on-surface flex min-w-0 items-center gap-2 text-label-large">
							<Repeat2 className="size-4 shrink-0" aria-hidden="true" />
							<span className="truncate">
								{bgm?.loop
									? t("gm.workbench.loopCurrentOn")
									: t("gm.workbench.loopCurrentOff")}
							</span>
						</span>
						<Switch
							checked={Boolean(bgm?.loop)}
							aria-label={t("gm.workbench.loopCurrent")}
							disabled={currentDisabled}
							onCheckedChange={(checked) => sendBgm("loop", { loop: checked })}
						/>
					</GmField>
					<GmSelectField
						label={t("gm.workbench.fadeDuration")}
						value={fadeMs}
						onValueChange={setFadeMs}
						disabled={currentDisabled}
						className="min-h-16 flex-1 justify-center"
					>
						{FADE_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{t(option.labelKey)}
							</SelectItem>
						))}
					</GmSelectField>
				</div>
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
			</section>

			<section
				aria-label={t("gm.workbench.soundEffects")}
				className="flex flex-col gap-2"
			>
				<h3 className="text-md-on-surface text-title-medium-emph">
					{t("gm.workbench.soundEffects")}
				</h3>
				{!catalogLoading && catalogStatus !== "error" ? (
					soundEffects.length === 0 ? (
						<p className="text-md-on-surface-variant rounded-xl bg-md-surface-container-low p-3 text-body-medium">
							{t("gm.workbench.noSoundEffects")}
						</p>
					) : (
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
							{soundEffects.map((effect, index) => {
								const Icon = SE_ICONS[index % SE_ICONS.length] ?? Zap;
								return (
									<Button
										key={effect.id}
										type="button"
										variant="secondary"
										size="sm"
										className="h-11 justify-start"
										aria-label={t("gm.workbench.playSoundEffect", {
											name: effect.name,
										})}
										disabled={!connected || !snapshotReady}
										onClick={() =>
											sendSessionCommand("audio:se", { trackId: effect.id })
										}
									>
										<Icon data-icon="inline-start" />
										<span className="truncate">{effect.name}</span>
									</Button>
								);
							})}
						</div>
					)
				) : null}
			</section>
		</GmPanelShell>
	);
}

export { AudioPanel };
