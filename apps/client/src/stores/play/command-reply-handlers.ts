import {
	HistoryArchiveItemsReply,
	HistoryArchiveReply,
	HistoryAuditReply,
	HistoryPageReply,
	RewindPreview,
	type ServerMessage,
} from "@cogm/shared";
import { toast } from "sonner";
import { t } from "@/i18n";
import { errorCopy } from "@/lib/error-copy";
import { formatClock, initialsOf } from "@/lib/format";
import { getRuleComponent } from "@/rules/registry";
import {
	appendMessage,
	mapHistoryItems,
	mergeMessages,
} from "./slices/chat-slice";
import {
	isEventPayload,
	type PlayGet,
	type PlaySet,
	type PlayState,
} from "./types";

const COMMAND_ERROR_TOAST_ID = "session-command-error";

export function showCommandError(message: string): void {
	toast.error(message, {
		id: COMMAND_ERROR_TOAST_ID,
		position: "bottom-left",
		closeButton: true,
	});
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

export function applyCommandReply(
	set: PlaySet,
	get: PlayGet,
	message: ServerMessage,
): void {
	const payload = isEventPayload(message.payload) ? message.payload : {};
	const commandId =
		"commandId" in message && typeof message.commandId === "string"
			? message.commandId
			: "";
	if (message.type === "command:rejected") {
		const errorMsg = errorCopy({
			code: typeof payload.code === "string" ? payload.code : null,
		});
		showCommandError(errorMsg);
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
					mapHistoryItems(page.items, state.characters, {
						isGm: state.viewer.isGm,
					}),
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
	const archiveItemsReply = HistoryArchiveItemsReply.safeParse(message.payload);
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
}
