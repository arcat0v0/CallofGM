import { z } from "zod";
import { ChatMessageDto } from "./chat";
import { SessionPhase } from "./session";

export const HISTORY_DEFAULT_LIMIT = 50;
export const HISTORY_MAX_LIMIT = 100;
export const ARCHIVE_DEFAULT_LIMIT = 50;
export const ARCHIVE_MAX_LIMIT = 200;
export const AUDIT_DEFAULT_LIMIT = 50;
export const AUDIT_MAX_LIMIT = 200;

export const HistoryPageQuery = z.object({
	beforeEventId: z.number().int().min(1).optional(),
	limit: z.number().int().min(1).max(HISTORY_MAX_LIMIT).optional(),
});
export type HistoryPageQuery = z.infer<typeof HistoryPageQuery>;

export const HistoryChatItem = z.object({
	kind: z.literal("chat"),
	eventId: z.number().int(),
	occurredAt: z.number().int().optional(),
	archivedAt: z.number().int().nullable().optional(),
	message: ChatMessageDto,
});
export type HistoryChatItem = z.infer<typeof HistoryChatItem>;

export const HistoryActivityItem = z.object({
	kind: z.literal("activity"),
	eventId: z.number().int(),
	type: z.string(),
	occurredAt: z.number().int(),
	archivedAt: z.number().int().nullable().optional(),
	payload: z.unknown(),
});
export type HistoryActivityItem = z.infer<typeof HistoryActivityItem>;

export const HistoryItem = z.discriminatedUnion("kind", [
	HistoryChatItem,
	HistoryActivityItem,
]);
export type HistoryItem = z.infer<typeof HistoryItem>;

export const HistoryCursor = z.object({
	beforeEventId: z.number().int().nullable(),
	hasMore: z.boolean(),
});
export type HistoryCursor = z.infer<typeof HistoryCursor>;

export const HistoryPage = HistoryCursor.extend({
	items: z.array(HistoryItem),
});
export type HistoryPage = z.infer<typeof HistoryPage>;

export const HistoryPageReply = z.object({ history: HistoryPage });
export type HistoryPageReply = z.infer<typeof HistoryPageReply>;

export const RewindPreviewQuery = z.object({
	anchorEventId: z.number().int().min(1),
});
export type RewindPreviewQuery = z.infer<typeof RewindPreviewQuery>;

export const RewindPreview = z.object({
	anchorEventId: z.number().int(),
	anchorOccurredAt: z.number().int(),
	messageCount: z.number().int().min(0),
	activityCount: z.number().int().min(0),
	pendingCount: z.number().int().min(0),
	revokedHandoutTitles: z.array(z.string()),
	revertedCheckCount: z.number().int().min(0),
	characterChanges: z.array(
		z.object({ characterId: z.string(), name: z.string() }),
	),
	phaseChange: z.object({ from: SessionPhase, to: SessionPhase }).nullable(),
	sceneChange: z
		.object({ fromName: z.string().nullable(), toName: z.string().nullable() })
		.nullable(),
	hasCheckpoint: z.boolean(),
});
export type RewindPreview = z.infer<typeof RewindPreview>;

export const RewindCommand = z.object({
	anchorEventId: z.number().int().min(1),
	reason: z.string().trim().max(500).optional(),
});
export type RewindCommand = z.infer<typeof RewindCommand>;

export const UndoRewindCommand = z.object({
	rewindId: z.string().min(1),
	reason: z.string().trim().max(500).optional(),
});
export type UndoRewindCommand = z.infer<typeof UndoRewindCommand>;

export const RewindEvent = z.object({
	action: z.enum(["rewind", "undo"]),
	rewindId: z.string(),
	anchorEventId: z.number().int(),
	anchorOccurredAt: z.number().int(),
	archivedMessageCount: z.number().int().min(0),
	archivedEventCount: z.number().int().min(0),
	discardedPendingCount: z.number().int().min(0),
	reason: z.string().nullable(),
	undoneRewindId: z.string().nullable().optional(),
});
export type RewindEvent = z.infer<typeof RewindEvent>;

export const HistoryArchiveGroup = z.object({
	id: z.string(),
	action: z.enum(["rewind", "undo"]),
	createdAt: z.number().int(),
	anchorEventId: z.number().int(),
	anchorOccurredAt: z.number().int(),
	reason: z.string().nullable(),
	undoneAt: z.number().int().nullable(),
	targetRewindId: z.string().nullable(),
	archivedMessageCount: z.number().int(),
	archivedEventCount: z.number().int(),
});
export type HistoryArchiveGroup = z.infer<typeof HistoryArchiveGroup>;

export const HistoryArchiveReply = z.object({
	groups: z.array(HistoryArchiveGroup),
});
export type HistoryArchiveReply = z.infer<typeof HistoryArchiveReply>;

export const HistoryArchiveItemsQuery = z.object({
	rewindId: z.string().min(1),
	beforeEventId: z.number().int().min(1).optional(),
	limit: z.number().int().min(1).max(ARCHIVE_MAX_LIMIT).optional(),
});
export type HistoryArchiveItemsQuery = z.infer<typeof HistoryArchiveItemsQuery>;

export const HistoryArchiveItemsReply = z.object({
	items: z.array(HistoryItem),
	hasMore: z.boolean(),
	beforeEventId: z.number().int().nullable(),
});
export type HistoryArchiveItemsReply = z.infer<typeof HistoryArchiveItemsReply>;

export const HistoryAuditQuery = z.object({
	beforeCreatedAt: z.number().int().min(1).optional(),
	limit: z.number().int().min(1).max(AUDIT_MAX_LIMIT).optional(),
});
export type HistoryAuditQuery = z.infer<typeof HistoryAuditQuery>;

export const HistoryAuditReply = z.object({
	items: z.array(ChatMessageDto),
	hasMore: z.boolean(),
	beforeCreatedAt: z.number().int().nullable(),
});
export type HistoryAuditReply = z.infer<typeof HistoryAuditReply>;

export const SnapshotRewindNotice = z.object({
	id: z.string(),
	action: z.enum(["rewind", "undo"]),
	eventId: z.number().int(),
	anchorEventId: z.number().int(),
	occurredAt: z.number().int(),
});
export type SnapshotRewindNotice = z.infer<typeof SnapshotRewindNotice>;
