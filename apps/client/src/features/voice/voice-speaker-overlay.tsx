import type { VoiceMember } from "@cogm/shared";
import {
	AudioLines,
	GripHorizontal,
	Headphones,
	Mic,
	MicOff,
	Volume2,
	X,
} from "lucide-react";
import {
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import {
	isVoiceMemberSpeaking,
	type VoiceController,
	type VoiceSnapshot,
} from "./voice-controller";
import { SpeakerVolumeControl, VoiceStatusDot } from "./voice-panel";

const VIEWPORT_MARGIN = 8;

function clampPosition(
	x: number,
	y: number,
	width: number,
	height: number,
): { x: number; y: number } {
	const maxX = Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN);
	const maxY = Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN);
	return {
		x: Math.min(maxX, Math.max(VIEWPORT_MARGIN, Math.round(x))),
		y: Math.min(maxY, Math.max(VIEWPORT_MARGIN, Math.round(y))),
	};
}

function SpeakerVolumeRow({
	item,
	speaking,
	volume,
	voice,
}: {
	item: VoiceMember;
	speaking: boolean;
	volume: number;
	voice: VoiceController;
}) {
	return (
		<li
			className={cn(
				"flex flex-col gap-1.5 rounded-xl px-2.5 py-2 transition-[background-color,box-shadow] duration-150 ease-standard-fast-effects",
				speaking
					? "bg-md-primary-container/35 ring-1 ring-md-primary/60"
					: "bg-md-surface-container/70",
			)}
		>
			<div className="flex min-w-0 items-center gap-2">
				<VoiceStatusDot
					speaking={speaking}
					canSpeak={item.canSpeak}
					className="size-2"
				/>
				<span
					className="text-md-on-surface min-w-0 flex-1 truncate text-label-large"
					title={item.name}
				>
					{item.name}
				</span>
				<Badge variant="soft" size="sm">
					{t(`voice.role.${item.role}`)}
				</Badge>
				{!item.canSpeak ? (
					<Badge variant="tertiary" size="sm">
						{t(item.muted ? "voice.moderatorMuted" : "voice.listenOnly")}
					</Badge>
				) : null}
			</div>
			<SpeakerVolumeControl
				member={item}
				volume={volume}
				voice={voice}
				compact
			/>
		</li>
	);
}

function SpeakerPopupContent({
	voice,
	snapshot,
}: {
	voice: VoiceController;
	snapshot: VoiceSnapshot;
}) {
	const { state, member, playbackMuted, playbackBlocked, memberVolumes } =
		snapshot;
	if (!state || !member) return null;

	const members = state.members;
	const activeSpeakers = members.filter((item) =>
		isVoiceMemberSpeaking(snapshot, item),
	);
	const remoteMembers = members.filter((item) => item.id !== member.id);

	return (
		<div className="flex min-w-0 flex-col gap-3">
			<div
				className={cn(
					"flex flex-col gap-2 rounded-xl p-2.5",
					activeSpeakers.length > 0
						? "bg-md-primary-container/40"
						: "bg-md-surface-container/75",
				)}
			>
				<div className="flex items-center gap-2">
					<AudioLines
						className={cn(
							"size-4 shrink-0",
							activeSpeakers.length > 0
								? "text-md-primary animate-pulse"
								: "text-md-on-surface-variant",
						)}
						aria-hidden="true"
					/>
					<span className="text-md-on-surface-variant text-label-medium">
						{activeSpeakers.length > 0
							? t("voice.speakingNow")
							: t("voice.nobodySpeaking")}
					</span>
				</div>
				{activeSpeakers.length > 0 ? (
					<div className="flex flex-wrap gap-1.5">
						{activeSpeakers.map((speaker) => (
							<span
								key={speaker.id}
								className="bg-md-primary-container text-md-on-primary-container inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-label-medium-emph"
							>
								<span
									aria-hidden="true"
									className="bg-md-primary size-2 shrink-0 animate-pulse rounded-full"
								/>
								<span className="truncate">{speaker.name}</span>
								<span className="opacity-75 text-label-small">
									{speaker.id === member.id
										? t("voice.self")
										: t(`voice.role.${speaker.role}`)}
								</span>
							</span>
						))}
					</div>
				) : null}
			</div>

			{playbackMuted ? (
				<Button
					type="button"
					variant="dangerSoft"
					size="sm"
					className="min-h-9 w-full"
					onClick={() => voice.togglePlayback()}
				>
					<Volume2 data-icon="inline-start" />
					{t("voice.playbackOn")}
				</Button>
			) : null}

			{playbackBlocked ? (
				<Button
					type="button"
					variant="tertiary"
					size="sm"
					className="bg-md-surface-container-highest min-h-9 w-full"
					onClick={() => voice.retryPlayback()}
				>
					{t("voice.retryPlayback")}
				</Button>
			) : null}

			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between gap-2 px-0.5">
					<span className="text-md-on-surface-variant text-label-medium">
						{t("voice.speakerVolume")}
					</span>
					<span className="text-md-on-surface-variant font-mono text-label-small tabular-nums">
						{remoteMembers.length}
					</span>
				</div>
				{remoteMembers.length > 0 ? (
					<ul
						aria-label={t("voice.speakerVolume")}
						className="flex max-h-[min(42dvh,280px)] flex-col gap-1.5 overflow-y-auto pr-0.5"
					>
						{remoteMembers.map((item) => (
							<SpeakerVolumeRow
								key={item.id}
								item={item}
								speaking={isVoiceMemberSpeaking(snapshot, item)}
								volume={memberVolumes[item.id] ?? 100}
								voice={voice}
							/>
						))}
					</ul>
				) : (
					<p className="text-md-on-surface-variant bg-md-surface-container/60 rounded-xl px-3 py-2.5 text-body-small">
						{t("voice.noOtherSpeakers")}
					</p>
				)}
			</div>
		</div>
	);
}

export function VoiceSpeakerOverlay({
	voice,
	panelOpen = false,
	placement = "player",
	compact = false,
}: {
	voice: VoiceController;
	panelOpen?: boolean;
	placement?: "gm" | "player";
	compact?: boolean;
}) {
	const snapshot = useSyncExternalStore(voice.subscribe, voice.getSnapshot);
	const { state, member, mic, speakerPopupOpen } = snapshot;
	const [compactOpen, setCompactOpen] = useState(false);
	const [position, setPosition] = useState<{ x: number; y: number } | null>(
		null,
	);
	const cardRef = useRef<HTMLElement | null>(null);
	const dragRef = useRef<{
		dx: number;
		dy: number;
		width: number;
		height: number;
	} | null>(null);

	useEffect(() => {
		if (!member) {
			setCompactOpen(false);
			setPosition(null);
		}
	}, [member]);

	useEffect(() => {
		if (!position) return;
		function onResize() {
			const rect = cardRef.current?.getBoundingClientRect();
			if (!rect) return;
			setPosition((current) =>
				current
					? clampPosition(current.x, current.y, rect.width, rect.height)
					: null,
			);
		}
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, [position]);

	useEffect(() => {
		function onMove(event: PointerEvent) {
			const drag = dragRef.current;
			if (!drag) return;
			setPosition(
				clampPosition(
					event.clientX - drag.dx,
					event.clientY - drag.dy,
					drag.width,
					drag.height,
				),
			);
		}
		function onUp() {
			dragRef.current = null;
		}
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onUp);
		return () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("pointercancel", onUp);
		};
	}, []);

	if (!state || !member || panelOpen) {
		return null;
	}

	const activeSpeakers = state.members.filter((item) =>
		isVoiceMemberSpeaking(snapshot, item),
	);
	const MicIcon = mic === "on" ? Mic : MicOff;
	const pillLabel =
		activeSpeakers.length > 0
			? t("voice.speakingSummary", {
					names: activeSpeakers.map((item) => item.name).join("、"),
				})
			: t("voice.compactPill", { count: state.memberCount });

	const defaultAnchorClass =
		placement === "gm"
			? "top-26 right-[calc(clamp(248px,20vw,292px)+40px)] max-xl:top-40"
			: compact
				? "top-14 left-3"
				: "top-42 left-6";

	if (compact) {
		return (
			<>
				{typeof document !== "undefined"
					? createPortal(
							<button
								type="button"
								onClick={() => setCompactOpen(true)}
								aria-label={t("voice.openSpeakerPopup")}
								className={cn(
									"stage-glass shadow-card fixed z-30 flex max-w-[min(240px,calc(100vw-24px))] items-center gap-2 rounded-full px-3 py-1.5 text-label-medium transition-colors hover:bg-md-surface-container-high",
									defaultAnchorClass,
									activeSpeakers.length > 0
										? "text-md-on-primary-container ring-1 ring-md-primary/60"
										: "text-md-on-surface",
								)}
							>
								<span
									aria-hidden="true"
									className={cn(
										"size-2 shrink-0 rounded-full",
										activeSpeakers.length > 0
											? "bg-md-primary animate-pulse"
											: "bg-md-primary/60",
									)}
								/>
								<span className="truncate">{pillLabel}</span>
							</button>,
							document.body,
						)
					: null}
				<Dialog open={compactOpen} onOpenChange={setCompactOpen}>
					<DialogContent className="max-h-[calc(100dvh-2rem)] max-w-sm overflow-y-auto">
						<DialogHeader>
							<DialogTitle>{t("voice.speakerPopupTitle")}</DialogTitle>
							<DialogDescription>
								{t("voice.speakerPopupDescription")}
							</DialogDescription>
						</DialogHeader>
						<SpeakerPopupContent voice={voice} snapshot={snapshot} />
					</DialogContent>
				</Dialog>
			</>
		);
	}

	if (typeof document === "undefined") {
		return null;
	}

	function handleHeaderPointerDown(event: ReactPointerEvent<HTMLElement>) {
		if (event.button !== 0) return;
		const target = event.target;
		if (
			target instanceof HTMLElement &&
			target.closest("button, [role='slider']")
		) {
			return;
		}
		const rect = cardRef.current?.getBoundingClientRect();
		if (!rect) return;
		dragRef.current = {
			dx: event.clientX - rect.left,
			dy: event.clientY - rect.top,
			width: rect.width,
			height: rect.height,
		};
	}

	const overlayNode = speakerPopupOpen ? (
		<section
			ref={cardRef}
			aria-label={t("voice.speakerPopupTitle")}
			style={position ? { left: position.x, top: position.y } : undefined}
			className={cn(
				"stage-glass shadow-overlay animate-in fade-in fixed z-[25] flex w-[312px] max-w-[calc(100vw-24px)] flex-col gap-3 rounded-xl p-3.5 duration-200 ease-standard-fast-effects",
				!position && defaultAnchorClass,
			)}
		>
			<header
				onPointerDown={handleHeaderPointerDown}
				className="flex cursor-grab items-center justify-between gap-2 select-none active:cursor-grabbing"
			>
				<div className="flex min-w-0 flex-1 items-center gap-2">
					<GripHorizontal
						className="text-md-on-surface-variant size-4 shrink-0"
						aria-hidden="true"
					/>
					<span
						aria-hidden="true"
						className={cn(
							"size-2 shrink-0 rounded-full",
							activeSpeakers.length > 0
								? "bg-md-primary animate-pulse"
								: "bg-md-primary/65",
						)}
					/>
					<h2 className="text-md-on-surface truncate font-sans text-title-small-emph">
						{t("voice.speakerPopupTitle")}
					</h2>
					<span className="text-md-on-surface-variant font-mono text-label-small tabular-nums">
						{state.memberCount}
					</span>
				</div>
				<div className="flex shrink-0 items-center gap-1">
					<Button
						type="button"
						variant={mic === "on" ? "primary" : "ghost"}
						size="icon-sm"
						className="size-8 rounded-full"
						disabled={!member.canSpeak}
						aria-label={t(
							mic === "on"
								? "voice.micOff"
								: mic === "requesting"
									? "voice.micCancel"
									: "voice.micOn",
						)}
						onClick={() => {
							void voice.toggleMic();
						}}
					>
						<MicIcon className="size-4" aria-hidden="true" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="text-md-on-surface-variant size-8 rounded-full"
						aria-label={t("voice.minimizeSpeakerPopup")}
						onClick={() => voice.setSpeakerPopupOpen(false)}
					>
						<X className="size-4" aria-hidden="true" />
					</Button>
				</div>
			</header>
			<SpeakerPopupContent voice={voice} snapshot={snapshot} />
		</section>
	) : (
		<button
			type="button"
			style={position ? { left: position.x, top: position.y } : undefined}
			aria-label={t("voice.openSpeakerPopup")}
			onClick={() => voice.setSpeakerPopupOpen(true)}
			className={cn(
				"stage-glass shadow-card fixed z-[25] flex max-w-[min(280px,calc(100vw-24px))] items-center gap-2 rounded-full px-3.5 py-2 text-label-medium transition-colors hover:bg-md-surface-container-high",
				!position && defaultAnchorClass,
				activeSpeakers.length > 0
					? "text-md-on-surface ring-1 ring-md-primary/60"
					: "text-md-on-surface-variant",
			)}
		>
			{activeSpeakers.length > 0 ? (
				<AudioLines
					className="text-md-primary size-4 shrink-0 animate-pulse"
					aria-hidden="true"
				/>
			) : (
				<Headphones className="size-4 shrink-0" aria-hidden="true" />
			)}
			<span className="truncate">{pillLabel}</span>
		</button>
	);

	return createPortal(overlayNode, document.body);
}
