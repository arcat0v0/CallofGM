import { z } from "zod";
import { MessageChannel } from "./session";

// ---------- commands ----------

export const SendChatMessageCommand = z.object({
	channel: MessageChannel,
	content: z.string().min(1).max(2000),
	expressionKey: z.string().max(64).optional(),
	characterId: z.string().min(1).optional(),
});
export type SendChatMessageCommand = z.infer<typeof SendChatMessageCommand>;

export const ReleaseChatMessageCommand = z.object({
	messageId: z.string().min(1),
});
export type ReleaseChatMessageCommand = z.infer<
	typeof ReleaseChatMessageCommand
>;

export const DiscardChatMessageCommand = z.object({
	messageId: z.string().min(1),
	reason: z.string().trim().max(500).optional(),
});
export type DiscardChatMessageCommand = z.infer<
	typeof DiscardChatMessageCommand
>;

export const ReorderChatQueueCommand = z.object({
	messageIds: z.array(z.string().min(1)).max(200),
});
export type ReorderChatQueueCommand = z.infer<typeof ReorderChatQueueCommand>;

export const RestoreChatMessageCommand = z.object({
	messageId: z.string().min(1),
});
export type RestoreChatMessageCommand = z.infer<
	typeof RestoreChatMessageCommand
>;

// ---------- events & DTO ----------

export const ChatMessageStatus = z.enum(["pending", "presented", "discarded"]);
export type ChatMessageStatus = z.infer<typeof ChatMessageStatus>;

export const ChatMessageDto = z.object({
	id: z.string(),
	sessionId: z.string(),
	senderId: z.string().nullable(),
	senderType: z.enum(["gm", "player"]),
	characterId: z.string().nullable(),
	characterName: z.string().nullable(),
	channel: MessageChannel,
	content: z.string(),
	expressionKey: z.string().nullable(),
	queueOrder: z.number().int(),
	eventId: z.number().int().nullable(),
	presentedAt: z.number().int().nullable(),
	createdAt: z.number().int(),
	rejectionReason: z.string().nullable().optional(),
});
export type ChatMessageDto = z.infer<typeof ChatMessageDto>;

/** DirectControlMessage: chat:pending（仅发送给消息作者） */
export const ChatPendingMessage = z.object({
	message: ChatMessageDto,
});
export type ChatPendingMessage = z.infer<typeof ChatPendingMessage>;

/** DirectControlMessage: chat:rejected（仅发送给消息作者） */
export const ChatRejectedMessage = z.object({
	messageId: z.string(),
	reason: z.string().nullable(),
});
export type ChatRejectedMessage = z.infer<typeof ChatRejectedMessage>;

/** Event payload: chat:message（已呈现的消息，分配 eventId 后广播） */
export const ChatMessageEvent = z.object({
	message: ChatMessageDto,
});
export type ChatMessageEvent = z.infer<typeof ChatMessageEvent>;

/** GM 专用 DirectControlMessage: chat:queue（待呈现队列 + 已丢弃历史，无 eventId） */
export const ChatQueueMessage = z.object({
	messages: z.array(ChatMessageDto),
	discarded: z.array(ChatMessageDto).optional(),
});
export type ChatQueueMessage = z.infer<typeof ChatQueueMessage>;
