import {
	type BgmState,
	type CatalogHandoutDto,
	type ChatMessageDto,
	type CheckRequestDto,
	type GrantedHandoutDto,
	type HandoutGrantDetailDto,
	HandoutGrantOverviewDto,
	HISTORY_DEFAULT_LIMIT,
	type HistoryArchiveGroup,
	HistoryArchiveItemsReply,
	HistoryArchiveReply,
	HistoryAuditReply,
	type HistoryItem,
	type HistoryPage,
	HistoryPageReply,
	type KickedPlayerDto,
	type OnlinePlayerDto,
	PortraitLayout,
	PortraitScale,
	RewindEvent,
	RewindPreview,
	type SceneDto,
	type SeatRole,
	type SePlayedEvent,
	type ServerMessage,
	type SessionPhase,
	type SessionSettings,
	SessionSettingsDefaults,
	type SessionSnapshotPayload,
	type SessionStatus,
	type SnapshotCharacter,
	type SnapshotRewindNotice,
	type TrackDto,
} from "@cogm/shared";
import { toast } from "sonner";
import { create } from "zustand";
import type { ChatMessage } from "@/features/chat/types";
import { t } from "@/i18n";
import {
	mapActivityEvent,
	mapChatMessage,
	mapHistoryItem,
	resolveActivityPayload,
} from "@/lib/chat-map";
import { errorCopy } from "@/lib/error-copy";
import { formatClock, initialsOf } from "@/lib/format";
import { LOCAL_VOLUME_DEFAULT, normalizeLocalVolume } from "@/lib/local-volume";
import { sendSessionCommand } from "@/lib/session-socket";
import {
	readLocalMuted,
	readLocalVolume,
	writeLocalMuted,
	writeLocalVolume,
} from "@/lib/storage";
import { getRuleComponent } from "@/rules/registry";

export type ConnectionTerminal =
	| "kicked"
	| "unavailable"
	| "replaced"
	| "released";

type PlayState = {
	sessionId: string | null;
	moduleId: string | null;
	moduleName: string | null;
	ruleId: string | null;
	sessionName: string | null;
	themeId: string | null;
	status: SessionStatus | null;
	phase: SessionPhase | null;
	lastEventId: number;
	settings: SessionSettings;
	portraitLayout: PortraitLayout;
	portraitScale: PortraitScale;
	viewer: {
		isGm: boolean;
		seatRole: SeatRole | null;
		holderKind: "user" | "anonymous" | null;
		holderId: string | null;
	};
	characters: SnapshotCharacter[];
	messages: ChatMessage[];
	pendingQueue: ChatMessageDto[];
	discardedQueue: ChatMessageDto[];
	bgm: BgmState | null;
	scene: { id: string; name: string; bgAssetId: string | null } | null;
	handouts: GrantedHandoutDto[];
	handoutGrants: HandoutGrantDetailDto[];
	presence: OnlinePlayerDto[];
	presenceAvailable: boolean;
	kickedPlayers: KickedPlayerDto[];
	kickedReason: string | null;
	pendingChecks: CheckRequestDto[];
	dismissedChecks: string[];
	catalogScenes: SceneDto[];
	catalogTracks: TrackDto[];
	catalogHandouts: CatalogHandoutDto[];
	seCue: SePlayedEvent | null;
	bgmTransitionMs: number;
	muted: boolean;
	localVolume: number;
	connected: boolean;
	snapshotReady: boolean;
	terminal: ConnectionTerminal | null;
	lastRejection: { commandId: string; message: string } | null;
	historyBeforeEventId: number | null;
	historyHasMore: boolean;
	historyLoading: boolean;
	historyCommandId: string | null;
	historyPagesLoaded: number;
	lastRewind: SnapshotRewindNotice | null;
	lastRewindSeenId: number;
	historyPreview: RewindPreview | null;
	historyPreviewLoading: boolean;
	historyPreviewCommandId: string | null;
	rewindLoading: boolean;
	rewindCommandId: string | null;
	archiveGroups: HistoryArchiveGroup[];
	archiveLoading: boolean;
	archiveCommandId: string | null;
	archiveItems: HistoryItem[];
	archiveItemsLoading: boolean;
	archiveItemsCommandId: string | null;
	archiveItemsBeforeId: number | null;
	auditItems: ChatMessageDto[];
	auditLoading: boolean;
	auditCommandId: string | null;
	auditBeforeAt: number | null;
	applySnapshot: (payload: SessionSnapshotPayload, watermark: number) => void;
	applyMessage: (message: ServerMessage) => void;
	setCatalog: (input: {
		scenes?: SceneDto[];
		tracks?: TrackDto[];
		handouts?: CatalogHandoutDto[];
	}) => void;
	setConnected: (connected: boolean) => void;
	setTerminal: (terminal: ConnectionTerminal | null) => void;
	setThemeId: (themeId: string | null) => void;
	markEnded: () => void;
	markHandoutRead: (grantId: string) => void;
	dismissCheck: (requestId: string) => void;
	resumeChecks: () => void;
	setMuted: (muted: boolean) => void;
	setLocalVolume: (localVolume: number) => void;
	clearSeCue: () => void;
	loadOlderHistory: () => void;
	requestRewindPreview: (anchorEventId: number) => void;
	clearRewindPreview: () => void;
	requestRewind: (anchorEventId: number, reason?: string) => void;
	requestUndoRewind: (rewindId: string, reason?: string) => void;
	loadArchiveGroups: () => void;
	loadArchiveItems: (rewindId: string, beforeEventId?: number) => void;
	loadAudit: (beforeCreatedAt?: number) => void;
	reset: () => void;
};

const empty = {
	sessionId: null as string | null,
	moduleId: null as string | null,
	moduleName: null as string | null,
	ruleId: null as string | null,
	sessionName: null as string | null,
	themeId: null as string | null,
	status: null as SessionStatus | null,
	phase: null as SessionPhase | null,
	lastEventId: 0,
	settings: SessionSettingsDefaults,
	portraitLayout: "auto" as PortraitLayout,
	portraitScale: "md" as PortraitScale,
	viewer: {
		isGm: false,
		seatRole: null,
		holderKind: null,
		holderId: null,
	} as PlayState["viewer"],
	characters: [] as SnapshotCharacter[],
	messages: [] as ChatMessage[],
	pendingQueue: [] as ChatMessageDto[],
	discardedQueue: [] as ChatMessageDto[],
	bgm: null as BgmState | null,
	scene: null as PlayState["scene"],
	handouts: [] as GrantedHandoutDto[],
	handoutGrants: [] as HandoutGrantDetailDto[],
	presence: [] as OnlinePlayerDto[],
	presenceAvailable: false,
	kickedPlayers: [] as KickedPlayerDto[],
	kickedReason: null as string | null,
	pendingChecks: [] as CheckRequestDto[],
	dismissedChecks: [] as string[],
	catalogScenes: [] as SceneDto[],
	catalogTracks: [] as TrackDto[],
	catalogHandouts: [] as CatalogHandoutDto[],
	seCue: null as SePlayedEvent | null,
	bgmTransitionMs: 400,
	muted: false,
	localVolume: LOCAL_VOLUME_DEFAULT,
	connected: false,
	snapshotReady: false,
	terminal: null as ConnectionTerminal | null,
	lastRejection: null as { commandId: string; message: string } | null,
	historyBeforeEventId: null as number | null,
	historyHasMore: false,
	historyLoading: false,
	historyCommandId: null as string | null,
	historyPagesLoaded: 0,
	lastRewind: null as SnapshotRewindNotice | null,
	lastRewindSeenId: 0,
	historyPreview: null as RewindPreview | null,
	historyPreviewLoading: false,
	historyPreviewCommandId: null as string | null,
	rewindLoading: false,
	rewindCommandId: null as string | null,
	archiveGroups: [] as HistoryArchiveGroup[],
	archiveLoading: false,
	archiveCommandId: null as string | null,
	archiveItems: [] as HistoryItem[],
	archiveItemsLoading: false,
	archiveItemsCommandId: null as string | null,
	archiveItemsBeforeId: null as number | null,
	auditItems: [] as ChatMessageDto[],
	auditLoading: false,
	auditCommandId: null as string | null,
	auditBeforeAt: null as number | null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function characterStatePatch(
	state: PlayState,
	payload: unknown,
): Partial<PlayState> {
	if (!isRecord(payload)) {
		return {};
	}
	const characterId =
		typeof payload.characterId === "string" ? payload.characterId : null;
	if (!characterId) {
		return {};
	}
	return {
		characters: state.characters.map((character) =>
			character.characterId === characterId
				? {
						...character,
						state:
							payload.state === undefined ? character.state : payload.state,
						publicState:
							payload.publicState === undefined
								? character.publicState
								: payload.publicState,
						publicStateFields:
							payload.publicStateFields === undefined
								? character.publicStateFields
								: Array.isArray(payload.publicStateFields)
									? payload.publicStateFields.filter(
											(field): field is string => typeof field === "string",
										)
									: undefined,
					}
				: character,
		),
	};
}

function appendMessage(
	messages: ChatMessage[],
	next: ChatMessage | null,
): ChatMessage[] {
	if (!next || messages.some((message) => message.id === next.id)) {
		return messages;
	}
	return [...messages, next];
}

function appendLiveMessage(
	messages: ChatMessage[],
	next: ChatMessage | null,
): ChatMessage[] {
	if (!next) {
		return messages;
	}
	const index = messages.findIndex((message) => message.id === next.id);
	if (index === -1) {
		return [...messages, next];
	}
	if (!messages[index]?.pending && !messages[index]?.rejected) {
		return messages;
	}
	return [...messages.filter((message) => message.id !== next.id), next];
}

function mergeMessages(
	current: ChatMessage[],
	incoming: ChatMessage[],
): ChatMessage[] {
	if (incoming.length === 0) {
		return current;
	}
	const byId = new Map<string, ChatMessage>();
	for (const message of current) {
		byId.set(message.id, message);
	}
	for (const message of incoming) {
		if (!byId.has(message.id)) {
			byId.set(message.id, message);
		}
	}
	return [...byId.values()].sort((a, b) => a.sortKey - b.sortKey);
}

function clearPendingCommand(
	state: PlayState,
	commandId: string,
): Partial<PlayState> {
	return {
		...(commandId === state.historyCommandId
			? { historyLoading: false, historyCommandId: null }
			: {}),
		...(commandId === state.historyPreviewCommandId
			? { historyPreviewLoading: false, historyPreviewCommandId: null }
			: {}),
		...(commandId === state.rewindCommandId
			? { rewindLoading: false, rewindCommandId: null }
			: {}),
		...(commandId === state.archiveCommandId
			? { archiveLoading: false, archiveCommandId: null }
			: {}),
		...(commandId === state.archiveItemsCommandId
			? { archiveItemsLoading: false, archiveItemsCommandId: null }
			: {}),
		...(commandId === state.auditCommandId
			? { auditLoading: false, auditCommandId: null }
			: {}),
	};
}

function mapHistoryItems(
	items: HistoryPage["items"],
	characters: SnapshotCharacter[],
): ChatMessage[] {
	return items
		.map((item) => mapHistoryItem(item, characters))
		.filter((message): message is ChatMessage => message !== null);
}

function withActivityMessage(
	state: PlayState,
	type: string,
	payload: unknown,
	eventId: number | undefined,
	occurredAt: number | undefined,
	patch: Partial<PlayState>,
): Partial<PlayState> {
	const message = mapActivityEvent(
		type,
		payload,
		eventId ?? Date.now(),
		occurredAt,
		state.characters,
	);
	return message
		? { ...patch, messages: appendMessage(state.messages, message) }
		: patch;
}

function applyEvent(
	state: PlayState,
	type: string,
	payload: unknown,
	eventId?: number,
	occurredAt?: number,
): Partial<PlayState> {
	if (type === "audio:se") {
		const cue = (isRecord(payload) ? payload : {}) as SePlayedEvent;
		if (!cue.trackId) {
			return {};
		}
		return { seCue: cue };
	}

	if (!isRecord(payload)) {
		return {};
	}

	switch (type) {
		case "chat:message": {
			const dto = (payload.message ?? payload) as ChatMessageDto;
			if (!dto?.id) {
				return {};
			}
			return {
				messages: appendLiveMessage(state.messages, mapChatMessage(dto)),
			};
		}
		case "dice:rolled":
		case "check:resolved": {
			const activityPayload = resolveActivityPayload(
				type,
				payload,
				state.characters,
			);
			const next = mapActivityEvent(
				type,
				activityPayload,
				eventId ?? Date.now(),
				occurredAt,
			);
			const patch: Partial<PlayState> = {
				messages: appendMessage(state.messages, next),
			};
			if (type === "check:resolved") {
				const requestId =
					typeof payload.requestId === "string" ? payload.requestId : null;
				if (requestId) {
					patch.pendingChecks = state.pendingChecks.filter(
						(item) => item.id !== requestId,
					);
					patch.dismissedChecks = state.dismissedChecks.filter(
						(item) => item !== requestId,
					);
				}
			}
			return patch;
		}
		case "session:status-changed": {
			const status = payload.status;
			if (
				status === "waiting" ||
				status === "preparing" ||
				status === "active" ||
				status === "ended"
			) {
				return { status };
			}
			return {};
		}
		case "session:settings-changed": {
			if (
				typeof payload.sharePcSheets !== "boolean" ||
				typeof payload.obSeePcState !== "boolean"
			) {
				return {};
			}
			return {
				settings: {
					sharePcSheets: payload.sharePcSheets,
					obSeePcState: payload.obSeePcState,
				},
			};
		}
		case "session:phase-changed": {
			const phase = payload.phase;
			if (
				phase === "free_discussion" ||
				phase === "performance_time" ||
				phase === "forced_cg" ||
				phase === "free_performance"
			) {
				return withActivityMessage(state, type, payload, eventId, occurredAt, {
					phase,
				});
			}
			return {};
		}
		case "scene:changed": {
			const id =
				typeof payload.sceneId === "string"
					? payload.sceneId
					: typeof payload.id === "string"
						? payload.id
						: null;
			const name = typeof payload.name === "string" ? payload.name : "";
			if (!id) {
				return {};
			}
			return withActivityMessage(state, type, payload, eventId, occurredAt, {
				scene: {
					id,
					name,
					bgAssetId:
						typeof payload.bgAssetId === "string" ? payload.bgAssetId : null,
				},
			});
		}
		case "stage:layout-changed": {
			const layout = PortraitLayout.safeParse(payload.layout);
			const scale = PortraitScale.safeParse(payload.scale);
			if (!layout.success || !scale.success) {
				return {};
			}
			return { portraitLayout: layout.data, portraitScale: scale.data };
		}
		case "expression:changed": {
			const characterId =
				typeof payload.characterId === "string" ? payload.characterId : null;
			const expressionKey =
				typeof payload.expressionKey === "string"
					? payload.expressionKey
					: null;
			if (!characterId || !expressionKey) {
				return {};
			}
			return withActivityMessage(state, type, payload, eventId, occurredAt, {
				characters: state.characters.map((character) =>
					character.characterId === characterId
						? { ...character, currentExpressionKey: expressionKey }
						: character,
				),
			});
		}
		case "audio:bgm": {
			const bgm = (payload.bgm ?? payload) as BgmState;
			if (!bgm || typeof bgm !== "object") {
				return {};
			}
			const transitionMs =
				typeof payload.transitionMs === "number" ? payload.transitionMs : 400;
			return { bgm, bgmTransitionMs: transitionMs };
		}
		case "handout:granted": {
			const grant = (payload.grant ?? payload) as GrantedHandoutDto;
			if (!grant?.grantId) {
				return {};
			}
			if (state.handouts.some((item) => item.grantId === grant.grantId)) {
				return withActivityMessage(state, type, payload, eventId, occurredAt, {
					handouts: state.handouts.map((item) =>
						item.grantId === grant.grantId ? grant : item,
					),
				});
			}
			return withActivityMessage(state, type, payload, eventId, occurredAt, {
				handouts: [...state.handouts, grant],
			});
		}
		case "check:requested": {
			const request = (payload.request ?? payload) as CheckRequestDto;
			if (!request?.id) {
				return {};
			}
			if (state.pendingChecks.some((item) => item.id === request.id)) {
				return {};
			}
			return { pendingChecks: [...state.pendingChecks, request] };
		}
		case "state:changed": {
			const patch = characterStatePatch(state, payload);
			if (Object.keys(patch).length === 0) {
				return {};
			}
			return state.viewer.isGm
				? withActivityMessage(state, type, payload, eventId, occurredAt, patch)
				: patch;
		}
		case "state:public-changed": {
			return characterStatePatch(state, payload);
		}
		case "npc:state-visibility-changed": {
			return characterStatePatch(state, payload);
		}
		case "state:hint": {
			const characterId =
				typeof payload.characterId === "string" ? payload.characterId : null;
			const name =
				state.characters.find(
					(character) => character.characterId === characterId,
				)?.name ?? t("chat.role.character");
			const hints = Array.isArray(payload.hints)
				? payload.hints.filter(
						(item): item is string => typeof item === "string",
					)
				: [];
			for (const hint of hints) {
				toast.warning(`${name}：${hint}`);
			}
			return {};
		}
		case "session:rewound": {
			const rewind = RewindEvent.safeParse(payload);
			if (!rewind.success) {
				return {};
			}
			toast.info(
				rewind.data.action === "rewind"
					? t("history.rewoundNotice")
					: t("history.undoNotice"),
			);
			return {
				lastRewind: {
					id: rewind.data.rewindId,
					action: rewind.data.action,
					eventId: eventId ?? 0,
					anchorEventId: rewind.data.anchorEventId,
					occurredAt: occurredAt ?? Date.now(),
				},
				lastRewindSeenId: eventId ?? 0,
			};
		}
		default:
			return {};
	}
}

export const usePlayStore = create<PlayState>((set, get) => ({
	...empty,
	localVolume: readLocalVolume(),
	muted: readLocalMuted(),
	applySnapshot: (payload, watermark) => {
		const previous = get();
		const rewindNotice = payload.lastRewind ?? null;
		if (
			rewindNotice &&
			rewindNotice.eventId > previous.lastEventId &&
			rewindNotice.eventId !== previous.lastRewindSeenId
		) {
			toast.info(
				rewindNotice.action === "rewind"
					? t("history.rewoundNotice")
					: t("history.undoNotice"),
			);
		}
		const ownPending = (payload.ownPendingMessages ?? []).map((dto) => ({
			...mapChatMessage(dto),
			pending: true,
		}));
		const ownRejected = (payload.ownRejectedMessages ?? []).map((dto) => ({
			...mapChatMessage(dto),
			rejected: true,
			rejectionReason: dto.rejectionReason ?? null,
		}));
		const merged = mergeMessages(
			[],
			[
				...mapHistoryItems(payload.recentHistory, payload.characters),
				...ownPending,
				...ownRejected,
			],
		);
		set({
			sessionId: payload.session.id,
			moduleId: payload.session.moduleId,
			moduleName: payload.session.moduleName,
			ruleId: payload.session.ruleId,
			sessionName: payload.session.name,
			themeId: payload.session.themeId,
			status: payload.session.status,
			phase: payload.session.phase,
			lastEventId: watermark,
			settings: payload.session.settings,
			portraitLayout: payload.session.portraitLayout ?? "auto",
			portraitScale: payload.session.portraitScale ?? "md",
			viewer: {
				isGm: payload.viewer.isGm,
				seatRole: payload.viewer.seatRole,
				holderKind: payload.viewer.holderKind ?? null,
				holderId: payload.viewer.holderId ?? null,
			},
			characters: payload.characters,
			messages: merged,
			pendingQueue: payload.pendingQueue ?? [],
			discardedQueue: payload.discardedQueue ?? [],
			bgm: payload.bgm,
			scene: payload.currentScene,
			handouts: payload.visibleHandouts,
			handoutGrants: payload.handoutGrants ?? [],
			presence: payload.online ?? [],
			presenceAvailable: payload.online !== undefined,
			kickedPlayers: payload.kickedPlayers ?? [],
			pendingChecks: payload.pendingCheckRequests,
			dismissedChecks: [],
			connected: true,
			snapshotReady: true,
			terminal: null,
			historyBeforeEventId: payload.history.beforeEventId,
			historyHasMore: payload.history.hasMore,
			historyLoading: false,
			historyCommandId: null,
			historyPagesLoaded: 0,
			historyPreview: null,
			historyPreviewLoading: false,
			historyPreviewCommandId: null,
			rewindLoading: false,
			rewindCommandId: null,
			archiveGroups: [],
			archiveLoading: false,
			archiveCommandId: null,
			archiveItems: [],
			archiveItemsLoading: false,
			archiveItemsCommandId: null,
			archiveItemsBeforeId: null,
			auditItems: [],
			auditLoading: false,
			auditCommandId: null,
			auditBeforeAt: null,
			lastRewind: rewindNotice,
			lastRewindSeenId: Math.max(
				previous.lastRewindSeenId,
				rewindNotice?.eventId ?? 0,
			),
		});
	},
	applyMessage: (message) => {
		if (message.type === "snapshot" && "watermark" in message) {
			get().applySnapshot(
				message.payload as SessionSnapshotPayload,
				message.watermark,
			);
			return;
		}
		if (
			"type" in message &&
			(message.type === "command:accepted" ||
				message.type === "command:rejected")
		) {
			const payload = isRecord(message.payload) ? message.payload : {};
			const commandId =
				"commandId" in message && typeof message.commandId === "string"
					? message.commandId
					: "";
			if (message.type === "command:rejected") {
				const errorMsg = errorCopy({
					code: typeof payload.code === "string" ? payload.code : null,
				});
				toast.error(errorMsg);
				set((state) => ({
					lastRejection: { commandId, message: errorMsg },
					...clearPendingCommand(state, commandId),
				}));
				return;
			}
			const historyReply = HistoryPageReply.safeParse(message.payload);
			if (historyReply.success) {
				set((state) => {
					if (commandId !== state.historyCommandId) {
						return {};
					}
					const page = historyReply.data.history;
					return {
						messages: mergeMessages(
							state.messages,
							mapHistoryItems(page.items, state.characters),
						),
						historyBeforeEventId: page.beforeEventId,
						historyHasMore: page.hasMore,
						historyLoading: false,
						historyCommandId: null,
						historyPagesLoaded: state.historyPagesLoaded + 1,
					};
				});
				return;
			}
			const previewReply = RewindPreview.safeParse(payload.preview);
			if (previewReply.success) {
				set((state) =>
					commandId !== state.historyPreviewCommandId
						? {}
						: {
								historyPreview: previewReply.data,
								historyPreviewLoading: false,
								historyPreviewCommandId: null,
							},
				);
				return;
			}
			const archiveReply = HistoryArchiveReply.safeParse(message.payload);
			if (archiveReply.success) {
				set((state) =>
					commandId !== state.archiveCommandId
						? {}
						: {
								archiveGroups: archiveReply.data.groups,
								archiveLoading: false,
								archiveCommandId: null,
							},
				);
				return;
			}
			const archiveItemsReply = HistoryArchiveItemsReply.safeParse(
				message.payload,
			);
			if (archiveItemsReply.success) {
				set((state) => {
					if (commandId !== state.archiveItemsCommandId) {
						return {};
					}
					const page = archiveItemsReply.data;
					return {
						archiveItems:
							state.archiveItemsBeforeId === null
								? page.items
								: [...page.items, ...state.archiveItems],
						archiveItemsLoading: false,
						archiveItemsCommandId: null,
						archiveItemsBeforeId: null,
					};
				});
				return;
			}
			const auditReply = HistoryAuditReply.safeParse(message.payload);
			if (auditReply.success) {
				set((state) => {
					if (commandId !== state.auditCommandId) {
						return {};
					}
					return {
						auditItems:
							state.auditBeforeAt === null
								? auditReply.data.items
								: [...state.auditItems, ...auditReply.data.items],
						auditLoading: false,
						auditCommandId: null,
						auditBeforeAt: null,
					};
				});
				return;
			}
			if (commandId && commandId === get().rewindCommandId) {
				set({
					rewindLoading: false,
					rewindCommandId: null,
					historyPreview: null,
				});
				toast.success(
					payload.action === "undo"
						? t("history.undoDone")
						: t("history.rewindDone"),
				);
				return;
			}
			const requestId =
				typeof payload.requestId === "string" ? payload.requestId : null;
			const pending = requestId
				? get().pendingChecks.find((item) => item.id === requestId)
				: undefined;
			const skillKey = pending
				? getRuleComponent(get().ruleId).skillLabel(pending.skillKey)
				: t("chat.role.check");
			const hiddenRolled = payload.rolled === true && payload.hidden === true;
			if (requestId && hiddenRolled) {
				toast.success(t("check.rolled"));
			}
			if (requestId) {
				set((state) => {
					const patch: Partial<PlayState> = {
						pendingChecks: state.pendingChecks.filter(
							(item) => item.id !== requestId,
						),
						dismissedChecks: state.dismissedChecks.filter(
							(item) => item !== requestId,
						),
					};
					if (hiddenRolled) {
						patch.messages = appendMessage(state.messages, {
							id: `check-ack-${requestId}`,
							sortKey: state.lastEventId,
							speakerName: skillKey,
							speakerRoleLabel: t("chat.role.check"),
							avatarInitials: initialsOf(skillKey),
							avatarBg: "bg-default",
							avatarFg: "text-foreground",
							time: formatClock(Date.now()),
							body: t("check.rolledFor", { skill: skillKey }),
							tone: "ooc",
							isSystem: true,
						});
					}
					return patch;
				});
			}
			return;
		}
		if (
			"eventId" in message &&
			typeof message.eventId === "number" &&
			"type" in message
		) {
			set((state) => ({
				lastEventId: Math.max(state.lastEventId, message.eventId),
				...applyEvent(
					state,
					message.type,
					message.payload,
					message.eventId,
					"occurredAt" in message ? message.occurredAt : undefined,
				),
			}));
			return;
		}
		if ("type" in message && message.type === "chat:pending") {
			const payload = isRecord(message.payload) ? message.payload : {};
			const dto = payload.message as ChatMessageDto | undefined;
			if (!dto?.id) {
				return;
			}
			const next: ChatMessage = {
				...mapChatMessage(dto),
				pending: true,
				rejected: false,
				rejectionReason: null,
			};
			set((state) => {
				const existing = state.messages.find((item) => item.id === next.id);
				if (existing && !existing.pending && !existing.rejected) {
					return {};
				}
				return {
					messages: existing
						? state.messages.map((item) => (item.id === next.id ? next : item))
						: [...state.messages, next],
				};
			});
			return;
		}
		if ("type" in message && message.type === "chat:rejected") {
			const payload = isRecord(message.payload) ? message.payload : {};
			const messageId =
				typeof payload.messageId === "string" ? payload.messageId : null;
			if (!messageId) {
				return;
			}
			const reason =
				typeof payload.reason === "string" && payload.reason.trim()
					? payload.reason.trim()
					: null;
			set((state) => ({
				messages: state.messages.map((item) =>
					item.id === messageId
						? {
								...item,
								pending: false,
								rejected: true,
								rejectionReason: reason,
							}
						: item,
				),
			}));
			toast.warning(
				reason
					? t("chat.rejectionToastWithReason", { reason })
					: t("chat.rejectionToast"),
			);
			return;
		}
		if ("type" in message && message.type === "chat:queue") {
			const payload = message.payload as {
				messages?: ChatMessageDto[];
				discarded?: ChatMessageDto[];
			};
			set({
				pendingQueue: payload.messages ?? [],
				...(payload.discarded ? { discardedQueue: payload.discarded } : {}),
			});
			return;
		}
		if ("type" in message && message.type === "handout:grants") {
			const overview = HandoutGrantOverviewDto.safeParse(message.payload);
			if (overview.success) {
				set({ handoutGrants: overview.data.grants });
			}
			return;
		}
		if ("type" in message && message.type === "presence:updated") {
			const payload = message.payload as {
				online?: OnlinePlayerDto[];
				kickedPlayers?: KickedPlayerDto[];
			};
			set({
				presence: payload.online ?? [],
				presenceAvailable: true,
				...(payload.kickedPlayers
					? { kickedPlayers: payload.kickedPlayers }
					: {}),
			});
			return;
		}
		if ("type" in message && message.type === "session:kicked") {
			const payload = isRecord(message.payload) ? message.payload : {};
			const reason = typeof payload.reason === "string" ? payload.reason : null;
			set({ terminal: "kicked", kickedReason: reason, connected: false });
			toast.error(t("play.kickLocked"));
			return;
		}
		if ("type" in message && message.type === "audio:se") {
			set((state) => applyEvent(state, "audio:se", message.payload));
		}
	},
	loadOlderHistory: () => {
		const state = get();
		if (state.historyLoading || !state.historyHasMore) {
			return;
		}
		const commandId = sendSessionCommand("history:page", {
			beforeEventId: state.historyBeforeEventId ?? undefined,
			limit: HISTORY_DEFAULT_LIMIT,
		});
		if (!commandId) {
			toast.error(t("play.notConnected"));
			return;
		}
		set({ historyLoading: true, historyCommandId: commandId });
	},
	requestRewindPreview: (anchorEventId) => {
		const commandId = sendSessionCommand("history:preview-rewind", {
			anchorEventId,
		});
		if (!commandId) {
			toast.error(t("play.notConnected"));
			return;
		}
		set({ historyPreviewLoading: true, historyPreviewCommandId: commandId });
	},
	clearRewindPreview: () =>
		set({
			historyPreview: null,
			historyPreviewLoading: false,
			historyPreviewCommandId: null,
		}),
	requestRewind: (anchorEventId, reason) => {
		const commandId = sendSessionCommand("history:rewind", {
			anchorEventId,
			reason: reason?.trim() || undefined,
		});
		if (!commandId) {
			toast.error(t("play.notConnected"));
			return;
		}
		set({ rewindLoading: true, rewindCommandId: commandId });
	},
	requestUndoRewind: (rewindId, reason) => {
		const commandId = sendSessionCommand("history:undo-rewind", {
			rewindId,
			reason: reason?.trim() || undefined,
		});
		if (!commandId) {
			toast.error(t("play.notConnected"));
			return;
		}
		set({ rewindLoading: true, rewindCommandId: commandId });
	},
	loadArchiveGroups: () => {
		const commandId = sendSessionCommand("history:archive", {});
		if (!commandId) {
			toast.error(t("play.notConnected"));
			return;
		}
		set({ archiveLoading: true, archiveCommandId: commandId });
	},
	loadArchiveItems: (rewindId, beforeEventId) => {
		const commandId = sendSessionCommand("history:archive-items", {
			rewindId,
			beforeEventId,
		});
		if (!commandId) {
			toast.error(t("play.notConnected"));
			return;
		}
		set({
			archiveItemsLoading: true,
			archiveItemsCommandId: commandId,
			archiveItemsBeforeId: beforeEventId ?? null,
		});
	},
	loadAudit: (beforeCreatedAt) => {
		const commandId = sendSessionCommand("history:audit", { beforeCreatedAt });
		if (!commandId) {
			toast.error(t("play.notConnected"));
			return;
		}
		set({
			auditLoading: true,
			auditCommandId: commandId,
			auditBeforeAt: beforeCreatedAt ?? null,
		});
	},
	setCatalog: (input) => {
		set((state) => ({
			catalogScenes: input.scenes ?? state.catalogScenes,
			catalogTracks: input.tracks ?? state.catalogTracks,
			catalogHandouts: input.handouts ?? state.catalogHandouts,
		}));
	},
	setConnected: (connected) => set({ connected }),
	setTerminal: (terminal) => set({ terminal }),
	setThemeId: (themeId) => set({ themeId }),
	markEnded: () => set({ status: "ended" }),
	markHandoutRead: (grantId) =>
		set((state) => ({
			handouts: state.handouts.map((item) =>
				item.grantId === grantId ? { ...item, read: true } : item,
			),
		})),
	dismissCheck: (requestId) =>
		set((state) =>
			state.dismissedChecks.includes(requestId)
				? {}
				: { dismissedChecks: [...state.dismissedChecks, requestId] },
		),
	resumeChecks: () => set({ dismissedChecks: [] }),
	setMuted: (muted) => {
		writeLocalMuted(muted);
		set({ muted });
	},
	setLocalVolume: (localVolume) => {
		const next = normalizeLocalVolume(localVolume);
		writeLocalVolume(next);
		set({ localVolume: next });
	},
	clearSeCue: () => set({ seCue: null }),
	reset: () =>
		set({ ...empty, localVolume: readLocalVolume(), muted: readLocalMuted() }),
}));
