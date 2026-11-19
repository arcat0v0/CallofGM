import type {
	ChatMessageDto,
	HistoryPage,
	SnapshotCharacter,
} from "@cogm/shared";
import { toast } from "sonner";
import type { ChatMessage } from "@/features/chat/types";
import { t } from "@/i18n";
import {
	mapActivityEvent,
	mapChatMessage,
	mapHistoryItem,
} from "@/lib/chat-map";
import { isEventPayload, type PlaySet, type PlayState } from "../types";

export type ChatSlice = {
	messages: ChatMessage[];
	pendingQueue: ChatMessageDto[];
	discardedQueue: ChatMessageDto[];
};

export const chatDefaults: ChatSlice = {
	messages: [],
	pendingQueue: [],
	discardedQueue: [],
};

export function appendMessage(
	messages: ChatMessage[],
	next: ChatMessage | null,
): ChatMessage[] {
	if (!next) {
		return messages;
	}
	const index = messages.findIndex((message) => message.id === next.id);
	if (index !== -1) {
		const current = messages[index];
		if (next.eventId !== undefined && (current?.eventId ?? 0) < next.eventId) {
			return messages.map((message, itemIndex) =>
				itemIndex === index ? next : message,
			);
		}
		return messages;
	}
	return [...messages, next];
}

export function appendLiveMessage(
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

export function mergeMessages(
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
		const existing = byId.get(message.id);
		if (
			!existing ||
			(message.eventId !== undefined &&
				(existing.eventId ?? 0) < message.eventId)
		) {
			byId.set(message.id, message);
		}
	}
	return [...byId.values()].sort((a, b) => a.sortKey - b.sortKey);
}

export function mapHistoryItems(
	items: HistoryPage["items"],
	characters: SnapshotCharacter[],
	viewer: { isGm?: boolean } = {},
): ChatMessage[] {
	return items
		.map((item) => mapHistoryItem(item, characters, viewer))
		.filter((message): message is ChatMessage => message !== null);
}

export function withActivityMessage(
	state: PlayState,
	type: string,
	payload: unknown,
	eventId: number | undefined,
	occurredAt: number | undefined,
	patch: Partial<PlayState>,
	characters: SnapshotCharacter[] = state.characters,
): Partial<PlayState> {
	const message = mapActivityEvent(
		type,
		payload,
		eventId ?? Date.now(),
		occurredAt,
		characters,
		{ isGm: state.viewer.isGm },
	);
	return message
		? { ...patch, messages: appendMessage(state.messages, message) }
		: patch;
}

export function applyPendingChat(set: PlaySet, rawPayload: unknown): void {
	const payload = isEventPayload(rawPayload) ? rawPayload : {};
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
}

export function applyRejectedChat(set: PlaySet, rawPayload: unknown): void {
	const payload = isEventPayload(rawPayload) ? rawPayload : {};
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
}

export function applyChatQueue(set: PlaySet, rawPayload: unknown): void {
	const payload = rawPayload as {
		messages?: ChatMessageDto[];
		discarded?: ChatMessageDto[];
	};
	set({
		pendingQueue: payload.messages ?? [],
		...(payload.discarded ? { discardedQueue: payload.discarded } : {}),
	});
}
