import type { BgmPlaybackMode } from "@cogm/shared";
import {
	AudioWaveform,
	CircleAlert,
	Music2,
	Pause,
	Play,
	Repeat1,
	RotateCcw,
	Repeat2,
	Shuffle,
	SkipBack,
	SkipForward,
	Square,
	TrendingDown,
	TrendingUp,
	Volume1,
	VolumeX,
	WifiOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SegmentedControl } from "@/components/shared/segmented-control";
import {
	Alert,
	AlertAction,
	AlertContent,
	AlertDescription,
	AlertIcon,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SplitButton } from "@/components/ui/button-group";
import { Card } from "@/components/ui/card";
import {
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { t } from "@/i18n";
import { formatDurationMmSs } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";
import { AudioLibrary } from "./audio-library";
import {
	playbackModeLabel,
	trackSourceLabel,
	useBgmPlayback,
} from "./gm-audio";
import { GmPanelShell } from "./gm-panel-fields";

const FADE_OPTIONS = [
	{ value: "500", labelKey: "gm.workbench.fadeFast" },
	{ value: "1000", labelKey: "gm.workbench.fadeNormal" },
	{ value: "2000", labelKey: "gm.workbench.fadeSlow" },
	{ value: "2500", labelKey: "gm.workbench.fadeSlowest" },
] as const;

const PLAYBACK_MODES = [
	{ value: "list", icon: Repeat2 },
	{ value: "single", icon: Repeat1 },
	{ value: "shuffle", icon: Shuffle },
	{ value: "off", icon: Square },
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
	const lastAudibleVolume = useRef(displayVolume > 0 ? displayVolume : 80);
	const hasCurrent = Boolean(bgm?.trackId);
	const playing = Boolean(bgm?.playing);
	const mode = bgm?.mode ?? "single";
	const controlsDisabled = !connected || !snapshotReady || commandPending;
	const currentDisabled = controlsDisabled || !hasCurrent;
	const silent = displayVolume <= 0;
	const fadeLabel = t(
		FADE_OPTIONS.find((option) => option.value === fadeMs)?.labelKey ??
			"gm.workbench.fadeNormal",
	);

	useEffect(() => {
		if (displayVolume > 0) {
			lastAudibleVolume.current = displayVolume;
		}
	}, [displayVolume]);

	function toggleFade() {
		const volume = silent ? lastAudibleVolume.current : 0;
		sendBgm("volume", { volume, transitionMs: Number(fadeMs) });
	}

	const title = current?.name ?? bgm?.name ?? t("gm.console.audioNone");
	const meta = [
		trackSourceLabel(current?.source ?? bgm?.source ?? "upload"),
		current?.artists.length ? current.artists.join(" / ") : null,
	]
		.filter(Boolean)
		.join(" · ");
		const status = !connected
		? { tone: "bg-warning", text: t("gm.workbench.currentStale") }
		: playbackError
			? {
					tone: "bg-danger",
					text: t("gm.workbench.currentLocalFailed", {
						state: playing
							? t("gm.workbench.currentSynchronized")
							: t("gm.workbench.currentPaused"),
					}),
				}
			: playing
				? { tone: "bg-accent", text: t("gm.workbench.currentSynchronized") }
				: { tone: "bg-md-outline", text: t("gm.workbench.currentPaused") };

	return (
		<GmPanelShell
			title={t("gm.workbench.audioTitle")}
			subtitle={t("gm.workbench.audioSubtitle")}
			onClose={onClose}
			className="w-[min(880px,calc(100vw-24px))] max-h-[calc(100dvh-176px)] xl:max-h-[calc(100dvh-112px)] [&>div]:[scrollbar-width:thin] [&>div]:[scrollbar-color:var(--color-scrollbar)_transparent]"
		>
			<div className="@container flex min-w-0 flex-col gap-5 md:min-h-0 md:flex-1">
				{!connected ? (
					<Alert
						variant="warning"
						className="items-center shadow-none"
					>
						<AlertIcon>
							<WifiOff aria-hidden="true" />
						</AlertIcon>
						<AlertContent>
							<AlertDescription>
								{t("gm.workbench.audioDisconnected")}
							</AlertDescription>
						</AlertContent>
					</Alert>
				) : null}
				{commandError ? (
					<Alert
						variant="danger"
						className="items-center shadow-none"
					>
						<AlertIcon>
							<CircleAlert aria-hidden="true" />
						</AlertIcon>
						<AlertContent>
							<AlertDescription>{commandError}</AlertDescription>
						</AlertContent>
					</Alert>
				) : null}
				{!snapshotReady ? (
					<p
						role="status"
						className="text-md-on-surface-variant text-body-medium"
					>
						{t("gm.workbench.snapshotLoading")}
					</p>
				) : null}

				<Card
					role="region"
					aria-label={t("gm.workbench.currentPlayback")}
					className="shrink-0 gap-4 rounded-xl p-4 shadow-none @2xl:p-5"
				>
					<div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3">
						<div className="flex min-w-0 flex-1 basis-56 items-center gap-4">
							<div
								aria-hidden="true"
								className={cn(
									"grid size-14 shrink-0 place-items-center rounded-lg transition-colors",
									playing && connected
										? "bg-accent-soft text-accent-soft-foreground"
										: "bg-md-surface-container-highest text-md-on-surface-variant",
								)}
							>
								{playing ? (
									<AudioWaveform className="size-6 motion-safe:animate-pulse" />
								) : (
									<Music2 className="size-6" />
								)}
							</div>
							<div className="flex min-w-0 flex-1 flex-col gap-1">
								{hasCurrent ? (
									<>
										<p className="text-md-on-surface truncate text-title-large-emph">
											{title}
										</p>
										<p className="text-md-on-surface-variant flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-label-medium">
											<span className="flex items-center gap-2">
												<span
													aria-hidden="true"
													className={cn(
														"size-2 shrink-0 rounded-full",
														status.tone,
													)}
												/>
												<span aria-live="polite">{status.text}</span>
											</span>
											<span className="min-w-0 truncate">
												<span aria-hidden="true" className="mr-2">
													·
												</span>
												{meta}
											</span>
												{playbackError ? (
													<>
														<span role="alert" className="sr-only">
															{playbackError}
														</span>
														<Button
															type="button"
															variant="dangerSoft"
															size="xs"
															className="-my-1 h-6 px-2.5 text-label-medium"
															title={playbackError}
															onClick={retryPlayback}
														>
															<RotateCcw data-icon="inline-start" />
															{t("stage.audioRetry")}
														</Button>
													</>
												) : null}
										</p>
									</>
								) : (
									<>
										<p className="text-md-on-surface text-title-medium-emph">
											{t("gm.workbench.emptyPlaybackTitle")}
										</p>
										<p className="text-md-on-surface-variant text-pretty text-body-medium">
											{bgmTracks.length > 0
												? t("gm.workbench.emptyPlaybackHint")
												: t("gm.workbench.emptyPlaybackNoTracks")}
										</p>
									</>
								)}
							</div>
						</div>
						{hasCurrent ? (
							<div className="flex shrink-0 items-center gap-2 @max-md:w-full @max-md:justify-center">
								<Button
									type="button"
									variant="tertiary"
									size="icon-sm"
									aria-label={t("gm.workbench.previousTrackAction")}
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
										playing
											? t("gm.console.audioPause")
											: t("gm.console.audioPlay")
									}
									disabled={currentDisabled}
									onClick={togglePlay}
								>
									{playing ? <Pause /> : <Play />}
								</Button>
								<Button
									type="button"
									variant="tertiary"
									size="icon-sm"
									aria-label={t("gm.workbench.nextTrackAction")}
									disabled={controlsDisabled || bgmTracks.length < 2}
									onClick={next}
								>
									<SkipForward />
								</Button>
							</div>
						) : null}
					</div>

					{hasCurrent ? (
						<div className="flex min-w-0 items-center gap-3">
							<span className="text-md-on-surface-variant w-11 shrink-0 font-mono text-label-medium tabular-nums">
								{formatDurationMmSs(displayPosition)}
							</span>
							<Slider
								wavy
								value={[displayPosition]}
								min={0}
								max={Math.max(durationMs, 1)}
								playing={playing}
								disabled={currentDisabled || durationMs <= 0}
								aria-label={t("gm.console.progressAria")}
								aria-valuetext={t("gm.workbench.progressValue", {
									position: formatDurationMmSs(displayPosition),
									duration: formatDurationMmSs(durationMs),
								})}
								className="min-w-0 flex-1"
								onValueChange={(value) => setSeekDraft(value[0] ?? 0)}
								onValueCommit={(value) => seek(value[0] ?? 0)}
							/>
							<span className="text-md-on-surface-variant w-11 shrink-0 text-right font-mono text-label-medium tabular-nums">
								{formatDurationMmSs(durationMs)}
							</span>
						</div>
					) : null}

					{playbackStatus === "loading" ? (
						<p
							role="status"
							className="text-md-on-surface-variant text-body-medium"
						>
							{t("stage.audioLoading")}
						</p>
					) : null}

					<Separator className="bg-md-outline-variant/40" />
							<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
								<div className="flex min-w-56 flex-1 items-center gap-3">
									<span className="text-md-on-surface-variant flex shrink-0 items-center gap-1.5 text-label-large">
										{silent ? (
											<VolumeX className="size-5" aria-hidden="true" />
										) : (
											<Volume1 className="size-5" aria-hidden="true" />
										)}
										{t("gm.workbench.bgmVolumeShort")}
									</span>
									<Slider
										value={[displayVolume]}
										min={0}
										max={100}
										disabled={controlsDisabled}
										aria-label={t("gm.workbench.groupVolume")}
										aria-valuetext={`${displayVolume}%`}
										className="min-w-24 flex-1"
										onValueChange={(value) => setVolumeDraft(value[0] ?? 0)}
										onValueCommit={(value) => commitVolume(value[0] ?? 0)}
									/>
									<span
										className="text-md-on-surface-variant w-10 shrink-0 text-right font-mono text-label-medium tabular-nums"
										aria-hidden="true"
									>
										{displayVolume}%
									</span>
								</div>
								<SplitButton
									type="button"
									variant="accentSoft"
									size="xs"
									groupClassName="@max-md:flex @max-md:w-full"
									className="@max-md:flex-1"
									disabled={currentDisabled}
									onClick={toggleFade}
									title={t("gm.workbench.fadeHint")}
									aria-label={
										silent
											? t("gm.workbench.fadeInToVolume", {
													volume: lastAudibleVolume.current,
												})
											: t("gm.workbench.fadeOutToSilence")
									}
									menuLabel={t("gm.workbench.fadeDuration")}
									menu={
										<>
											<DropdownMenuLabel>
												{t("gm.workbench.fadeDuration")}
											</DropdownMenuLabel>
											<DropdownMenuRadioGroup
												value={fadeMs}
												onValueChange={setFadeMs}
											>
												{FADE_OPTIONS.map((option) => (
													<DropdownMenuRadioItem
														key={option.value}
														value={option.value}
													>
														{t(option.labelKey)}
													</DropdownMenuRadioItem>
												))}
											</DropdownMenuRadioGroup>
										</>
									}
								>
									{silent ? (
										<TrendingUp data-icon="inline-start" />
									) : (
										<TrendingDown data-icon="inline-start" />
									)}
									{silent
										? t("gm.workbench.fadeInShort")
										: t("gm.workbench.fadeOutShort")}
									<span className="font-normal tabular-nums">{fadeLabel}</span>
								</SplitButton>
							</div>

							<div className="flex min-w-0 flex-col gap-1.5">
								<SegmentedControl<BgmPlaybackMode>
									aria-label={t("gm.workbench.playbackModeTitle")}
									value={mode}
									className="w-full gap-1 bg-md-surface-container-highest"
									itemClassName="min-h-10 px-3 [&_svg]:size-4"
									onValueChange={(nextMode) => {
										if (nextMode !== mode) sendBgm("mode", { mode: nextMode });
									}}
									options={PLAYBACK_MODES.map(({ value, icon: Icon }) => ({
										value,
										disabled: controlsDisabled,
										label: (
											<>
												<Icon aria-hidden="true" />
											<span className="@max-md:sr-only">
												{playbackModeLabel(value)}
											</span>
											</>
										),
									}))}
								/>
								<p className="text-md-on-surface-variant px-1 text-body-small">
									{t(`gm.workbench.playbackModeHint.${mode}`)}
								</p>
							</div>
				</Card>

				<AudioLibrary
					currentTrackId={bgm?.trackId ?? null}
					playing={playing}
					controlsDisabled={controlsDisabled}
					playTrack={playTrack}
					togglePlay={togglePlay}
				/>
			</div>
		</GmPanelShell>
	);
}

export { AudioPanel };
