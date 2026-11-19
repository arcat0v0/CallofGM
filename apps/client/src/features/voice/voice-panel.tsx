import type { VoiceMember } from "@cogm/shared";
import {
	AudioLines,
	ChevronDown,
	Headphones,
	Mic,
	MicOff,
	PhoneOff,
	RefreshCw,
	Volume2,
	VolumeX,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Alert, AlertContent, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { t, translateOr } from "@/i18n";
import { cn } from "@/lib/utils";
import {
	isVoiceMemberSpeaking,
	type VoiceAudioSettings,
	type VoiceController,
	type VoiceSnapshot,
} from "./voice-controller";

export function voiceStatusKey(snapshot: VoiceSnapshot): string {
	const { link, pending, member, state } = snapshot;
	const roomFull = !!state && state.memberCount >= state.limit;
	if (link !== "ready") return `voice.link.${link}`;
	if (pending === "voice:join") return "voice.joining";
	if (pending === "voice:leave") return "voice.leaving";
	if (member) return "voice.joined";
	if (!state?.available) return "voice.unavailable";
	if (!state.enabled) return "voice.closed";
	if (roomFull) return "voice.full";
	return "voice.open";
}

export function VoiceStatusDot({
	speaking,
	canSpeak,
	className,
}: {
	speaking: boolean;
	canSpeak: boolean;
	className?: string;
}) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"shrink-0 rounded-full transition-colors",
				speaking
					? "bg-md-primary animate-pulse"
					: canSpeak
						? "bg-md-outline-variant"
						: "bg-md-error/60",
				className,
			)}
		/>
	);
}

export function SpeakerVolumeControl({
	member,
	volume,
	voice,
	compact = false,
}: {
	member: Pick<VoiceMember, "id" | "name">;
	volume: number;
	voice: VoiceController;
	compact?: boolean;
}) {
	const VolumeIcon = volume === 0 ? VolumeX : Volume2;
	return (
		<div className={cn("flex items-center", compact ? "gap-2" : "gap-2.5")}>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				className={cn(
					"text-md-on-surface-variant shrink-0",
					compact ? "size-7" : "size-8",
				)}
				aria-label={t(
					volume === 0 ? "voice.unmuteSpeakerFor" : "voice.muteSpeakerFor",
					{ name: member.name },
				)}
				onClick={() => voice.toggleMemberMute(member.id)}
			>
				<VolumeIcon className="size-4" aria-hidden="true" />
			</Button>
			<Slider
				value={[volume]}
				min={0}
				max={100}
				step={1}
				aria-label={t("voice.speakerVolumeFor", { name: member.name })}
				aria-valuetext={`${volume}%`}
				className={cn(
					"flex-1 [&_[data-slot=slider-track]]:bg-md-surface-container-highest! [&_[data-slot=slider-thumb]]:w-1!",
					compact
						? "min-h-7! [&_[data-slot=slider-thumb]]:h-5!"
						: "min-h-8! [&_[data-slot=slider-thumb]]:h-6!",
				)}
				onValueChange={(next) =>
					voice.setMemberVolume(member.id, next[0] ?? volume)
				}
			/>
			<span
				className={cn(
					"text-md-on-surface-variant shrink-0 text-right font-mono tabular-nums",
					compact ? "w-9 text-label-small" : "w-10 text-label-medium",
				)}
			>
				{volume}%
			</span>
		</div>
	);
}

function VoiceMemberCard({
	item,
	isSelf,
	joined,
	speaking,
	volume,
	manage,
	busy,
	voice,
}: {
	item: VoiceMember;
	isSelf: boolean;
	joined: boolean;
	speaking: boolean;
	volume: number;
	manage: boolean;
	busy: boolean;
	voice: VoiceController;
}) {
	const showVolume = joined && !isSelf;

	return (
		<li
			className={cn(
				"flex flex-col gap-2.5 rounded-xl p-3 transition-[background-color,box-shadow] duration-150 ease-standard-fast-effects",
				speaking
					? "bg-md-primary-container/35 ring-1 ring-md-primary/60"
					: "bg-md-surface-container",
			)}
		>
			<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
				<div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
					<VoiceStatusDot
						speaking={speaking}
						canSpeak={item.canSpeak}
						className="size-2.5"
					/>
					<span
						className="text-md-on-surface min-w-0 truncate text-title-small-emph"
						title={item.name}
					>
						{item.name}
					</span>
					<Badge variant="soft" size="sm">
						{t(`voice.role.${item.role}`)}
					</Badge>
					{isSelf ? (
						<Badge variant="soft" tone="accent" size="sm">
							{t("voice.self")}
						</Badge>
					) : null}
					{speaking ? (
						<Badge variant="soft" tone="accent" size="sm">
							{t("voice.speaking")}
						</Badge>
					) : null}
					{!item.canSpeak ? (
						<Badge variant="tertiary" size="sm">
							{t(item.muted ? "voice.moderatorMuted" : "voice.listenOnly")}
						</Badge>
					) : null}
				</div>
				{manage && item.role !== "gm" ? (
					<div className="flex flex-wrap gap-1.5">
						{item.role === "ob" ? (
							<Button
								type="button"
								variant={item.speakGranted ? "tonal" : "tertiary"}
								size="xs"
								className={cn(
									"min-h-9",
									!item.speakGranted && "bg-md-surface-container-highest",
								)}
								disabled={busy}
								aria-label={t(
									item.speakGranted ? "voice.revokeFor" : "voice.grantFor",
									{ name: item.name },
								)}
								onClick={() =>
									voice.moderate({
										memberId: item.id,
										speakGranted: !item.speakGranted,
									})
								}
							>
								{t(item.speakGranted ? "voice.revoke" : "voice.grant")}
							</Button>
						) : null}
						<Button
							type="button"
							variant={item.muted ? "dangerSoft" : "tertiary"}
							size="xs"
							className={cn(
								"min-h-9",
								!item.muted && "bg-md-surface-container-highest",
							)}
							disabled={busy}
							aria-label={t(item.muted ? "voice.unmuteFor" : "voice.muteFor", {
								name: item.name,
							})}
							onClick={() =>
								voice.moderate({ memberId: item.id, muted: !item.muted })
							}
						>
							{t(item.muted ? "voice.unmute" : "voice.mute")}
						</Button>
					</div>
				) : null}
			</div>
			{showVolume ? (
				<SpeakerVolumeControl member={item} volume={volume} voice={voice} />
			) : null}
		</li>
	);
}

function VoiceMicTestCard({
	voice,
	snapshot,
}: {
	voice: VoiceController;
	snapshot: VoiceSnapshot;
}) {
	const { mic, micTest, micTestLevel, micTestDetected, micTestLoopback } =
		snapshot;
	const busyWithLiveMic = mic === "on" || mic === "requesting";

	return (
		<section
			aria-label={t("voice.micTestTitle")}
			className="bg-md-surface-container-low flex flex-col gap-3 rounded-xl p-4"
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h3 className="text-md-on-surface text-title-small-emph">
					{t("voice.micTestTitle")}
				</h3>
				{micTest === "active" ? (
					<Badge
						variant="soft"
						tone={micTestDetected ? "accent" : "default"}
						size="sm"
					>
						{t(
							micTestDetected
								? "voice.micTestDetected"
								: "voice.micTestListening",
						)}
					</Badge>
				) : null}
			</div>

			{micTest === "denied" || micTest === "unavailable" ? (
				<Alert variant="warning">
					<AlertContent>
						<AlertDescription>{t(`voice.mic.${micTest}`)}</AlertDescription>
					</AlertContent>
				</Alert>
			) : null}

			{micTest === "active" ? (
				<>
					<div className="flex items-center gap-3">
						<div
							role="progressbar"
							aria-label={t("voice.micTestLevel")}
							aria-valuemin={0}
							aria-valuemax={100}
							aria-valuenow={micTestLevel}
							className="bg-md-surface-container-highest h-3 min-w-0 flex-1 overflow-hidden rounded-full"
						>
							<div
								className={cn(
									"h-full rounded-full transition-[width,background-color] duration-75",
									micTestDetected ? "bg-md-primary" : "bg-md-secondary",
								)}
								style={{ width: `${micTestLevel}%` }}
							/>
						</div>
						<span className="text-md-on-surface-variant w-10 shrink-0 text-right font-mono text-label-small tabular-nums">
							{micTestLevel}%
						</span>
					</div>
					<div className="grid grid-cols-2 gap-2">
						<Button
							type="button"
							variant={micTestLoopback ? "primary" : "tertiary"}
							size="sm"
							className={cn(
								"min-h-10 w-full",
								!micTestLoopback && "bg-md-surface-container-highest",
							)}
							onClick={() => voice.toggleMicTestLoopback()}
						>
							{micTestLoopback ? (
								<Volume2 data-icon="inline-start" />
							) : (
								<VolumeX data-icon="inline-start" />
							)}
							{t(
								micTestLoopback
									? "voice.micTestLoopbackOn"
									: "voice.micTestLoopbackOff",
							)}
						</Button>
						<Button
							type="button"
							variant="tertiary"
							size="sm"
							className="bg-md-surface-container-highest min-h-10 w-full"
							onClick={() => voice.stopMicTest()}
						>
							{t("voice.micTestStop")}
						</Button>
					</div>
					<p className="text-md-on-surface-variant text-body-small">
						{t("voice.micTestLoopbackHint")}
					</p>
				</>
			) : (
				<>
					<p className="text-md-on-surface-variant text-body-small">
						{t(
							busyWithLiveMic
								? "voice.micTestBusyHint"
								: "voice.micTestDescription",
						)}
					</p>
					{micTest === "requesting" ? (
						<Button
							type="button"
							variant="tertiary"
							size="sm"
							className="bg-md-surface-container-highest min-h-10 w-full"
							onClick={() => voice.stopMicTest()}
						>
							{t("voice.micTestCancel")}
						</Button>
					) : (
						<Button
							type="button"
							variant="tertiary"
							size="sm"
							className="bg-md-surface-container-highest min-h-10 w-full"
							disabled={busyWithLiveMic}
							onClick={() => {
								void voice.startMicTest();
							}}
						>
							<Mic data-icon="inline-start" />
							{t("voice.micTestStart")}
						</Button>
					)}
				</>
			)}
		</section>
	);
}

type AudioProcessingSetting = Exclude<
	keyof VoiceAudioSettings,
	"deviceId" | "pushToTalk" | "pushToTalkKey"
>;

function VoiceProcessingSwitch({
	voice,
	settings,
	setting,
	label,
	applied,
}: {
	voice: VoiceController;
	settings: VoiceAudioSettings;
	setting: AudioProcessingSetting;
	label: string;
	applied?: boolean | null;
}) {
	const id = useId();
	const descriptionId = useId();
	const appliedKey =
		applied === null
			? "voice.audio.appliedAutomatic"
			: applied
				? "voice.audio.appliedOn"
				: "voice.audio.appliedOff";

	return (
		<div className="bg-md-surface-container flex min-w-0 items-center justify-between gap-3 rounded-lg px-3 py-2.5">
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<label
					htmlFor={id}
					className="text-md-on-surface cursor-pointer text-label-large"
				>
					{label}
				</label>
				{applied !== undefined ? (
					<span
						id={descriptionId}
						className="text-md-on-surface-variant text-body-small"
					>
						{t("voice.audio.appliedValue", { state: t(appliedKey) })}
					</span>
				) : null}
			</div>
			<Switch
				id={id}
				size="sm"
				checked={settings[setting]}
				aria-label={label}
				aria-describedby={applied !== undefined ? descriptionId : undefined}
				onCheckedChange={(checked) => {
					void voice.updateAudioSettings({ [setting]: checked });
				}}
			/>
		</div>
	);
}

function PushToTalkButton({
	voice,
	snapshot,
}: {
	voice: VoiceController;
	snapshot: VoiceSnapshot;
}) {
	const held = useRef(false);
	const release = () => {
		if (!held.current) return;
		held.current = false;
		voice.setPushToTalkActive(false);
	};
	const press = () => {
		if (held.current || !snapshot.member?.canSpeak) return;
		held.current = true;
		voice.setPushToTalkActive(true);
	};

	useEffect(() => {
		return () => {
			if (held.current) voice.setPushToTalkActive(false);
		};
	}, [voice]);

	return (
		<Button
			type="button"
			variant={snapshot.pushToTalkActive ? "primary" : "tonal"}
			size="sm"
			className="min-h-11 w-full touch-none select-none"
			disabled={!snapshot.member?.canSpeak}
			aria-label={t("voice.audio.pushToTalkHold")}
			aria-pressed={snapshot.pushToTalkActive}
			onPointerDown={(event) => {
				if (event.button !== 0) return;
				event.preventDefault();
				press();
			}}
			onPointerUp={release}
			onPointerCancel={release}
			onPointerLeave={release}
			onLostPointerCapture={release}
			onBlur={release}
			onKeyDown={(event) => {
				if (event.key !== " " && event.key !== "Enter") return;
				event.preventDefault();
				press();
			}}
			onKeyUp={(event) => {
				if (event.key !== " " && event.key !== "Enter") return;
				event.preventDefault();
				release();
			}}
		>
			<Mic data-icon="inline-start" />
			{t("voice.audio.pushToTalkHold")}
		</Button>
	);
}

function VoiceAudioSettingsSection({
	voice,
	snapshot,
}: {
	voice: VoiceController;
	snapshot: VoiceSnapshot;
}) {
	const [refreshing, setRefreshing] = useState(false);
	const deviceId = useId();
	const keyId = useId();
	const { audioSettings, audioDevices, audioProcessing } = snapshot;
	const devices = audioDevices.filter(
		(device) => device.deviceId && device.deviceId !== "default",
	);
	const selectedDeviceMissing =
		audioSettings.deviceId !== "default" &&
		!devices.some((device) => device.deviceId === audioSettings.deviceId);

	useEffect(() => {
		void voice.refreshAudioDevices();
	}, [voice]);

	return (
		<section
			aria-label={t("voice.audio.settingsTitle")}
			className="bg-md-surface-container-low flex min-w-0 flex-col gap-3 rounded-xl p-4"
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h3 className="text-md-on-surface text-title-small-emph">
					{t("voice.audio.settingsTitle")}
				</h3>
				<Badge
					variant="soft"
					tone={audioProcessing === "fallback" ? "warning" : "default"}
					size="sm"
					role="status"
				>
					{t(`voice.audio.processing.${audioProcessing}`)}
				</Badge>
			</div>

			<div className="flex min-w-0 items-end gap-2">
				<div className="flex min-w-0 flex-1 flex-col gap-1.5">
					<label
						htmlFor={deviceId}
						className="text-md-on-surface-variant text-label-medium"
					>
						{t("voice.audio.microphone")}
					</label>
					<Select
						value={audioSettings.deviceId}
						onValueChange={(value) => {
							void voice.updateAudioSettings({ deviceId: value });
						}}
					>
						<SelectTrigger
							id={deviceId}
							aria-label={t("voice.audio.microphone")}
							className="min-w-0"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent position="popper" align="start">
							<SelectGroup>
								<SelectItem value="default">
									{t("voice.audio.defaultDevice")}
								</SelectItem>
								{selectedDeviceMissing ? (
									<SelectItem value={audioSettings.deviceId}>
										{t("voice.audio.unavailableDevice")}
									</SelectItem>
								) : null}
								{devices.map((device) => (
									<SelectItem key={device.deviceId} value={device.deviceId}>
										{device.label.trim() || t("voice.audio.unnamedDevice")}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</div>
				<Button
					type="button"
					variant="tertiary"
					size="icon-sm"
					className="bg-md-surface-container-highest shrink-0"
					disabled={refreshing}
					aria-label={t("voice.audio.refreshDevices")}
					onClick={async () => {
						if (refreshing) return;
						setRefreshing(true);
						try {
							await voice.refreshAudioDevices();
						} finally {
							setRefreshing(false);
						}
					}}
				>
					<RefreshCw className={cn(refreshing && "animate-spin")} />
				</Button>
			</div>

			{audioProcessing === "fallback" ? (
				<Alert variant="warning">
					<AlertContent>
						<AlertDescription>{t("voice.audio.fallbackHint")}</AlertDescription>
					</AlertContent>
				</Alert>
			) : null}

			<div className="grid min-w-0 gap-2 sm:grid-cols-2">
				<VoiceProcessingSwitch
					voice={voice}
					settings={audioSettings}
					setting="echoCancellation"
					label={t("voice.audio.echoCancellation")}
					applied={snapshot.appliedAudioConstraints.echoCancellation}
				/>
				<VoiceProcessingSwitch
					voice={voice}
					settings={audioSettings}
					setting="noiseSuppression"
					label={t("voice.audio.noiseSuppression")}
					applied={snapshot.appliedAudioConstraints.noiseSuppression}
				/>
				<VoiceProcessingSwitch
					voice={voice}
					settings={audioSettings}
					setting="autoGainControl"
					label={t("voice.audio.autoGainControl")}
					applied={snapshot.appliedAudioConstraints.autoGainControl}
				/>
				<VoiceProcessingSwitch
					voice={voice}
					settings={audioSettings}
					setting="deepNoiseSuppression"
					label={t("voice.audio.deepNoiseSuppression")}
				/>
				<VoiceProcessingSwitch
					voice={voice}
					settings={audioSettings}
					setting="noiseGate"
					label={t("voice.audio.noiseGate")}
				/>
				<VoiceProcessingSwitch
					voice={voice}
					settings={audioSettings}
					setting="compressor"
					label={t("voice.audio.compressor")}
				/>
			</div>

			{audioSettings.deepNoiseSuppression ? (
				<p className="text-md-on-surface-variant text-body-small">
					{t("voice.audio.deepNoiseSuppressionHint")}
				</p>
			) : null}

			<div className="bg-md-surface-container flex flex-col gap-3 rounded-lg p-3">
				<div className="flex items-center justify-between gap-3">
					<span className="text-md-on-surface text-label-large">
						{t("voice.audio.speakingMode")}
					</span>
					{audioSettings.pushToTalk ? (
						<span
							role="status"
							className="text-md-on-surface-variant text-label-medium"
						>
							{t(
								snapshot.pushToTalkActive
									? "voice.audio.pushToTalkActive"
									: "voice.audio.pushToTalkInactive",
							)}
						</span>
					) : null}
				</div>
				<ToggleGroup
					type="single"
					variant="outline"
					size="sm"
					spacing={1}
					value={audioSettings.pushToTalk ? "ptt" : "continuous"}
					aria-label={t("voice.audio.speakingMode")}
					className="grid w-full grid-cols-2"
					onValueChange={(value) => {
						if (!value) return;
						void voice.updateAudioSettings({ pushToTalk: value === "ptt" });
					}}
				>
					<ToggleGroupItem value="continuous" className="min-h-10">
						{t("voice.audio.continuousMode")}
					</ToggleGroupItem>
					<ToggleGroupItem value="ptt" className="min-h-10">
						{t("voice.audio.pushToTalkMode")}
					</ToggleGroupItem>
				</ToggleGroup>

				{audioSettings.pushToTalk ? (
					<>
						<div className="flex min-w-0 flex-col gap-1.5">
							<label
								htmlFor={keyId}
								className="text-md-on-surface-variant text-label-medium"
							>
								{t("voice.audio.pushToTalkKey")}
							</label>
							<Select
								value={audioSettings.pushToTalkKey}
								onValueChange={(value) => {
									void voice.updateAudioSettings({ pushToTalkKey: value });
								}}
							>
								<SelectTrigger
									id={keyId}
									aria-label={t("voice.audio.pushToTalkKey")}
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent position="popper" align="start">
									<SelectGroup>
										<SelectItem value="Space">
											{t("voice.audio.keySpace")}
										</SelectItem>
										<SelectItem value="KeyV">V</SelectItem>
										<SelectItem value="KeyB">B</SelectItem>
									</SelectGroup>
								</SelectContent>
							</Select>
						</div>
						<p className="text-md-on-surface-variant text-body-small">
							{t("voice.audio.pushToTalkHint")}
						</p>
						{snapshot.member ? (
							<PushToTalkButton voice={voice} snapshot={snapshot} />
						) : null}
					</>
				) : null}
			</div>
		</section>
	);
}

export function VoicePanelBody({
	voice,
	snapshot,
}: {
	voice: VoiceController;
	snapshot: VoiceSnapshot;
}) {
	const limitId = useId();
	useEffect(() => {
		return () => {
			voice.stopMicTest();
		};
	}, [voice]);
	const {
		state,
		member,
		pending,
		mic,
		audioSettings,
		playbackMuted,
		playbackBlocked,
		peerConnecting,
		peerFailed,
		memberVolumes,
		speakerPopupOpen,
		error,
	} = snapshot;
	const status = voiceStatusKey(snapshot);
	const roomFull = !!state && state.memberCount >= state.limit;
	const MicIcon = mic === "on" ? Mic : MicOff;
	const PlaybackIcon = playbackMuted ? VolumeX : Volume2;
	const activeSpeakers = (state?.members ?? []).filter((item) =>
		isVoiceMemberSpeaking(snapshot, item),
	);

	return (
		<div className="flex min-w-0 flex-col gap-4">
			{error ? (
				<Alert variant="danger">
					<AlertContent>
						<AlertDescription>
							{translateOr(`voice.error.${error}`, t("voice.error.generic"))}
						</AlertDescription>
					</AlertContent>
				</Alert>
			) : null}
			{mic === "denied" || mic === "unavailable" ? (
				<Alert variant="warning">
					<AlertContent>
						<AlertDescription>{t(`voice.mic.${mic}`)}</AlertDescription>
					</AlertContent>
				</Alert>
			) : null}
			{playbackBlocked ? (
				<Alert variant="warning">
					<AlertContent>
						<AlertDescription>{t("voice.autoplayHint")}</AlertDescription>
					</AlertContent>
					<Button
						type="button"
						variant="tertiary"
						size="xs"
						className="bg-md-surface-container-highest min-h-9 shrink-0"
						onClick={() => voice.retryPlayback()}
					>
						{t("voice.retryPlayback")}
					</Button>
				</Alert>
			) : null}
			{peerFailed > 0 ? (
				<Alert variant="warning">
					<AlertContent>
						<AlertDescription>
							{t("voice.peersFailed", { count: peerFailed })}
						</AlertDescription>
					</AlertContent>
				</Alert>
			) : null}

			<div className="grid min-w-0 items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-6">
				<div className="flex min-w-0 flex-col gap-4 md:sticky md:top-0">
					<section
						aria-label={t("voice.currentSection")}
						className="flex flex-col gap-3"
					>
						<h3 className="text-md-on-surface text-title-medium-emph">
							{t("voice.currentSection")}
						</h3>
						<div
							className={cn(
								"flex flex-col gap-3.5 rounded-xl p-4",
								member
									? "bg-md-surface-container"
									: "bg-md-surface-container-low",
							)}
						>
							<div className="flex items-center justify-between gap-3">
								<div className="flex min-w-0 flex-1 items-center gap-3">
									<span
										className={cn(
											"grid size-10 shrink-0 place-items-center rounded-full",
											activeSpeakers.length > 0
												? "bg-md-primary-container text-md-on-primary-container"
												: "bg-md-surface-container-highest text-md-on-surface-variant",
										)}
									>
										{activeSpeakers.length > 0 ? (
											<AudioLines
												className="size-5 animate-pulse"
												aria-hidden="true"
											/>
										) : (
											<Headphones className="size-5" aria-hidden="true" />
										)}
									</span>
									<div className="flex min-w-0 flex-1 flex-col gap-0.5">
										<div
											role="status"
											className="flex flex-wrap items-center gap-2"
										>
											<Badge
												tone={member ? "accent" : "default"}
												variant="soft"
											>
												{t(status)}
											</Badge>
											{state ? (
												<span className="text-md-on-surface-variant text-label-medium tabular-nums">
													{t("voice.count", {
														count: state.memberCount,
														limit: state.limit,
													})}
												</span>
											) : null}
										</div>
										{member && peerConnecting > 0 ? (
											<span className="text-md-on-surface-variant text-body-small">
												{t("voice.peersConnecting", { count: peerConnecting })}
											</span>
										) : !member ? (
											<p className="text-md-on-surface-variant text-body-small">
												{t(
													state?.enabled
														? "voice.roomOpenHint"
														: "voice.roomClosedHint",
												)}
											</p>
										) : null}
									</div>
								</div>
								{member ? (
									<Button
										type="button"
										variant="tertiary"
										size="xs"
										className="bg-md-surface-container-highest text-md-on-surface-variant hover:text-danger h-9 shrink-0 px-3"
										onClick={() => voice.leave()}
									>
										<PhoneOff className="size-4" aria-hidden="true" />
										{t("voice.leave")}
									</Button>
								) : null}
							</div>

							{member ? (
								<>
									<div className="grid grid-cols-2 gap-2.5">
										<Button
											type="button"
											variant={mic === "on" ? "primary" : "tonal"}
											size="sm"
											className="min-h-11 w-full"
											disabled={!member.canSpeak}
											onClick={() => {
												void voice.toggleMic();
											}}
										>
											<MicIcon data-icon="inline-start" />
											{t(
												audioSettings.pushToTalk
													? mic === "requesting"
														? "voice.audio.pushToTalkMicCancel"
														: mic === "on"
															? "voice.audio.pushToTalkMicOff"
															: "voice.audio.pushToTalkMicOn"
													: mic === "on"
														? "voice.micOff"
														: mic === "requesting"
															? "voice.micCancel"
															: "voice.micOn",
											)}
										</Button>
										<Button
											type="button"
											variant={playbackMuted ? "dangerSoft" : "tertiary"}
											size="sm"
											className={cn(
												"min-h-11 w-full",
												!playbackMuted && "bg-md-surface-container-highest",
											)}
											onClick={() => voice.togglePlayback()}
										>
											<PlaybackIcon data-icon="inline-start" />
											{t(
												playbackMuted
													? "voice.playbackOn"
													: "voice.playbackOff",
											)}
										</Button>
									</div>
									{!member.canSpeak ? (
										<p className="text-md-on-surface-variant text-body-small">
											{t(
												member.muted ? "voice.mutedHint" : "voice.listenHint",
											)}
										</p>
									) : null}
								</>
							) : state?.enabled && state.available ? (
								<Button
									type="button"
									variant="primary"
									size="sm"
									className="min-h-11 w-full"
									disabled={roomFull || pending !== null}
									onClick={() => voice.join()}
								>
									{t("voice.join")}
								</Button>
							) : null}
						</div>
					</section>

					<VoiceAudioSettingsSection voice={voice} snapshot={snapshot} />

					<VoiceMicTestCard voice={voice} snapshot={snapshot} />

					{member ? (
						<div className="bg-md-surface-container-low flex items-center justify-between gap-3 rounded-xl px-4 py-3">
							<div className="flex min-w-0 flex-col gap-0.5">
								<span className="text-md-on-surface text-label-large">
									{t("voice.speakerPopupSwitch")}
								</span>
								<span className="text-md-on-surface-variant text-body-small">
									{t("voice.speakerPopupHint")}
								</span>
							</div>
							<Switch
								checked={speakerPopupOpen}
								aria-label={t("voice.speakerPopupSwitch")}
								onCheckedChange={(checked) =>
									voice.setSpeakerPopupOpen(Boolean(checked))
								}
							/>
						</div>
					) : null}

					{state?.canManage ? (
						<section
							aria-label={t("voice.roomSettings")}
							className="bg-md-surface-container-low flex flex-col gap-3 rounded-xl p-4"
						>
							<h3 className="text-md-on-surface text-title-small-emph">
								{t("voice.roomSettings")}
							</h3>
							<Select
								value={String(state.limit)}
								disabled={
									state.enabled || !state.available || pending !== null
								}
								onValueChange={(value) =>
									voice.configure({ limit: Number(value) })
								}
							>
								<SelectTrigger
									id={limitId}
									aria-label={t("voice.limit")}
									className="bg-md-surface-container-high border-field-border text-md-on-surface focus-visible:border-field-border-focus focus-visible:ring-focus-ring/35 flex h-auto w-full min-w-0 flex-col items-start justify-center gap-0.5 rounded-lg border px-3 py-2 text-left shadow-[inset_0_1px_0_#ffffff0a] transition-[background-color,border-color,box-shadow] duration-200 ease-standard-fast-effects hover:border-field-border-hover focus-visible:ring-4 [&>svg]:hidden"
								>
									<span className="text-md-on-surface-variant text-label-small">
										{t("voice.limit")}
									</span>
									<span className="text-md-on-surface flex w-full min-w-0 items-center justify-between gap-2 text-label-large">
										<SelectValue />
										<ChevronDown className="text-md-on-surface-variant size-4 shrink-0" />
									</span>
								</SelectTrigger>
								<SelectContent
									position="popper"
									align="start"
									sideOffset={6}
									className="bg-md-surface-container-highest border-md-outline-variant/60 min-w-[var(--radix-select-trigger-width)] w-[var(--radix-select-trigger-width)] border"
								>
									<SelectGroup>
										{Array.from(
											{ length: state.maxLimit - 1 },
											(_, index) => index + 2,
										).map((limit) => (
											<SelectItem
												key={limit}
												value={String(limit)}
												disabled={limit < state.memberCount}
											>
												{t("voice.limitOption", { limit })}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
							<Button
								type="button"
								variant={state.enabled ? "tertiary" : "primary"}
								size="sm"
								className={cn(
									"min-h-11 w-full",
									state.enabled && "bg-md-surface-container-highest",
								)}
								disabled={
									(!state.enabled && !state.available) || pending !== null
								}
								onClick={() => voice.configure({ enabled: !state.enabled })}
							>
								{t(state.enabled ? "voice.closeRoom" : "voice.openRoom")}
							</Button>
						</section>
					) : null}
				</div>

				<section
					aria-label={t("voice.members")}
					className="flex min-w-0 flex-col gap-3"
				>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div className="flex items-center gap-2">
							<h3 className="text-md-on-surface text-title-medium-emph">
								{t("voice.members")}
							</h3>
							{state && state.members.length > 0 ? (
								<span className="text-md-on-surface-variant font-mono text-label-medium tabular-nums">
									{state.members.length}
								</span>
							) : null}
						</div>
						{activeSpeakers.length > 0 ? (
							<Badge variant="soft" tone="accent" size="sm">
								{t("voice.speakingSummary", {
									names: activeSpeakers.map((item) => item.name).join("、"),
								})}
							</Badge>
						) : null}
					</div>
					{state && state.members.length > 0 ? (
						<ul
							aria-label={t("voice.members")}
							className="flex max-h-[min(48dvh,380px)] flex-col gap-2 overflow-y-auto pr-0.5"
						>
							{state.members.map((item) => (
								<VoiceMemberCard
									key={item.id}
									item={item}
									isSelf={member?.id === item.id}
									joined={member !== null}
									speaking={isVoiceMemberSpeaking(snapshot, item)}
									volume={memberVolumes[item.id] ?? 100}
									manage={state.canManage}
									busy={pending !== null}
									voice={voice}
								/>
							))}
						</ul>
					) : (
						<div className="bg-md-surface-container-low flex items-center gap-3 rounded-xl p-4">
							<Headphones
								className="text-md-on-surface-variant size-5 shrink-0"
								aria-hidden="true"
							/>
							<p className="text-md-on-surface-variant text-body-medium">
								{t(
									state?.enabled && !member && !state.canManage
										? "voice.membersJoinHint"
										: "voice.membersEmpty",
								)}
							</p>
						</div>
					)}
				</section>
			</div>
		</div>
	);
}
