import { z } from "zod";
import { ChatMessageDto } from "./chat";

export const HISTORY_DEFAULT_LIMIT = 50;
export const HISTORY_MAX_LIMIT = 100;

export const HistoryPageQuery = z.object({
  beforeEventId: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(HISTORY_MAX_LIMIT).optional(),
});
export type HistoryPageQuery = z.infer<typeof HistoryPageQuery>;

export const HistoryChatItem = z.object({
  kind: z.literal("chat"),
  eventId: z.number().int(),
  message: ChatMessageDto,
});
export type HistoryChatItem = z.infer<typeof HistoryChatItem>;

export const HistoryActivityItem = z.object({
  kind: z.literal("activity"),
  eventId: z.number().int(),
  type: z.string(),
  occurredAt: z.number().int(),
  payload: z.unknown(),
});
export type HistoryActivityItem = z.infer<typeof HistoryActivityItem>;

export const HistoryItem = z.discriminatedUnion("kind", [HistoryChatItem, HistoryActivityItem]);
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
