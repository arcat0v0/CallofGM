import type { VoiceMember } from "@cogm/shared";
import {
	AudioLines,
	Download,
	Headphones,
	Mic,
	MicOff,
	PhoneOff,
	RefreshCw,
	Volume2,
	VolumeX,
} from "lucide-react";
import {
	type ReactNode,
	type Ref,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Alert, AlertContent, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { t, translateOr } from "@/i18n";
import { initialsOf } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
	isVoiceMemberSpeaking,
	type PeerHealth,
	type VoiceAudioSettings,
	type VoiceController,
	type VoiceSnapshot,
} from "./voice-controller";

export function voiceStatusKey(snapshot: VoiceSnapshot): string {
	const {
		link,
		pending,
		member,
		state,
		peerConnecting,
		peerConnected,
		peerFailed,
	} = snapshot;
	const roomFull = !!state && state.memberCount >= state.limit;
	if (link !== "ready") return `voice.link.${link}`;
	if (pending === "voice:join") return "voice.joining";
	if (pending === "voice:leave") return "voice.leaving";
	if (member) {
		const remoteCount = Math.max(0, (state?.members.length ?? 1) - 1);
		if (remoteCount > 0) {
			if (peerFailed > 0 && peerConnected === 0 && peerConnecting === 0) {
				return "voice.connectionFailed";
			}
			if (peerFailed > 0) {
				return "voice.connectionPartial";
			}
			if (peerConnecting > 0 && peerConnected === 0) {
				return "voice.connectingPeers";
			}
		}
		return "voice.joined";
	}
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
					? "bg-md-primary motion-safe:animate-pulse"
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
				size="sm"
				value={[volume]}
				min={0}
				max={100}
				step={1}
				aria-label={t("voice.speakerVolumeFor", { name: member.name })}
				aria-valuetext={`${volume}%`}
				className={cn(
					"flex-1 [&_[data-slot=slider-track]]:bg-md-surface-container-highest!",
					compact ? "min-h-7!" : "min-h-8!",
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

/** The mic is open and actually sending audio (push-to-talk armed is not live). */
function micTransmitting(snapshot: VoiceSnapshot): boolean {
	return (
		snapshot.mic === "on" &&
		(!snapshot.audioSettings.pushToTalk || snapshot.pushToTalkActive)
	);
}

function VoiceMemberCard({
	item,
	isSelf,
	joined,
	speaking,
	peerHealth,
	volume,
	manage,
	busy,
	voice,
}: {
	item: VoiceMember;
	isSelf: boolean;
	joined: boolean;
	speaking: boolean;
	peerHealth?: PeerHealth;
	volume: number;
	manage: boolean;
	busy: boolean;
	voice: VoiceController;
}) {
	const showVolume = joined && !isSelf;
	const canGrant = manage && item.role === "ob";
	// Observers without a speak grant cannot use a mic, so muting them is moot.
	const canMute = manage && item.role !== "gm" && item.canSpeak !== false;
	const canUnmute = manage && item.role !== "gm" && item.muted;

	return (
		<li
			className={cn(
				"flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl p-3 transition-[background-color,box-shadow] duration-150 ease-standard-fast-effects",
				speaking
					? "bg-md-primary-container/35 ring-1 ring-inset ring-md-primary/60"
					: "bg-md-surface-container",
			)}
		>
			<Avatar
				size="sm"
				aria-hidden="true"
				className={cn(
					"transition-colors",
					speaking
						? "bg-md-primary text-md-on-primary"
						: "bg-md-surface-container-highest text-md-on-surface-variant",
				)}
			>
				<AvatarFallback className="text-title-small-emph text-inherit">
					{initialsOf(item.name)}
				</AvatarFallback>
			</Avatar>
			<div className="flex min-w-32 flex-1 flex-col gap-1">
				<div className="flex min-w-0 items-center gap-2">
					<span
						className="text-md-on-surface min-w-0 truncate text-title-small-emph"
						title={item.name}
					>
						{item.name}
					</span>
					{isSelf ? (
						<Badge variant="soft" tone="accent" size="sm">
							{t("voice.self")}
						</Badge>
					) : null}
				</div>
				<div className="flex flex-wrap items-center gap-1.5">
					{item.role !== "pc" ? (
						<Badge variant="soft" size="sm">
							{t(`voice.role.${item.role}`)}
						</Badge>
					) : null}
					{speaking ? (
						<Badge variant="soft" tone="accent" size="sm">
							<AudioLines
								className="size-3 motion-safe:animate-pulse"
								aria-hidden="true"
							/>
							{t("voice.speaking")}
						</Badge>
					) : null}
					{joined && !isSelf && peerHealth ? (
						<Badge
							variant="soft"
							tone={
								peerHealth === "failed"
									? "danger"
									: peerHealth === "connecting"
										? "warning"
										: "default"
							}
							size="sm"
						>
							{t(`voice.peerState.${peerHealth}`)}
						</Badge>
					) : null}
					{!item.canSpeak && (item.muted || item.role !== "ob") ? (
						<Badge
							variant="soft"
							tone={item.muted ? "danger" : "default"}
							size="sm"
						>
							<MicOff className="size-3" aria-hidden="true" />
							{t(item.muted ? "voice.moderatorMuted" : "voice.listenOnly")}
						</Badge>
					) : null}
				</div>
			</div>
			{showVolume ? (
				<div className="order-last w-full @2xl:order-none @2xl:w-60">
					<SpeakerVolumeControl member={item} volume={volume} voice={voice} />
				</div>
			) : null}
			{canGrant || canMute || canUnmute ? (
				<div className="ml-auto flex flex-wrap justify-end gap-1.5 @2xl:min-w-44 @2xl:flex-nowrap">
					{canGrant ? (
						<Button
							type="button"
							variant={item.speakGranted ? "tertiary" : "tonal"}
							size="sm"
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
					{canMute || canUnmute ? (
						<Button
							type="button"
							variant={item.muted ? "tonal" : "tertiary"}
							size="sm"
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
					) : null}
				</div>
			) : null}
		</li>
	);
}

function SubsectionTitle({ children }: { children: ReactNode }) {
	return (
		<h4 className="text-md-on-surface-variant text-label-large">{children}</h4>
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
	const active = micTest === "active";

	return (
		<section
			aria-label={t("voice.micTestTitle")}
			className="flex min-w-0 flex-col gap-2.5"
		>
			<div className="flex items-center justify-between gap-2">
				<SubsectionTitle>{t("voice.micTestTitle")}</SubsectionTitle>
				{active ? (
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

			<div className="bg-md-surface-container flex min-w-0 flex-col gap-3 rounded-lg p-3">
				{active ? (
					<>
						<div className="flex items-center gap-3">
							<Progress
								aria-label={t("voice.micTestLevel")}
								value={micTestLevel}
								className="min-w-0 flex-1"
							/>
							<span className="text-md-on-surface-variant w-10 shrink-0 text-right font-mono text-label-small tabular-nums">
								{micTestLevel}%
							</span>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<Button
								type="button"
								variant={micTestLoopback ? "primary" : "tertiary"}
								size="sm"
								className="w-full"
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
								className="w-full"
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
								className="w-full"
								onClick={() => voice.stopMicTest()}
							>
								{t("voice.micTestCancel")}
							</Button>
						) : (
							<Button
								type="button"
								variant="tertiary"
								size="sm"
								className="w-full"
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
			</div>
		</section>
	);
}

type AudioProcessingSetting = Exclude<
	keyof VoiceAudioSettings,
	| "deviceId"
	| "outputDeviceId"
	| "pushToTalk"
	| "pushToTalkKey"
	| "noiseSuppressionEngine"
>;

/** Row in a grouped settings list: label + hint on the left, switch on the right. */
function SwitchRow({
	label,
	hint,
	hintTone = "default",
	checked,
	onCheckedChange,
	switchRef,
	children,
}: {
	label: string;
	hint?: string;
	hintTone?: "default" | "notice";
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	switchRef?: Ref<HTMLButtonElement>;
	children?: ReactNode;
}) {
	const id = useId();
	const hintId = useId();
	return (
		<div className="flex min-w-0 flex-col gap-2 px-3 py-2.5">
			<div className="flex min-w-0 items-center justify-between gap-3">
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<label
						htmlFor={id}
						className="text-md-on-surface cursor-pointer text-label-large"
					>
						{label}
					</label>
					{hint ? (
						<span
							id={hintId}
							className={cn(
								"text-body-small",
								hintTone === "notice"
									? "text-warning"
									: "text-md-on-surface-variant",
							)}
						>
							{hint}
						</span>
					) : null}
				</div>
				<Switch
					ref={switchRef}
					id={id}
					size="sm"
					checked={checked}
					aria-label={label}
					aria-describedby={hint ? hintId : undefined}
					onCheckedChange={onCheckedChange}
				/>
			</div>
			{children}
		</div>
	);
}

function SwitchList({ children }: { children: ReactNode }) {
	return (
		<div className="bg-md-surface-container divide-md-outline-variant/30 flex flex-col divide-y overflow-hidden rounded-lg">
			{children}
		</div>
	);
}

function VoiceProcessingSwitch({
	voice,
	settings,
	setting,
	label,
	hint,
	applied,
	children,
}: {
	voice: VoiceController;
	settings: VoiceAudioSettings;
	setting: AudioProcessingSetting;
	label: string;
	hint?: string;
	applied?: boolean | null;
	children?: ReactNode;
}) {
	const checked = settings[setting];
	// Only surface the browser-reported state when it disagrees with the
	// request: matching or unreported values are just noise.
	const mismatch = typeof applied === "boolean" && applied !== checked;
	return (
		<SwitchRow
			label={label}
			hint={
				mismatch
					? t("voice.audio.appliedMismatch", {
							state: t(
								applied ? "voice.audio.appliedOn" : "voice.audio.appliedOff",
							),
						})
					: hint
			}
			hintTone={mismatch ? "notice" : "default"}
			checked={checked}
			onCheckedChange={(next) => {
				void voice.updateAudioSettings({ [setting]: next });
			}}
		>
			{children}
		</SwitchRow>
	);
}

function VoiceSwitchGroup({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<fieldset aria-label={title} className="flex min-w-0 flex-col gap-2">
			<SubsectionTitle>{title}</SubsectionTitle>
			<SwitchList>{children}</SwitchList>
		</fieldset>
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
			<span aria-hidden="true" className="text-label-medium opacity-90">
				{snapshot.audioSettings.pushToTalkKey === "Space"
					? t("voice.audio.keySpace")
					: snapshot.audioSettings.pushToTalkKey.replace(/^Key/, "")}
			</span>
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
	const outputId = useId();
	const keyId = useId();
	const engineId = useId();
	const {
		audioSettings,
		audioDevices,
		audioOutputDevices,
		supportsOutputSelection,
		audioProcessing,
	} = snapshot;
	// Before capture starts nothing has been applied yet, so there is no
	// browser-reported state to compare against.
	const reported = audioProcessing !== "idle";
	const devices = audioDevices.filter(
		(device) => device.deviceId && device.deviceId !== "default",
	);
	const selectedDeviceMissing =
		audioSettings.deviceId !== "default" &&
		!devices.some((device) => device.deviceId === audioSettings.deviceId);
	const outputDevices = (audioOutputDevices ?? []).filter(
		(device) => device.deviceId && device.deviceId !== "default",
	);
	const selectedOutputMissing =
		audioSettings.outputDeviceId !== "default" &&
		!outputDevices.some(
			(device) => device.deviceId === audioSettings.outputDeviceId,
		);

	useEffect(() => {
		void voice.refreshAudioDevices();
	}, [voice]);

	return (
		<section
			aria-label={t("voice.audio.settingsTitle")}
			className="bg-md-surface-container-low flex min-w-0 flex-col gap-4 rounded-xl p-4"
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h3 className="text-md-on-surface text-title-medium-emph">
					{t("voice.audio.settingsTitle")}
				</h3>
				{audioProcessing !== "idle" ? (
					<Badge
						variant="soft"
						tone={audioProcessing === "fallback" ? "warning" : "default"}
						size="sm"
						role="status"
					>
						{t(`voice.audio.processing.${audioProcessing}`)}
					</Badge>
				) : null}
			</div>

			{audioProcessing === "fallback" ? (
				<Alert variant="warning">
					<AlertContent>
						<AlertDescription>{t("voice.audio.fallbackHint")}</AlertDescription>
					</AlertContent>
				</Alert>
			) : null}

			<div className="grid min-w-0 items-start gap-5 @2xl:grid-cols-2 @2xl:gap-6">
				<div className="flex min-w-0 flex-col gap-5">
					<div className="flex min-w-0 flex-col gap-2">
						<label
							htmlFor={deviceId}
							className="text-md-on-surface-variant text-label-large"
						>
							{t("voice.audio.microphone")}
						</label>
						<div className="flex min-w-0 items-center gap-2">
							<Select
								value={audioSettings.deviceId}
								onValueChange={(value) => {
									void voice.updateAudioSettings({ deviceId: value });
								}}
							>
								<SelectTrigger
									id={deviceId}
									aria-label={t("voice.audio.microphone")}
									className="min-w-0 flex-1"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent
									position="popper"
									align="start"
									className="max-w-[min(24rem,calc(100vw-2rem))]"
								>
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
							<IconButton
								type="button"
								variant="tertiary"
								size="sm"
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
							</IconButton>
						</div>
					</div>

					<div className="flex min-w-0 flex-col gap-2">
						<label
							htmlFor={outputId}
							className="text-md-on-surface-variant text-label-large"
						>
							{t("voice.audio.speaker")}
						</label>
						<Select
							value={
								supportsOutputSelection
									? audioSettings.outputDeviceId
									: "default"
							}
							disabled={!supportsOutputSelection}
							onValueChange={(value) => {
								void voice.updateAudioSettings({ outputDeviceId: value });
							}}
						>
							<SelectTrigger
								id={outputId}
								aria-label={t("voice.audio.speaker")}
								className="w-full min-w-0"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent
								position="popper"
								align="start"
								className="max-w-[min(24rem,calc(100vw-2rem))]"
							>
								<SelectGroup>
									<SelectItem value="default">
										{t("voice.audio.defaultDevice")}
									</SelectItem>
									{selectedOutputMissing ? (
										<SelectItem value={audioSettings.outputDeviceId}>
											{t("voice.audio.unavailableDevice")}
										</SelectItem>
									) : null}
									{outputDevices.map((device) => (
										<SelectItem key={device.deviceId} value={device.deviceId}>
											{device.label.trim() ||
												t("voice.audio.unnamedOutputDevice")}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
						{!supportsOutputSelection ? (
							<p className="text-md-on-surface-variant text-body-small">
								{t("voice.audio.outputUnsupported")}
							</p>
						) : null}
					</div>

					<VoiceMicTestCard voice={voice} snapshot={snapshot} />

					<div className="flex min-w-0 flex-col gap-2">
						<div className="flex items-center justify-between gap-3">
							<SubsectionTitle>{t("voice.audio.speakingMode")}</SubsectionTitle>
							{audioSettings.pushToTalk && snapshot.member?.canSpeak ? (
								<span className="text-md-on-surface-variant text-label-medium">
									{t(
										snapshot.pushToTalkActive
											? "voice.audio.pushToTalkActive"
											: "voice.audio.pushToTalkInactive",
									)}
								</span>
							) : null}
						</div>
						<SegmentedControl
							aria-label={t("voice.audio.speakingMode")}
							value={audioSettings.pushToTalk ? "ptt" : "continuous"}
							options={[
								{ value: "continuous", label: t("voice.audio.continuousMode") },
								{ value: "ptt", label: t("voice.audio.pushToTalkMode") },
							]}
							onValueChange={(value) => {
								void voice.updateAudioSettings({ pushToTalk: value === "ptt" });
							}}
						/>
						{audioSettings.pushToTalk ? (
							<div className="bg-md-surface-container flex min-w-0 flex-col gap-3 rounded-lg p-3">
								<div className="flex min-w-0 items-center justify-between gap-3">
									<label
										htmlFor={keyId}
										className="text-md-on-surface shrink-0 text-label-large whitespace-nowrap"
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
											className="w-32 min-w-0"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent position="popper" align="end">
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
									{t(
										snapshot.member?.canSpeak
											? "voice.audio.pushToTalkHint"
											: !snapshot.member
												? "voice.audio.pushToTalkHintJoin"
												: snapshot.member.muted
													? "voice.audio.pushToTalkHintMuted"
													: "voice.audio.pushToTalkHintGrant",
									)}
								</p>
							</div>
						) : null}
					</div>
				</div>

				<div className="flex min-w-0 flex-col gap-5">
					<VoiceSwitchGroup title={t("voice.audio.groupBrowser")}>
						<VoiceProcessingSwitch
							voice={voice}
							settings={audioSettings}
							setting="echoCancellation"
							label={t("voice.audio.echoCancellation")}
							hint={t("voice.audio.echoCancellationHint")}
							applied={
								reported
									? snapshot.appliedAudioConstraints.echoCancellation
									: undefined
							}
						/>
						<VoiceProcessingSwitch
							voice={voice}
							settings={audioSettings}
							setting="noiseSuppression"
							label={t("voice.audio.noiseSuppression")}
							hint={t("voice.audio.noiseSuppressionHint")}
							applied={
								reported
									? snapshot.appliedAudioConstraints.noiseSuppression
									: undefined
							}
						/>
						<VoiceProcessingSwitch
							voice={voice}
							settings={audioSettings}
							setting="autoGainControl"
							label={t("voice.audio.autoGainControl")}
							hint={t("voice.audio.autoGainControlHint")}
							applied={
								reported
									? snapshot.appliedAudioConstraints.autoGainControl
									: undefined
							}
						/>
					</VoiceSwitchGroup>
					<VoiceSwitchGroup title={t("voice.audio.groupEnhanced")}>
						<VoiceProcessingSwitch
							voice={voice}
							settings={audioSettings}
							setting="deepNoiseSuppression"
							label={t("voice.audio.deepNoiseSuppression")}
							hint={t(
								audioSettings.deepNoiseSuppression
									? "voice.audio.deepNoiseSuppressionHint"
									: "voice.audio.deepNoiseSuppressionOffHint",
							)}
						>
							{audioSettings.deepNoiseSuppression ? (
								<div className="flex min-w-0 flex-col gap-1">
									<div className="flex min-w-0 items-center justify-between gap-3">
										<label
											htmlFor={engineId}
											className="text-md-on-surface-variant shrink-0 text-body-medium"
										>
											{t("voice.audio.noiseSuppressionEngine")}
										</label>
										<Select
											value={audioSettings.noiseSuppressionEngine}
											onValueChange={(value) => {
												if (value !== "deepfilter" && value !== "rnnoise")
													return;
												void voice.updateAudioSettings({
													noiseSuppressionEngine: value,
												});
											}}
										>
											<SelectTrigger
												id={engineId}
												aria-label={t("voice.audio.noiseSuppressionEngine")}
												className="w-56 max-w-full min-w-0"
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent position="popper" align="end">
												<SelectGroup>
													<SelectItem value="deepfilter">
														{t("voice.audio.engine.deepfilter")}
													</SelectItem>
													<SelectItem value="rnnoise">
														{t("voice.audio.engine.rnnoise")}
													</SelectItem>
												</SelectGroup>
											</SelectContent>
										</Select>
									</div>
									<p className="text-md-on-surface-variant text-body-small">
										{t(
											audioSettings.noiseSuppressionEngine === "deepfilter"
												? "voice.audio.engine.deepfilterHint"
												: "voice.audio.engine.rnnoiseHint",
										)}
									</p>
								</div>
							) : null}
						</VoiceProcessingSwitch>
						<VoiceProcessingSwitch
							voice={voice}
							settings={audioSettings}
							setting="noiseGate"
							label={t("voice.audio.noiseGate")}
							hint={t("voice.audio.noiseGateHint")}
						/>
						<VoiceProcessingSwitch
							voice={voice}
							settings={audioSettings}
							setting="compressor"
							label={t("voice.audio.compressor")}
							hint={t("voice.audio.compressorHint")}
						/>
					</VoiceSwitchGroup>
				</div>
			</div>
		</section>
	);
}

function VoiceDiagnosticsRow({
	voice,
	snapshot,
}: {
	voice: VoiceController;
	snapshot: VoiceSnapshot;
}) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const toggleRef = useRef<HTMLButtonElement>(null);
	const statusKey = !snapshot.diagnosticsConsent
		? "disabled"
		: snapshot.member
			? "active"
			: "pending";

	return (
		<SwitchRow
			label={t("voice.diagnostics.title")}
			hint={t("voice.diagnostics.summary")}
			checked={snapshot.diagnosticsConsent}
			switchRef={toggleRef}
			onCheckedChange={(checked) => {
				if (checked) {
					setDialogOpen(true);
					return;
				}
				voice.setDiagnosticsConsent(false);
			}}
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p role="status" className="text-md-on-surface-variant text-body-small">
					{t(`voice.diagnostics.status.${statusKey}`)}
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={!snapshot.hasDiagnosticsLog}
					onClick={() => {
						const json = voice.getDiagnosticsExport();
						if (!json) return;
						const url = URL.createObjectURL(
							new Blob([json], { type: "application/json" }),
						);
						const link = document.createElement("a");
						link.href = url;
						link.download = "cogm-voice-diagnostics.json";
						document.body.append(link);
						try {
							link.click();
						} finally {
							link.remove();
							setTimeout(() => URL.revokeObjectURL(url), 0);
						}
					}}
				>
					<Download data-icon="inline-start" />
					{t("voice.diagnostics.export")}
				</Button>
			</div>
			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent
					className="max-w-lg p-4 sm:p-6"
					onCloseAutoFocus={(event) => {
						event.preventDefault();
						toggleRef.current?.focus();
					}}
				>
					<DialogHeader>
						<DialogTitle>{t("voice.diagnostics.dialogTitle")}</DialogTitle>
						<DialogDescription>
							{t("voice.diagnostics.dialogDescription")}
						</DialogDescription>
					</DialogHeader>
					<div className="text-md-on-surface-variant flex flex-col gap-3 text-body-medium">
						<p>{t("voice.diagnostics.collected")}</p>
						<p>{t("voice.diagnostics.identifiers")}</p>
						<p>{t("voice.diagnostics.retention")}</p>
						<p>{t("voice.diagnostics.membership")}</p>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="tertiary"
							onClick={() => setDialogOpen(false)}
						>
							{t("voice.diagnostics.decline")}
						</Button>
						<Button
							type="button"
							variant="primary"
							onClick={() => {
								voice.setDiagnosticsConsent(true);
								setDialogOpen(false);
							}}
						>
							{t("voice.diagnostics.accept")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</SwitchRow>
	);
}

function VoiceMoreSection({
	voice,
	snapshot,
}: {
	voice: VoiceController;
	snapshot: VoiceSnapshot;
}) {
	return (
		<section
			aria-label={t("voice.moreTitle")}
			className="bg-md-surface-container-low flex min-w-0 flex-col gap-3 rounded-xl p-4"
		>
			<h3 className="text-md-on-surface text-title-medium-emph">
				{t("voice.moreTitle")}
			</h3>
			<SwitchList>
				{snapshot.member ? (
					<SwitchRow
						label={t("voice.speakerPopupSwitch")}
						hint={t("voice.speakerPopupHint")}
						checked={snapshot.speakerPopupOpen}
						onCheckedChange={(checked) =>
							voice.setSpeakerPopupOpen(Boolean(checked))
						}
					/>
				) : null}
				<VoiceDiagnosticsRow voice={voice} snapshot={snapshot} />
			</SwitchList>
		</section>
	);
}

function VoiceRoomSettings({
	voice,
	snapshot,
}: {
	voice: VoiceController;
	snapshot: VoiceSnapshot;
}) {
	const { state, pending } = snapshot;
	const [confirmOpen, setConfirmOpen] = useState(false);
	// While closed, the limit and the open action live together in the hero.
	if (!state?.canManage || !state.enabled) return null;

	return (
		<section
			aria-label={t("voice.roomSettings")}
			className="bg-md-surface-container-low flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl p-3 pl-4"
		>
			<div className="flex min-w-0 flex-col gap-0.5">
				<h3 className="text-md-on-surface text-title-small-emph">
					{t("voice.roomSettings")}
				</h3>
				<p className="text-md-on-surface-variant text-body-small">
					{t("voice.limitLockedHint", { limit: state.limit })}
				</p>
			</div>
			<Button
				type="button"
				variant="tertiary"
				size="sm"
				className="hover:text-danger"
				disabled={pending !== null}
				onClick={() => setConfirmOpen(true)}
			>
				{t("voice.closeRoom")}
			</Button>
			<ConfirmDialog
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				icon={PhoneOff}
				title={t("voice.closeRoomConfirmTitle")}
				description={t("voice.closeRoomConfirmDescription", {
					count: state.memberCount,
				})}
				confirmLabel={t("voice.closeRoom")}
				onConfirm={() => {
					setConfirmOpen(false);
					voice.configure({ enabled: false });
				}}
			/>
		</section>
	);
}

function VoiceLimitSelect({
	voice,
	snapshot,
}: {
	voice: VoiceController;
	snapshot: VoiceSnapshot;
}) {
	const { state, pending } = snapshot;
	const limitId = useId();
	if (!state) return null;
	return (
		<div className="flex items-center gap-2">
			<label
				htmlFor={limitId}
				className="text-md-on-surface-variant text-label-large"
			>
				{t("voice.limit")}
			</label>
			<Select
				value={String(state.limit)}
				disabled={!state.available || pending !== null}
				onValueChange={(value) => voice.configure({ limit: Number(value) })}
			>
				<SelectTrigger
					id={limitId}
					aria-label={t("voice.limit")}
					className="w-28"
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent position="popper" align="end">
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
		</div>
	);
}

function VoiceHero({
	voice,
	snapshot,
	activeSpeakers,
}: {
	voice: VoiceController;
	snapshot: VoiceSnapshot;
	activeSpeakers: VoiceMember[];
}) {
	const {
		state,
		member,
		pending,
		mic,
		audioSettings,
		playbackMuted,
		peerConnecting,
		peerConnected,
		peerFailed,
	} = snapshot;
	const status = voiceStatusKey(snapshot);
	const roomFull = !!state && state.memberCount >= state.limit;
	const MicIcon = mic === "on" ? Mic : MicOff;
	const PlaybackIcon = playbackMuted ? VolumeX : Volume2;
	const speaking = activeSpeakers.length > 0;
	const canOpen = !!state?.canManage && !state.enabled && state.available;
	const linkReady = snapshot.link === "ready";
	const supportingId = useId();
	const peerIssue = member !== null && peerFailed > 0;
	const peerPending =
		member !== null &&
		peerFailed === 0 &&
		peerConnecting > 0 &&
		peerConnected === 0;

	let supporting: string;
	let reason: string | null = null;
	if (member) {
		if (!member.canSpeak) {
			reason = t(
				member.muted
					? "voice.mutedHint"
					: member.role === "ob"
						? "voice.listenHintObserver"
						: "voice.listenHint",
			);
		}
		if (playbackMuted) {
			// While paused nobody is audible, so "nobody is speaking" would lie.
			supporting = t("voice.playbackPausedHint");
		} else if (speaking) {
			supporting = t("voice.speakingSummary", {
				names: activeSpeakers.map((item) => item.name).join("、"),
			});
		} else if (peerFailed > 0) {
			supporting = t("voice.peersFailed", { count: peerFailed });
		} else if (peerConnecting > 0) {
			supporting = t("voice.peersConnecting", { count: peerConnecting });
		} else {
			supporting = t("voice.nobodySpeaking");
		}
	} else if (!linkReady) {
		supporting = t("voice.linkWaitHint");
	} else if (!state?.available) {
		supporting = t("voice.unavailableHint");
	} else if (state.enabled && roomFull) {
		supporting = t("voice.fullHint");
	} else if (state.enabled) {
		supporting = t("voice.roomOpenHint");
	} else {
		supporting = t(
			state?.canManage ? "voice.roomClosedHint" : "voice.roomClosedWaitHint",
		);
	}

	return (
		<section
			aria-label={t("voice.currentSection")}
			className={cn(
				"relative flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl p-4 transition-colors",
				peerIssue
					? "bg-warning-soft/20 ring-1 ring-inset ring-warning/45"
					: peerPending
						? "bg-md-surface-container-high/80 ring-1 ring-inset ring-md-outline-variant/60"
						: member
							? "bg-md-primary-container/25 ring-1 ring-inset ring-md-primary/30"
							: "bg-md-surface-container-low",
			)}
		>
			<div
				className={cn(
					"flex min-w-56 flex-1 items-center gap-3.5",
					member && "pr-12 @2xl:pr-0",
				)}
			>
				<span
					className={cn(
						"grid size-12 shrink-0 place-items-center rounded-full transition-colors",
						speaking
							? "bg-md-primary text-md-on-primary"
							: peerIssue
								? "bg-warning-soft text-warning-soft-foreground"
								: peerPending
									? "bg-md-surface-container-highest text-md-on-surface"
									: member
										? "bg-md-primary-container text-md-on-primary-container"
										: "bg-md-surface-container-highest text-md-on-surface-variant",
					)}
				>
					{speaking ? (
						<AudioLines
							className="size-6 motion-safe:animate-pulse"
							aria-hidden="true"
						/>
					) : (
						<Headphones className="size-6" aria-hidden="true" />
					)}
				</span>
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<div role="status" className="flex flex-wrap items-baseline gap-x-2">
						<span className="text-md-on-surface text-title-medium-emph">
							{t(status)}
						</span>
						{state ? (
							<span className="text-md-on-surface-variant text-label-medium tabular-nums">
								{t("voice.count", {
									count: state.memberCount,
									limit: state.limit,
								})}
							</span>
						) : null}
						{member && playbackMuted ? (
							<Badge variant="soft" tone="warning" size="sm">
								<VolumeX className="size-3" aria-hidden="true" />
								{t("voice.playbackPausedBadge")}
							</Badge>
						) : null}
						{member && micTransmitting(snapshot) ? (
							<Badge variant="soft" tone="accent" size="sm">
								<Mic className="size-3" aria-hidden="true" />
								{t("voice.micLive")}
							</Badge>
						) : member && mic === "on" ? (
							<Badge variant="soft" tone="warning" size="sm">
								<Mic className="size-3" aria-hidden="true" />
								{t("voice.pttArmed")}
							</Badge>
						) : null}
					</div>
					<p className="text-md-on-surface-variant text-body-small">
						{supporting}
					</p>
					{reason ? (
						<p id={supportingId} className="text-md-tertiary text-body-small">
							{reason}
						</p>
					) : null}
				</div>
			</div>

			{member ? (
				<div className="flex w-full items-center gap-2 @2xl:w-auto">
					<Button
						type="button"
						variant={
							audioSettings.pushToTalk
								? "tertiary"
								: micTransmitting(snapshot)
									? "primary"
									: "tonal"
						}
						size="sm"
						className="min-w-0 flex-1 px-2 @2xl:flex-none @2xl:px-4"
						disabled={!member.canSpeak}
						aria-describedby={member.canSpeak ? undefined : supportingId}
						onClick={(event) => {
							void voice.toggleMic();
							// A focused button swallows the push-to-talk hotkey (Space).
							if (audioSettings.pushToTalk) event.currentTarget.blur();
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
						variant={playbackMuted ? "tonal" : "tertiary"}
						size="sm"
						className="min-w-0 flex-1 px-2 @2xl:flex-none @2xl:px-4"
						onClick={(event) => {
							voice.togglePlayback();
							if (audioSettings.pushToTalk) event.currentTarget.blur();
						}}
					>
						<PlaybackIcon data-icon="inline-start" />
						{t(playbackMuted ? "voice.playbackOn" : "voice.playbackOff")}
					</Button>
				</div>
			) : state?.enabled && state.available ? (
				<Button
					type="button"
					variant="primary"
					size="sm"
					className="w-full @2xl:w-auto"
					disabled={roomFull || pending !== null || !linkReady}
					onClick={() => voice.join()}
				>
					{t("voice.join")}
				</Button>
			) : canOpen ? (
				<div className="flex w-full flex-wrap items-center justify-between gap-3 @2xl:w-auto">
					<VoiceLimitSelect voice={voice} snapshot={snapshot} />
					<Button
						type="button"
						variant="primary"
						size="sm"
						className="w-full @2xl:w-auto"
						disabled={pending !== null || !linkReady}
						onClick={() => voice.configure({ enabled: true })}
					>
						{t("voice.openRoom")}
					</Button>
				</div>
			) : null}
			{member ? (
				<div className="absolute top-3 right-3 @2xl:static">
					<IconButton
						type="button"
						variant="tertiary"
						size="sm"
						className="text-danger"
						aria-label={t("voice.leave")}
						title={t("voice.leave")}
						onClick={() => voice.leave()}
					>
						<PhoneOff />
					</IconButton>
				</div>
			) : null}
			{member?.canSpeak && audioSettings.pushToTalk ? (
				<div className="basis-full">
					<PushToTalkButton voice={voice} snapshot={snapshot} />
				</div>
			) : null}
		</section>
	);
}

function VoiceMembersView({
	voice,
	snapshot,
	activeSpeakers,
}: {
	voice: VoiceController;
	snapshot: VoiceSnapshot;
	activeSpeakers: VoiceMember[];
}) {
	const { state, member, pending, memberVolumes, peerStates } = snapshot;
	const hasMembers = !!state && state.members.length > 0;

	return (
		<div className="flex min-w-0 flex-col gap-4">
			<VoiceRoomSettings voice={voice} snapshot={snapshot} />
			{hasMembers ? (
				<ul
					aria-label={t("voice.members")}
					className="flex min-w-0 flex-col gap-2"
				>
					{state.members.map((item) => (
						<VoiceMemberCard
							key={item.id}
							item={item}
							isSelf={member?.id === item.id}
							joined={member !== null}
							speaking={activeSpeakers.some((s) => s.id === item.id)}
							peerHealth={peerStates?.[item.id]}
							volume={memberVolumes[item.id] ?? 100}
							manage={state.canManage}
							busy={pending !== null}
							voice={voice}
						/>
					))}
				</ul>
			) : snapshot.link !== "ready" ? null : (
				<div className="bg-md-surface-container-low flex flex-col items-center gap-2 rounded-xl px-6 py-8 text-center">
					<Headphones
						className="text-md-on-surface-variant size-7"
						strokeWidth={1.5}
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
		</div>
	);
}

type VoiceView = "members" | "settings";

export function VoicePanelBody({
	voice,
	snapshot,
}: {
	voice: VoiceController;
	snapshot: VoiceSnapshot;
}) {
	// A closed, empty room has no members to show; start where the user can
	// still do something useful (set up the mic) unless they run the room.
	const [view, setView] = useState<VoiceView>(() =>
		snapshot.state &&
		!snapshot.state.enabled &&
		!snapshot.state.canManage &&
		!snapshot.member
			? "settings"
			: "members",
	);
	useEffect(() => {
		return () => {
			voice.stopMicTest();
		};
	}, [voice]);
	// Leaving the settings view unmounts the mic test card: release the mic.
	useEffect(() => {
		if (view !== "settings") voice.stopMicTest();
	}, [view, voice]);
	const { state, mic, playbackBlocked, peerFailed, error } = snapshot;
	const activeSpeakers = (state?.members ?? []).filter((item) =>
		isVoiceMemberSpeaking(snapshot, item),
	);

	return (
		<div className="@container flex min-w-0 flex-col gap-4">
			<VoiceHero
				voice={voice}
				snapshot={snapshot}
				activeSpeakers={activeSpeakers}
			/>

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
			{mic === "on" && snapshot.micSuspended ? (
				<Alert variant="warning">
					<AlertContent>
						<AlertDescription role="status">
							{t("voice.mic.suspended")}
						</AlertDescription>
					</AlertContent>
					<Button
						type="button"
						variant="tertiary"
						size="sm"
						onClick={() => voice.resumeMic()}
					>
						{t("voice.mic.resume")}
					</Button>
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
						size="sm"
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
					<Button
						type="button"
						variant="tertiary"
						size="sm"
						onClick={() => voice.reconnect()}
					>
						<RefreshCw data-icon="inline-start" />
						{t("voice.reconnect")}
					</Button>
				</Alert>
			) : null}

			<Tabs
				value={view}
				onValueChange={(next) => setView(next as VoiceView)}
				className="gap-4"
			>
				<TabsList
					aria-label={t("voice.tab.label")}
					className="w-full @2xl:w-72"
				>
					<TabsTrigger value="members">
						{state?.members.length
							? t("voice.tab.membersCount", { count: state.members.length })
							: t("voice.tab.members")}
					</TabsTrigger>
					<TabsTrigger value="settings">{t("voice.tab.settings")}</TabsTrigger>
				</TabsList>
				<TabsContent value="members" tabIndex={-1}>
					<VoiceMembersView
						voice={voice}
						snapshot={snapshot}
						activeSpeakers={activeSpeakers}
					/>
				</TabsContent>
				<TabsContent
					value="settings"
					tabIndex={-1}
					className="flex flex-col gap-4"
				>
					<VoiceAudioSettingsSection voice={voice} snapshot={snapshot} />
					<VoiceMoreSection voice={voice} snapshot={snapshot} />
				</TabsContent>
			</Tabs>
		</div>
	);
}
