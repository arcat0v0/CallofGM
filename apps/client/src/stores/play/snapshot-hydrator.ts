import {
	SessionSettingsDefaults,
	type SessionSnapshotPayload,
} from "@cogm/shared";
import { toast } from "sonner";
import { t } from "@/i18n";
import { mapChatMessage } from "@/lib/chat-map";
import { mapHistoryItems, mergeMessages } from "./slices/chat-slice";
import { keepUnappliedStageExpressions } from "./slices/stage-slice";
import type { PlayState } from "./types";

export function hydrateSnapshot(
	previous: PlayState,
	payload: SessionSnapshotPayload,
	watermark: number,
): Partial<PlayState> {
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
		...mapChatMessage(dto, payload.characters),
		pending: true,
	}));
	const ownRejected = (payload.ownRejectedMessages ?? []).map((dto) => ({
		...mapChatMessage(dto, payload.characters),
		rejected: true,
		rejectionReason: dto.rejectionReason ?? null,
	}));
	const merged = mergeMessages(
		[],
		[
			...mapHistoryItems(payload.recentHistory, payload.characters, {
				isGm: payload.viewer.isGm,
			}),
			...ownPending,
			...ownRejected,
		],
	);
	const sameSession = previous.sessionId === payload.session.id;
	const activeCharIds = new Set(
		payload.characters.map((character) => character.characterId),
	);
	const preservedDraft =
		sameSession && previous.stageDraft
			? {
					...previous.stageDraft,
					items: previous.stageDraft.items.filter((item) =>
						activeCharIds.has(item.characterId),
					),
				}
			: null;
	const nextStageLiveRevision = sameSession
		? previous.stageLiveRevision + 1
		: 0;
	return {
		sessionId: payload.session.id,
		moduleId: payload.session.moduleId,
		moduleName: payload.session.moduleName,
		ruleId: payload.session.ruleId,
		sessionName: payload.session.name,
		themeId: payload.session.themeId,
		status: payload.session.status,
		phase: payload.session.phase,
		lastEventId: watermark,
		settings: {
			...SessionSettingsDefaults,
			...payload.session.settings,
		},
		portraitLayout: payload.session.portraitLayout ?? "auto",
		portraitScale: payload.session.portraitScale ?? "md",
		stageComposition: payload.session.stageComposition ?? null,
		stagePresets: payload.stagePresets ?? [],
		stageDraft: preservedDraft,
		stageExpressionDraft: sameSession
			? keepUnappliedStageExpressions(
					previous.stageExpressionDraft,
					payload.characters,
				)
			: {},
		stageLiveRevision: nextStageLiveRevision,
		stageDraftBaseRevision: sameSession
			? previous.stageDraftBaseRevision
			: nextStageLiveRevision,
		viewer: {
			isGm: payload.viewer.isGm,
			seatRole: payload.viewer.seatRole,
			holderKind: payload.viewer.holderKind ?? null,
			holderId: payload.viewer.holderId ?? null,
		},
		characters: payload.characters,
		ruleState: payload.ruleState ?? null,
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
	};
}
