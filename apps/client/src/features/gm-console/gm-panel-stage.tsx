import type { ChatMessageDto, SessionPhase } from "@cogm/shared";
import { useParams } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
	ArrowUpRight,
	Ban,
	Check,
	ChevronRight,
	ChevronsUpDown,
	ChevronUp,
	Clapperboard,
	GripVertical,
	HeartPulse,
	Inbox,
	MessagesSquare,
	Music2,
	Pause,
	Play,
	Speech,
	Theater,
	Volume2,
	X,
} from "lucide-react";
import type { DragEvent, KeyboardEvent } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n";
import { sessionPhaseLabel } from "@/i18n/labels";
import { api } from "@/lib/api";
import {
	speakerInitialsOf,
	speakerNameOf,
	speakerRoleLabelOf,
} from "@/lib/chat-map";
import { errorText } from "@/lib/errors";
import { expressionLabel, formatDurationMmSs } from "@/lib/format";
import { sendSessionCommand } from "@/lib/session-socket";
import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";
import { useBgmPlayback } from "./gm-audio";
import {
	hpLine,
	isCritical,
	orderBySeverity,
	stateEntries,
	statusLine,
} from "./gm-state";
import { gmFloatingCard } from "./gm-styles";
import { useGmTool } from "./gm-tool-context";

const SESSION_PHASES: Array<{ key: SessionPhase; icon: LucideIcon }> = [
	{ key: "free_discussion", icon: MessagesSquare },
	{ key: "performance_time", icon: Theater },
	{ key: "forced_cg", icon: Clapperboard },
	{ key: "free_performance", icon: Speech },
];

function queueContext(item: ChatMessageDto): string {
	if (item.channel === "ooc") {
		return `${speakerRoleLabelOf(item)} · ${t("gm.workbench.releaseToChat")}`;
	}
	return `${t("gm.workbench.roleplay")} · ${expressionLabel(item.expressionKey)}`;
}

function PhaseCard() {
	const { sessionId } = useParams({ from: "/gm/session/$sessionId" });
	const active = usePlayStore((state) => state.phase);
	const [open, setOpen] = useState(false);

	function changePhase(phase: SessionPhase) {
		setOpen(false);
		void api(`/gm/sessions/${encodeURIComponent(sessionId)}/phase`, {
			method: "POST",
			body: JSON.stringify({ phase }),
		}).catch((error) =>
			toast.error(errorText(error, "play.phaseUpdateFailed")),
		);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						gmFloatingCard,
						"text-md-on-surface focus-visible:ring-focus-ring/50 flex min-h-32 shrink-0 flex-col gap-2 rounded-xl p-4 text-left outline-none transition-[background-color,border-color,box-shadow] duration-200 ease-standard-fast-effects focus-visible:ring-4 2xl:min-h-36 2xl:gap-2.5 2xl:p-5",
					)}
				>
					<span className="flex w-full items-center justify-between gap-2">
						<span className="text-md-on-surface-variant text-label-medium">
							{t("gm.console.phaseTitle")}
						</span>
						{open ? (
							<ChevronUp className="text-md-on-surface-variant size-5" />
						) : (
							<ChevronsUpDown className="text-md-on-surface-variant size-5" />
						)}
					</span>
					<span className="text-md-primary font-serif text-headline-small leading-[1.05] font-semibold 2xl:text-headline-medium">
						{active ? sessionPhaseLabel(active) : "—"}
					</span>
					<span className="text-md-on-surface-variant text-label-large">
						{active
							? t(`gm.workbench.phaseSummary.${active}`)
							: t("gm.workbench.phaseUnset")}
					</span>
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				side="bottom"
				sideOffset={12}
				className="bg-md-surface-container-high shadow-overlay w-[380px] rounded-xl p-3"
			>
				<div className="flex h-11 items-center justify-between gap-3 px-3">
					<span className="text-md-on-surface text-title-small-emph">
						{t("gm.workbench.switchPhase")}
					</span>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="size-8"
						aria-label={t("common.close")}
						onClick={() => setOpen(false)}
					>
						<X className="size-4" />
					</Button>
				</div>
				<div className="flex flex-col gap-1">
					{SESSION_PHASES.map((phase) => {
						const selected = phase.key === active;
						return (
							<button
								key={phase.key}
								type="button"
								aria-current={selected ? "true" : undefined}
								onClick={() => changePhase(phase.key)}
								className={cn(
									"flex h-22 w-full items-center gap-3.5 rounded-lg-inc p-3 px-4 text-left outline-none transition-colors duration-200 ease-standard-fast-effects focus-visible:ring-4 focus-visible:ring-focus-ring/50",
									selected
										? "bg-md-primary-container text-md-on-primary-container"
										: "text-md-on-surface hover:bg-md-on-surface/8",
								)}
							>
								<phase.icon className="size-6 shrink-0" />
								<span className="flex min-w-0 flex-1 flex-col gap-1">
									<span className="text-title-medium-emph">
										{sessionPhaseLabel(phase.key)}
									</span>
									<span
										className={cn(
											"text-label-medium",
											selected
												? "text-md-on-primary-container"
												: "text-md-on-surface-variant",
										)}
									>
										{t(`gm.workbench.phaseDetail.${phase.key}`)}
									</span>
								</span>
								{selected ? (
									<Check className="size-5 shrink-0" />
								) : (
									<span
										aria-hidden
										className="border-md-outline-variant size-4 shrink-0 rounded-full border-2"
									/>
								)}
							</button>
						);
					})}
				</div>
			</PopoverContent>
		</Popover>
	);
}

type QueueDragHandlers = {
	draggable: boolean;
	dragging: boolean;
	over: boolean;
	onDragStart: () => void;
	onDragEnd: () => void;
	onDragOver: (event: DragEvent<HTMLDivElement>) => void;
	onDragLeave: () => void;
	onDrop: () => void;
};

function QueueRow({
	item,
	expanded,
	onToggle,
	onReorder,
	disabled = false,
	drag,
}: {
	item: ChatMessageDto;
	expanded: boolean;
	onToggle: () => void;
	onReorder: (direction: -1 | 1) => void;
	disabled?: boolean;
	drag?: QueueDragHandlers;
}) {
	const name = speakerNameOf(item);
	const context = queueContext(item);
	const [rejectOpen, setRejectOpen] = useState(false);
	const [reason, setReason] = useState("");

	function onGripKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
		if (!event.altKey) {
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			onReorder(-1);
		}
		if (event.key === "ArrowDown") {
			event.preventDefault();
			onReorder(1);
		}
	}

	const dragProps = drag
		? {
				draggable: drag.draggable,
				onDragStart: drag.onDragStart,
				onDragEnd: drag.onDragEnd,
				onDragOver: drag.onDragOver,
				onDragLeave: drag.onDragLeave,
				onDrop: drag.onDrop,
			}
		: {};

	if (!expanded) {
		return (
			<div
				{...dragProps}
				className={cn(
					"shrink-0 transition-opacity duration-150",
					drag?.dragging && "opacity-40",
				)}
			>
				<button
					type="button"
					onClick={onToggle}
					disabled={disabled}
					className="hover:bg-md-on-surface/8 flex h-13 w-full items-center gap-2.5 rounded-lg px-2 text-left outline-none transition-colors duration-150 ease-standard-fast-effects focus-visible:ring-4 focus-visible:ring-focus-ring/50 disabled:opacity-50"
				>
					<Avatar size="sm" className="bg-md-surface-container-high size-8">
						<AvatarFallback className="text-md-on-surface text-label-medium">
							{speakerInitialsOf(item)}
						</AvatarFallback>
					</Avatar>
					<span className="flex min-w-0 flex-1 flex-col">
						<span className="text-md-on-surface truncate text-label-large-emph">
							{name}
						</span>
						<span className="text-md-on-surface-variant truncate text-label-small">
							{context}
						</span>
					</span>
					<ChevronRight className="text-md-on-surface-variant size-4 shrink-0" />
				</button>
			</div>
		);
	}

	return (
		<div
			{...dragProps}
			data-queue-row={item.id}
			className={cn(
				"bg-md-surface-container-high border border-md-outline-variant/50 flex shrink-0 flex-col gap-2.5 rounded-3xl p-4 transition-opacity duration-150",
				drag?.dragging && "opacity-40",
				drag?.over && "ring-2 ring-md-primary",
			)}
		>
			<div className="flex items-center gap-2.5">
				<Avatar size="sm" className="bg-md-primary-container size-8">
					<AvatarFallback className="text-md-on-primary-container text-label-medium">
						{speakerInitialsOf(item)}
					</AvatarFallback>
				</Avatar>
				<span className="flex min-w-0 flex-1 flex-col">
					<span className="text-md-on-surface truncate text-label-large-emph">
						{name}
					</span>
					<span className="text-md-on-surface-variant truncate text-label-small">
						{context}
					</span>
				</span>
				<button
					type="button"
					aria-label={t("gm.workbench.reorderAria", { name })}
					title={t("gm.workbench.reorderHint")}
					onKeyDown={onGripKeyDown}
					className="text-md-on-surface-variant hover:bg-md-on-surface/8 grid size-7 shrink-0 cursor-grab place-items-center rounded-full outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/50 active:cursor-grabbing"
				>
					<GripVertical className="size-4" />
				</button>
			</div>
			<p className="text-md-on-surface-variant whitespace-pre-wrap break-words text-body-medium">
				{item.content}
			</p>
			<div className="flex items-center gap-2">
				<Button
					type="button"
					variant="primary"
					size="sm"
					className="h-12 flex-1"
					disabled={disabled}
					aria-label={t("gm.console.queueReleaseAria", { name })}
					onClick={() =>
						sendSessionCommand("chat:release", { messageId: item.id })
					}
				>
					<Play className="size-4" />
					{t("gm.workbench.releaseLine")}
				</Button>
				<Button
					type="button"
					variant="tertiary"
					size="icon-sm"
					className="bg-md-surface-container size-10 shrink-0"
					disabled={disabled}
					aria-label={t("gm.console.queueDiscardAria", { name })}
					title={t("gm.workbench.discardLine")}
					onClick={() => {
						setReason("");
						setRejectOpen(true);
					}}
				>
					<Ban className="size-4" />
				</Button>
			</div>
			<Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>{t("gm.console.rejectTitle")}</DialogTitle>
						<DialogDescription>
							{t("gm.console.rejectDescription")}
						</DialogDescription>
					</DialogHeader>
					<div className="bg-md-surface-container-high flex flex-col gap-1 rounded-lg px-3 py-2">
						<span className="text-md-on-surface-variant text-label-small">
							{name}
						</span>
						<p className="text-md-on-surface text-body-medium whitespace-pre-wrap break-words">
							{item.content}
						</p>
					</div>
					<Textarea
						value={reason}
						onChange={(event) => setReason(event.target.value)}
						placeholder={t("gm.console.rejectReasonPlaceholder")}
						aria-label={t("gm.console.rejectReasonPlaceholder")}
						rows={3}
						maxLength={500}
					/>
					<div className="flex items-center justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => setRejectOpen(false)}
						>
							{t("common.cancel")}
						</Button>
						<Button
							type="button"
							variant="danger"
							onClick={() => {
								const sent = sendSessionCommand("chat:discard", {
									messageId: item.id,
									...(reason.trim() ? { reason: reason.trim() } : {}),
								});
								if (!sent) {
									toast.error(t("chat.notConnected"));
									return;
								}
								setRejectOpen(false);
							}}
						>
							{t("gm.console.rejectConfirm")}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function QueueCard({ className }: { className?: string }) {
	const pending = usePlayStore((state) => state.pendingQueue);
	const discarded = usePlayStore((state) => state.discardedQueue);
	const ended = usePlayStore((state) => state.status === "ended");
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [showDiscarded, setShowDiscarded] = useState(false);
	const [dragId, setDragId] = useState<string | null>(null);
	const [overId, setOverId] = useState<string | null>(null);
	const currentExpanded =
		pending.find((item) => item.id === expandedId)?.id ??
		pending[0]?.id ??
		null;

	function reorder(index: number, direction: -1 | 1) {
		const ids = pending.map((entry) => entry.id);
		const target = index + direction;
		const current = ids[index];
		const swap = ids[target];
		if (current === undefined || swap === undefined) {
			return;
		}
		const next = [...ids];
		next[index] = swap;
		next[target] = current;
		sendSessionCommand("chat:reorder", { messageIds: next });
	}

	function move(sourceId: string, targetId: string) {
		if (sourceId === targetId) {
			return;
		}
		const ids = pending.map((entry) => entry.id);
		const from = ids.indexOf(sourceId);
		const to = ids.indexOf(targetId);
		if (from < 0 || to < 0) {
			return;
		}
		const next = [...ids];
		next.splice(from, 1);
		next.splice(from < to ? to - 1 : to, 0, sourceId);
		sendSessionCommand("chat:reorder", { messageIds: next });
	}

	function dragHandlers(item: ChatMessageDto): QueueDragHandlers {
		return {
			draggable: !ended && pending.length > 1,
			dragging: dragId === item.id,
			over: overId === item.id && dragId !== item.id,
			onDragStart: () => setDragId(item.id),
			onDragEnd: () => {
				setDragId(null);
				setOverId(null);
			},
			onDragOver: (event) => {
				if (!dragId || dragId === item.id) {
					return;
				}
				event.preventDefault();
				setOverId(item.id);
			},
			onDragLeave: () => {
				setOverId((current) => (current === item.id ? null : current));
			},
			onDrop: () => {
				if (dragId) {
					move(dragId, item.id);
				}
				setDragId(null);
				setOverId(null);
			},
		};
	}

	return (
		<div
			className={cn(
				gmFloatingCard,
				"flex min-h-0 shrink-0 flex-col gap-2.5 overflow-hidden rounded-xl p-3 2xl:gap-3 2xl:p-3.5",
				className,
			)}
		>
			<div className="flex shrink-0 items-center justify-between gap-3">
				<span className="text-md-on-surface text-label-large-emph">
					{t("gm.workbench.queueTitle")}
				</span>
				<span className="text-md-on-surface-variant text-label-medium">
					{t("gm.workbench.queueCount", { count: pending.length })}
				</span>
			</div>
			{pending.length === 0 && discarded.length === 0 ? (
				<div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-3 text-center 2xl:py-5">
					<Inbox className="text-md-on-surface-variant/45 size-6" />
					<p className="text-md-on-surface-variant text-label-medium">
						{t("gm.workbench.queueEmptyTitle")}
					</p>
					<p className="text-md-on-surface-variant/75 hidden text-label-small 2xl:block">
						{t("gm.workbench.queueEmptyHint")}
					</p>
				</div>
			) : null}
			<div
				className={cn(
					"flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5",
					pending.length === 0 && discarded.length === 0 && "hidden",
				)}
			>
				{pending.map((item, index) => (
					<QueueRow
						key={item.id}
						item={item}
						expanded={item.id === currentExpanded}
						disabled={ended}
						drag={dragHandlers(item)}
						onToggle={() =>
							setExpandedId(item.id === currentExpanded ? null : item.id)
						}
						onReorder={(direction) => reorder(index, direction)}
					/>
				))}
				{discarded.length > 0 ? (
					<div className="mt-1 flex shrink-0 flex-col gap-1.5 border-t border-separator-secondary pt-2">
						<button
							type="button"
							onClick={() => setShowDiscarded((value) => !value)}
							className="text-md-on-surface-variant hover:bg-md-on-surface/8 flex h-8 items-center justify-between rounded-lg px-1 text-label-medium outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/50"
						>
							<span>
								{t("gm.console.discardedCount", { count: discarded.length })}
							</span>
							<ChevronRight
								className={cn(
									"size-4 transition-transform",
									showDiscarded && "rotate-90",
								)}
							/>
						</button>
						{showDiscarded
							? discarded.map((item) => (
									<div key={item.id} className="flex flex-col gap-1">
										<div className="flex items-center gap-1.5">
											<span className="text-md-on-surface-variant min-w-0 flex-1 truncate text-label-small">
												{speakerNameOf(item)} · {item.content}
											</span>
											<Button
												type="button"
												variant="accentSoft"
												size="xs"
												className="h-7 px-2 text-label-small"
												disabled={ended}
												onClick={() =>
													sendSessionCommand("chat:restore", {
														messageId: item.id,
													})
												}
											>
												{t("gm.console.restore")}
											</Button>
										</div>
										{item.rejectionReason ? (
											<span className="text-danger-soft-foreground text-label-small">
												{t("gm.console.rejectedReason", {
													reason: item.rejectionReason,
												})}
											</span>
										) : null}
									</div>
								))
							: null}
					</div>
				) : null}
			</div>
		</div>
	);
}

function CharacterStateCard() {
	const characters = usePlayStore((state) => state.characters);
	const { openTool } = useGmTool();
	const entries = useMemo(
		() => orderBySeverity(stateEntries(characters)),
		[characters],
	);
	const featured = entries[0] ?? null;
	const others = entries.slice(1);

	return (
		<div
			className={cn(
				gmFloatingCard,
				"flex shrink-0 flex-col gap-2 rounded-3xl p-3 2xl:gap-2.5 2xl:p-3.5",
			)}
		>
			<div className="flex items-center justify-between gap-2">
				<span className="text-md-on-surface text-label-large-emph">
					{t("gm.workbench.stateTitle")}
				</span>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="text-md-on-surface-variant size-7"
					aria-label={t("gm.workbench.openCharacters")}
					onClick={() => openTool("characters")}
				>
					<ArrowUpRight className="size-4" />
				</Button>
			</div>
			{featured ? (
				<div className="flex items-center gap-2.5">
					<Avatar
						size="sm"
						className={cn(
							"size-8",
							isCritical(featured.state)
								? "bg-danger-soft"
								: "bg-md-surface-container-highest",
						)}
					>
						<AvatarFallback
							className={cn(
								"text-label-medium",
								isCritical(featured.state)
									? "text-danger-soft-foreground"
									: "text-md-on-surface-variant",
							)}
						>
							{featured.character.name.slice(0, 1)}
						</AvatarFallback>
					</Avatar>
					<span className="flex min-w-0 flex-1 flex-col">
						<span className="text-md-on-surface truncate text-label-large">
							{featured.character.name}
						</span>
						<span
							className={cn(
								"truncate text-label-medium",
								isCritical(featured.state)
									? "text-danger"
									: "text-md-on-surface-variant",
							)}
						>
							{statusLine(featured.state)}
						</span>
					</span>
					<HeartPulse
						className={cn(
							"size-5 shrink-0",
							isCritical(featured.state)
								? "text-danger/80"
								: "text-md-on-surface-variant/35",
						)}
					/>
				</div>
			) : (
				<p className="text-md-on-surface-variant text-label-small">
					{t("gm.console.noCharacters")}
				</p>
			)}
			{others.length > 0 ? (
				<div className="border-separator-secondary/60 flex flex-col gap-2 border-t pt-2">
					{others.map(({ character, state }) => (
						<div
							key={character.characterId}
							className="flex min-w-0 items-center gap-2.5"
						>
							<Avatar size="sm" className="size-8">
								<AvatarFallback className="text-md-on-surface-variant text-label-medium">
									{character.name.slice(0, 1)}
								</AvatarFallback>
							</Avatar>
							<span className="flex min-w-0 flex-1 flex-col">
								<span className="text-md-on-surface truncate text-label-large">
									{character.name}
								</span>
								<span className="text-md-on-surface-variant truncate text-label-small">
									{hpLine(state)} · SAN {state.san} / {state.maxSan}
								</span>
							</span>
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}

function AudioMiniCard() {
	const {
		current,
		bgm,
		durationMs,
		displayPosition,
		setSeekDraft,
		togglePlay,
		seek,
	} = useBgmPlayback();
	const { openTool } = useGmTool();

	return (
		<div
			className={cn(
				gmFloatingCard,
				"flex shrink-0 flex-col gap-1 rounded-3xl p-2.5 2xl:p-3",
			)}
		>
			<div className="flex items-center gap-2.5">
				<Music2 className="text-md-on-surface-variant size-5 shrink-0" />
				<span className="flex min-w-0 flex-1 flex-col">
					<span className="text-md-on-surface truncate text-label-large-emph">
						{current?.name ?? bgm?.name ?? t("gm.console.audioNone")}
					</span>
					<span className="text-md-on-surface-variant truncate text-label-small">
						{current
							? bgm?.playing
								? t("gm.workbench.bgmLoopPlaying", {
										loop: bgm?.loop
											? t("gm.workbench.loopOn")
											: t("gm.workbench.loopOff"),
									})
								: t("gm.workbench.bgmPaused")
							: t("gm.workbench.bgmNone")}
					</span>
				</span>
				<Button
					type="button"
					variant="primary"
					size="icon-sm"
					className="size-10 shrink-0"
					disabled={!bgm?.trackId && !current}
					aria-label={
						bgm?.playing
							? t("gm.console.audioPause")
							: t("gm.console.audioPlay")
					}
					onClick={togglePlay}
				>
					{bgm?.playing ? (
						<Pause className="size-4" />
					) : (
						<Play className="size-4" />
					)}
				</Button>
			</div>
			<Slider
				wavy
				value={[displayPosition]}
				min={0}
				max={Math.max(durationMs, 1)}
				playing={Boolean(bgm?.playing)}
				disabled={durationMs <= 0}
				aria-label={t("gm.console.progressAria")}
				className={cn(
					durationMs <= 0 && "opacity-40",
					"min-h-7! [&_[data-slot=slider-track]]:bg-md-outline-variant! [&_[data-slot=slider-thumb]]:h-6! [&_[data-slot=slider-thumb]]:w-1!",
				)}
				onValueChange={(value) => setSeekDraft(value[0] ?? 0)}
				onValueCommit={(value) => seek(value[0] ?? 0)}
			/>
			<div className="flex items-center justify-between">
				<span className="text-md-on-surface-variant font-mono text-label-small tabular-nums">
					{formatDurationMmSs(displayPosition)}
				</span>
				<button
					type="button"
					aria-label={t("gm.workbench.openAudio")}
					className="text-md-on-surface-variant hover:bg-md-on-surface/8 grid size-6 place-items-center rounded-full outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/50"
					onClick={() => openTool("audio")}
				>
					<Volume2 className="size-4" />
				</button>
				<span className="text-md-on-surface-variant font-mono text-label-small tabular-nums">
					{formatDurationMmSs(durationMs)}
				</span>
			</div>
		</div>
	);
}

export { AudioMiniCard, CharacterStateCard, PhaseCard, QueueCard, QueueRow };
