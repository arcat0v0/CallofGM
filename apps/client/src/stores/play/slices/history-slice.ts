import {
	type ChatMessageDto,
	HISTORY_DEFAULT_LIMIT,
	type HistoryArchiveGroup,
	type HistoryItem,
	type RewindPreview,
	type SnapshotRewindNotice,
} from "@cogm/shared";
import { toast } from "sonner";
import { t } from "@/i18n";
import { sendSessionCommand } from "@/lib/session-socket";
import type { PlaySliceCreator } from "../types";

export type HistorySlice = {
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
	loadOlderHistory: () => void;
	requestRewindPreview: (anchorEventId: number) => void;
	clearRewindPreview: () => void;
	requestRewind: (anchorEventId: number, reason?: string) => void;
	requestUndoRewind: (rewindId: string, reason?: string) => void;
	loadArchiveGroups: () => void;
	loadArchiveItems: (rewindId: string, beforeEventId?: number) => void;
	loadAudit: (beforeCreatedAt?: number) => void;
};

export const historyDefaults = {
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

export const createHistorySlice: PlaySliceCreator<HistorySlice> = (
	set,
	get,
) => ({
	...historyDefaults,
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
});
