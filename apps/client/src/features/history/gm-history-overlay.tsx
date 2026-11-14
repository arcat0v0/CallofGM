import type { RewindPreview } from "@cogm/shared";
import { ChevronDown, History, Search, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessageCard } from "@/features/chat/chat-message-card";
import type { ChatMessage } from "@/features/chat/types";
import { t } from "@/i18n";
import { sessionPhaseLabel } from "@/i18n/labels";
import { mapChatMessage, mapHistoryItem } from "@/lib/chat-map";
import { formatStamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";

type HistoryTab = "timeline" | "archive" | "audit";

type EventTypeFilter =
	| "all"
	| "dialogue"
	| "dice"
	| "check"
	| "state"
	| "scene"
	| "phase"
	| "handout"
	| "expression"
	| "rewind";

const EVENT_TYPE_OPTIONS: Array<{
	value: EventTypeFilter;
	labelKey: string;
	activityType?: string;
}> = [
	{ value: "all", labelKey: "history.typeAll" },
	{ value: "dialogue", labelKey: "history.typeDialogue" },
	{ value: "dice", labelKey: "history.typeDice", activityType: "dice:rolled" },
	{
		value: "check",
		labelKey: "history.typeCheck",
		activityType: "check:resolved",
	},
	{
		value: "state",
		labelKey: "history.typeState",
		activityType: "state:changed",
	},
	{
		value: "scene",
		labelKey: "history.typeScene",
		activityType: "scene:changed",
	},
	{
		value: "phase",
		labelKey: "history.typePhase",
		activityType: "session:phase-changed",
	},
	{
		value: "handout",
		labelKey: "history.typeHandout",
		activityType: "handout:granted",
	},
	{
		value: "expression",
		labelKey: "history.typeExpression",
		activityType: "expression:changed",
	},
	{
		value: "rewind",
		labelKey: "history.typeRewind",
		activityType: "session:rewound",
	},
];

function matchesEventType(
	message: ChatMessage,
	filter: EventTypeFilter,
): boolean {
	if (filter === "all") {
		return true;
	}
	if (filter === "dialogue") {
		return message.activityType === undefined;
	}
	const option = EVENT_TYPE_OPTIONS.find((item) => item.value === filter);
	return (
		option?.activityType !== undefined &&
		message.activityType === option.activityType
	);
}

function filterTimelineMessages(
	messages: ChatMessage[],
	filters: { query: string; speakers: string[]; eventType: EventTypeFilter },
): ChatMessage[] {
	const keyword = filters.query.trim().toLowerCase();
	return messages.filter((message) => {
		if (
			filters.speakers.length > 0 &&
			!filters.speakers.includes(message.speakerName)
		) {
			return false;
		}
		if (!matchesEventType(message, filters.eventType)) {
			return false;
		}
		if (!keyword) {
			return true;
		}
		return (
			message.body.toLowerCase().includes(keyword) ||
			message.speakerName.toLowerCase().includes(keyword)
		);
	});
}

function PreviewSummary({ preview }: { preview: RewindPreview }) {
	const phaseChange = preview.phaseChange;
	const sceneChange = preview.sceneChange;

	return (
		<div className="flex flex-col gap-2">
			<ul className="text-md-on-surface-variant flex flex-col gap-1.5 text-label-medium">
				<li>
					{t("history.willArchiveMessages", { count: preview.messageCount })}
				</li>
				<li>
					{t("history.willArchiveActivities", { count: preview.activityCount })}
				</li>
				{preview.pendingCount > 0 ? (
					<li>
						{t("history.willClearPending", { count: preview.pendingCount })}
					</li>
				) : null}
				{preview.revertedCheckCount > 0 ? (
					<li>
						{t("history.willRevertChecks", {
							count: preview.revertedCheckCount,
						})}
					</li>
				) : null}
				{preview.revokedHandoutTitles.length > 0 ? (
					<li>
						{t("history.willRevokeHandouts", {
							titles: preview.revokedHandoutTitles.join(
								t("common.listSeparator"),
							),
						})}
					</li>
				) : null}
				{preview.characterChanges.length > 0 ? (
					<li>
						{t("history.characterChanges", {
							names: preview.characterChanges
								.map((change) => change.name)
								.join(t("common.listSeparator")),
						})}
					</li>
				) : null}
				{phaseChange ? (
					<li>
						{t("history.phaseChange", {
							from: sessionPhaseLabel(phaseChange.from),
							to: sessionPhaseLabel(phaseChange.to),
						})}
					</li>
				) : null}
				{sceneChange ? (
					<li>
						{t("history.sceneChange", {
							from: sceneChange.fromName ?? t("common.unknown"),
							to: sceneChange.toName ?? t("common.unknown"),
						})}
					</li>
				) : null}
			</ul>
			{preview.hasCheckpoint ? (
				<span className="text-success text-label-small">
					{t("history.hasCheckpoint")}
				</span>
			) : null}
		</div>
	);
}

function GmHistoryOverlay({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [tab, setTab] = useState<HistoryTab>("timeline");
	const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
	const [reason, setReason] = useState("");
	const [confirming, setConfirming] = useState(false);
	const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
	const [undoConfirmId, setUndoConfirmId] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [selectedSpeakers, setSelectedSpeakers] = useState<string[]>([]);
	const [eventType, setEventType] = useState<EventTypeFilter>("all");
	const [undoReason, setUndoReason] = useState("");
	const timelineRef = useRef<HTMLDivElement | null>(null);

	const status = usePlayStore((state) => state.status);
	const messages = usePlayStore((state) => state.messages);
	const characters = usePlayStore((state) => state.characters);
	const viewer = usePlayStore((state) => state.viewer);
	const historyHasMore = usePlayStore((state) => state.historyHasMore);
	const historyLoading = usePlayStore((state) => state.historyLoading);
	const loadOlderHistory = usePlayStore((state) => state.loadOlderHistory);
	const historyPreview = usePlayStore((state) => state.historyPreview);
	const historyPreviewLoading = usePlayStore(
		(state) => state.historyPreviewLoading,
	);
	const requestRewindPreview = usePlayStore(
		(state) => state.requestRewindPreview,
	);
	const clearRewindPreview = usePlayStore((state) => state.clearRewindPreview);
	const requestRewind = usePlayStore((state) => state.requestRewind);
	const rewindLoading = usePlayStore((state) => state.rewindLoading);
	const archiveGroups = usePlayStore((state) => state.archiveGroups);
	const archiveLoading = usePlayStore((state) => state.archiveLoading);
	const loadArchiveGroups = usePlayStore((state) => state.loadArchiveGroups);
	const archiveItems = usePlayStore((state) => state.archiveItems);
	const archiveItemsLoading = usePlayStore(
		(state) => state.archiveItemsLoading,
	);
	const loadArchiveItems = usePlayStore((state) => state.loadArchiveItems);
	const requestUndoRewind = usePlayStore((state) => state.requestUndoRewind);
	const auditItems = usePlayStore((state) => state.auditItems);
	const auditLoading = usePlayStore((state) => state.auditLoading);
	const loadAudit = usePlayStore((state) => state.loadAudit);

	const timelineMessages = useMemo(
		() => messages.filter((message) => !message.pending && !message.rejected),
		[messages],
	);

	const timelineSpeakers = useMemo(() => {
		const names: string[] = [];
		for (const message of timelineMessages) {
			if (!names.includes(message.speakerName)) {
				names.push(message.speakerName);
			}
		}
		return names;
	}, [timelineMessages]);

	const filteredTimeline = useMemo(
		() =>
			filterTimelineMessages(timelineMessages, {
				query,
				speakers: selectedSpeakers,
				eventType,
			}),
		[timelineMessages, query, selectedSpeakers, eventType],
	);

	const currentTypeKey =
		EVENT_TYPE_OPTIONS.find((option) => option.value === eventType)?.labelKey ??
		"history.typeAll";
	const ended = status === "ended";

	const archiveMessages = useMemo(
		() =>
			archiveItems
				.map((item) => mapHistoryItem(item, characters, viewer))
				.filter((message): message is ChatMessage => message !== null),
		[archiveItems, characters, viewer],
	);

	const auditMessages = useMemo(
		() =>
			auditItems.map((item) => ({
				message: {
					...mapChatMessage(item),
					rejected: true,
					rejectionReason: item.rejectionReason ?? null,
				},
				reason: item.rejectionReason?.trim() ?? null,
			})),
		[auditItems],
	);

	useEffect(() => {
		if (!open) {
			return;
		}
		setSelectedEventId(null);
		setReason("");
		setConfirming(false);
		setExpandedGroupId(null);
		setUndoConfirmId(null);
	}, [open]);

	useEffect(() => {
		if (!open) {
			return;
		}
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				event.stopPropagation();
				clearRewindPreview();
				onOpenChange(false);
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [open, onOpenChange, clearRewindPreview]);

	useEffect(() => {
		if (!open) {
			return;
		}
		if (tab === "archive") {
			setExpandedGroupId(null);
			setUndoConfirmId(null);
			loadArchiveGroups();
		}
		if (tab === "audit") {
			loadAudit();
		}
	}, [open, tab, loadArchiveGroups, loadAudit]);

	useEffect(() => {
		if (!open || tab !== "timeline") {
			return;
		}
		const container = timelineRef.current;
		if (container) {
			container.scrollTop = container.scrollHeight;
		}
	}, [open, tab]);

	function close() {
		clearRewindPreview();
		onOpenChange(false);
	}

	function selectAnchor(message: ChatMessage) {
		if (ended || !message.anchorable || message.eventId == null) {
			return;
		}
		if (message.eventId === selectedEventId) {
			return;
		}
		setSelectedEventId(message.eventId);
		setReason("");
		setConfirming(false);
		clearRewindPreview();
		requestRewindPreview(message.eventId);
	}

	function toggleGroup(groupId: string) {
		if (expandedGroupId === groupId) {
			setExpandedGroupId(null);
			return;
		}
		setExpandedGroupId(groupId);
		loadArchiveItems(groupId);
	}

	function toggleSpeaker(name: string) {
		setSelectedSpeakers((current) =>
			current.includes(name)
				? current.filter((item) => item !== name)
				: [...current, name],
		);
	}

	if (!open) {
		return null;
	}

	return (
		<div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
			<div
				role="dialog"
				aria-modal="true"
				aria-label={t("history.title")}
				className="bg-md-surface-container border-md-outline-variant/40 shadow-modal flex h-[90dvh] w-[min(1200px,96vw)] flex-col overflow-hidden rounded-modal border"
			>
				<header className="border-separator-secondary flex shrink-0 items-center gap-3 border-b px-5 py-3.5">
					<History className="text-accent size-5 shrink-0" />
					<h2 className="text-foreground shrink-0 font-sans text-title-medium-emph">
						{t("history.title")}
					</h2>
					<SegmentedControl
						value={tab}
						options={[
							{ value: "timeline", label: t("history.timeline") },
							{ value: "archive", label: t("history.archive") },
							{ value: "audit", label: t("history.audit") },
						]}
						onValueChange={setTab}
						aria-label={t("history.title")}
						className="w-72"
						itemClassName="text-label-small"
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="ml-auto"
						aria-label={t("history.close")}
						title={t("history.close")}
						onClick={close}
					>
						<X className="size-4" />
					</Button>
				</header>

				{tab === "timeline" ? (
					<div className="flex min-h-0 flex-1">
						<div className="flex min-h-0 flex-1 flex-col">
							<div className="border-separator-secondary flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3">
								<InputGroup className="h-9 min-w-44 flex-1">
									<InputGroupAddon>
										<Search />
									</InputGroupAddon>
									<InputGroupInput
										value={query}
										aria-label={t("history.filterSearch")}
										placeholder={t("history.filterSearch")}
										className="text-label-medium"
										onChange={(event) => setQuery(event.target.value)}
									/>
								</InputGroup>
								<Popover>
									<PopoverTrigger asChild>
										<Button
											type="button"
											variant="tertiary"
											size="sm"
											className="h-9 gap-2 rounded-full px-3 text-label-medium"
										>
											<Users className="size-4" />
											{t("history.filterSpeakers")}
											{selectedSpeakers.length > 0 ? (
												<span className="bg-accent text-accent-foreground grid size-5 place-items-center rounded-full text-label-small">
													{selectedSpeakers.length}
												</span>
											) : null}
											<ChevronDown className="size-4" />
										</Button>
									</PopoverTrigger>
									<PopoverContent align="start" className="w-64 p-2">
										{timelineSpeakers.length === 0 ? (
											<p className="text-md-on-surface-variant px-2 py-1.5 text-label-medium">
												{t("history.empty")}
											</p>
										) : (
											<div className="flex max-h-72 flex-col overflow-y-auto">
												{timelineSpeakers.map((name) => (
													<label
														key={name}
														className="hover:bg-md-on-surface/5 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5"
													>
														<Checkbox
															checked={selectedSpeakers.includes(name)}
															onCheckedChange={() => toggleSpeaker(name)}
														/>
														<span className="text-md-on-surface min-w-0 flex-1 truncate text-label-medium">
															{name}
														</span>
													</label>
												))}
											</div>
										)}
										{selectedSpeakers.length > 0 ? (
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="mt-1 h-8 w-full"
												onClick={() => setSelectedSpeakers([])}
											>
												{t("history.filterClear")}
											</Button>
										) : null}
									</PopoverContent>
								</Popover>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											type="button"
											variant="tertiary"
											size="sm"
											className="h-9 gap-2 rounded-full px-3 text-label-medium"
											aria-label={t("history.filterType")}
											title={`${t("history.filterType")}：${t(currentTypeKey)}`}
										>
											{t(currentTypeKey)}
											<ChevronDown className="size-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="start" className="w-44">
										<DropdownMenuRadioGroup
											value={eventType}
											onValueChange={(value) =>
												setEventType(value as EventTypeFilter)
											}
										>
											{EVENT_TYPE_OPTIONS.map((option) => (
												<DropdownMenuRadioItem
													key={option.value}
													value={option.value}
												>
													{t(option.labelKey)}
												</DropdownMenuRadioItem>
											))}
										</DropdownMenuRadioGroup>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
							<div
								ref={timelineRef}
								className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
							>
								{historyHasMore ? (
									<div className="flex shrink-0 justify-center">
										<Button
											type="button"
											variant="tonal"
											size="xs"
											className="h-8 px-3.5 text-label-medium"
											disabled={historyLoading}
											onClick={loadOlderHistory}
										>
											{historyLoading
												? t("common.loading")
												: t("history.loadOlder")}
										</Button>
									</div>
								) : null}
								{filteredTimeline.length === 0 ? (
									<p className="text-md-on-surface-variant py-8 text-center text-body-medium">
										{timelineMessages.length === 0
											? t("history.empty")
											: t("history.noMatches")}
									</p>
								) : (
									filteredTimeline.map((message) => {
										const selectable =
											!ended &&
											message.anchorable === true &&
											message.eventId != null;
										const selected =
											message.eventId != null &&
											message.eventId === selectedEventId;
										return (
											<div
												key={message.id}
												role={selectable ? "button" : undefined}
												tabIndex={selectable ? 0 : undefined}
												aria-pressed={selectable ? selected : undefined}
												onClick={() => selectAnchor(message)}
												onKeyDown={(event) => {
													if (
														selectable &&
														(event.key === "Enter" || event.key === " ")
													) {
														event.preventDefault();
														selectAnchor(message);
													}
												}}
												className={cn(
													"rounded-lg p-2 transition-colors duration-150",
													selectable &&
														"hover:bg-md-on-surface/5 focus-visible:ring-4 focus-visible:ring-focus-ring/50 cursor-pointer outline-none",
													selected && "bg-accent-soft/60 ring-accent ring-2",
												)}
											>
												<ChatMessageCard message={message} variant="flat" />
											</div>
										);
									})
								)}
							</div>
						</div>
						<aside className="bg-md-surface-container-low border-separator-secondary w-80 shrink-0 overflow-y-auto border-l p-4">
							<h3 className="text-md-on-surface mb-3 font-sans text-title-small-emph">
								{t("history.previewTitle")}
							</h3>
							{ended ? (
								<p className="text-md-on-surface-variant text-label-medium">
									{t("history.endedReadOnly")}
								</p>
							) : selectedEventId === null ? (
								<p className="text-md-on-surface-variant text-label-medium">
									{t("history.anchorHint")}
								</p>
							) : historyPreviewLoading ? (
								<p className="text-md-on-surface-variant text-label-medium">
									{t("common.loading")}
								</p>
							) : !historyPreview ? (
								<p className="text-md-on-surface-variant text-label-medium">
									{t("history.previewUnavailable")}
								</p>
							) : (
								<div className="flex flex-col gap-3">
									<span className="text-md-outline text-label-small">
										{t("history.anchorAt", {
											time: formatStamp(historyPreview.anchorOccurredAt),
										})}
									</span>
									{confirming ? (
										<div className="bg-warning-soft/40 border-warning/30 flex flex-col gap-2 rounded-lg border p-3">
											<span className="text-warning-soft-foreground text-title-small-emph">
												{t("history.confirmTitle")}
											</span>
											<p className="text-md-on-surface-variant text-label-medium">
												{t("history.confirmDescription")}
											</p>
											<PreviewSummary preview={historyPreview} />
											<div className="flex justify-end gap-2">
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() => setConfirming(false)}
												>
													{t("history.cancel")}
												</Button>
												<Button
													type="button"
													variant="danger"
													size="sm"
													disabled={rewindLoading}
													onClick={() => {
														requestRewind(historyPreview.anchorEventId, reason);
														close();
													}}
												>
													{t("history.confirm")}
												</Button>
											</div>
										</div>
									) : (
										<>
											<PreviewSummary preview={historyPreview} />
											{historyPreview.hasCheckpoint ? null : (
												<p className="text-danger-soft-foreground text-label-small">
													{t("history.checkpointMissing")}
												</p>
											)}
											<Textarea
												value={reason}
												aria-label={t("history.reasonLabel")}
												placeholder={t("history.reasonPlaceholder")}
												rows={3}
												className="min-h-20"
												onChange={(event) => setReason(event.target.value)}
											/>
											<Button
												type="button"
												variant="danger"
												className="h-10"
												disabled={
													!historyPreview.hasCheckpoint || rewindLoading
												}
												onClick={() => setConfirming(true)}
											>
												{t("history.rewind")}
											</Button>
										</>
									)}
								</div>
							)}
						</aside>
					</div>
				) : null}

				{tab === "archive" ? (
					<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
						{archiveGroups.length === 0 ? (
							<p className="text-md-on-surface-variant py-8 text-center text-body-medium">
								{archiveLoading
									? t("common.loading")
									: t("history.archiveEmpty")}
							</p>
						) : (
							archiveGroups.map((group) => (
								<div
									key={group.id}
									className="bg-md-surface-container-high border-md-outline-variant/40 flex flex-col gap-2 rounded-lg border p-3.5"
								>
									<div className="flex flex-wrap items-center gap-2">
										<Badge
											variant="soft"
											tone={group.action === "rewind" ? "warning" : "default"}
											size="sm"
										>
											{group.action === "rewind"
												? t("history.archiveActionRewind")
												: t("history.archiveActionUndo")}
										</Badge>
										<span className="text-md-outline font-mono text-label-small">
											{formatStamp(group.createdAt)}
										</span>
										{group.undoneAt ? (
											<Badge variant="soft" tone="success" size="sm">
												{t("history.archiveUndoneAt", {
													time: formatStamp(group.undoneAt),
												})}
											</Badge>
										) : null}
									</div>
									<span className="text-md-on-surface-variant text-label-small">
										{t("history.archiveAnchorAt", {
											time: formatStamp(group.anchorOccurredAt),
										})}
									</span>
									<div className="text-md-on-surface-variant flex flex-wrap gap-x-3 gap-y-1 text-label-medium">
										<span>
											{t("history.willArchiveMessages", {
												count: group.archivedMessageCount,
											})}
										</span>
										<span>
											{t("history.willArchiveActivities", {
												count: group.archivedEventCount,
											})}
										</span>
									</div>
									{group.reason ? (
										<p className="text-md-on-surface select-text whitespace-pre-wrap break-words text-body-medium">
											{group.reason}
										</p>
									) : null}
									<div className="flex flex-wrap items-center gap-2">
										<Button
											type="button"
											variant="tertiary"
											size="sm"
											className="h-8 px-3 text-label-medium"
											onClick={() => toggleGroup(group.id)}
										>
											{expandedGroupId === group.id
												? t("history.archiveHide")
												: t("history.archiveView")}
										</Button>
										{!ended && group.action === "rewind" && !group.undoneAt ? (
											<Button
												type="button"
												variant="dangerSoft"
												size="sm"
												className="h-8 px-3 text-label-medium"
												onClick={() => {
													setUndoReason("");
													setUndoConfirmId(group.id);
												}}
											>
												{t("history.undoRewind")}
											</Button>
										) : null}
									</div>
									{undoConfirmId === group.id && !ended ? (
										<div className="bg-danger-soft/40 border-danger/30 flex flex-col gap-2 rounded-lg border p-3">
											<span className="text-danger-soft-foreground text-title-small-emph">
												{t("history.undoConfirmTitle")}
											</span>
											<p className="text-md-on-surface-variant text-label-medium">
												{t("history.undoConfirmDescription")}
											</p>
											<Textarea
												value={undoReason}
												aria-label={t("history.reasonLabel")}
												placeholder={t("history.undoReasonPlaceholder")}
												rows={2}
												className="min-h-16"
												onChange={(event) => setUndoReason(event.target.value)}
											/>
											<div className="flex justify-end gap-2">
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() => setUndoConfirmId(null)}
												>
													{t("history.cancel")}
												</Button>
												<Button
													type="button"
													variant="danger"
													size="sm"
													disabled={rewindLoading}
													onClick={() => {
														requestUndoRewind(group.id, undoReason);
														close();
													}}
												>
													{t("history.undoConfirm")}
												</Button>
											</div>
										</div>
									) : null}
									{expandedGroupId === group.id ? (
										<div className="border-separator-secondary flex flex-col gap-2 border-t pt-3">
											{archiveItemsLoading ? (
												<p className="text-md-on-surface-variant text-label-medium">
													{t("common.loading")}
												</p>
											) : archiveMessages.length === 0 ? (
												<p className="text-md-on-surface-variant text-label-medium">
													{t("history.archiveItemsEmpty")}
												</p>
											) : (
												archiveMessages.map((message) => (
													<ChatMessageCard
														key={message.id}
														message={message}
														variant="flat"
													/>
												))
											)}
											{archiveItems.length > 0 ? (
												<div className="flex justify-center">
													<Button
														type="button"
														variant="tonal"
														size="xs"
														className="h-8 px-3.5 text-label-medium"
														disabled={archiveItemsLoading}
														onClick={() =>
															loadArchiveItems(
																group.id,
																archiveItems[0]?.eventId,
															)
														}
													>
														{archiveItemsLoading
															? t("common.loading")
															: t("history.archiveLoadOlder")}
													</Button>
												</div>
											) : null}
										</div>
									) : null}
								</div>
							))
						)}
					</div>
				) : null}

				{tab === "audit" ? (
					<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
						{auditMessages.length === 0 ? (
							<p className="text-md-on-surface-variant py-8 text-center text-body-medium">
								{auditLoading ? t("common.loading") : t("history.auditEmpty")}
							</p>
						) : (
							auditMessages.map(({ message, reason: rejectionReason }) => (
								<div
									key={message.id}
									className="bg-md-surface-container-high border-md-outline-variant/40 flex flex-col gap-1.5 rounded-lg border p-3.5"
								>
									<div className="flex flex-wrap items-center gap-2">
										<span className="text-md-on-surface text-label-large-emph">
											{message.speakerName}
										</span>
										<Badge variant="soft" tone="danger" size="sm">
											{t("chat.rejected")}
										</Badge>
										<span className="text-md-outline ml-auto font-mono text-label-small">
											{message.time}
										</span>
									</div>
									<p className="text-md-on-surface select-text whitespace-pre-wrap break-words text-body-medium">
										{message.body}
									</p>
									<span className="text-danger-soft-foreground text-label-small">
										{t("history.auditReason", {
											reason: rejectionReason ?? t("chat.rejectionNoReason"),
										})}
									</span>
								</div>
							))
						)}
						{auditItems.length > 0 ? (
							<div className="flex justify-center">
								<Button
									type="button"
									variant="tonal"
									size="xs"
									className="h-8 px-3.5 text-label-medium"
									disabled={auditLoading}
									onClick={() =>
										loadAudit(auditItems[auditItems.length - 1]?.createdAt)
									}
								>
									{auditLoading
										? t("common.loading")
										: t("history.auditLoadOlder")}
								</Button>
							</div>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	);
}

export type { EventTypeFilter };
export { filterTimelineMessages, GmHistoryOverlay };
