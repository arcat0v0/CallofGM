import type { CommandHandler } from "@/modules/realtime";
import type { DbClient } from "@/platform/db/client";
import { createChatCommandHandlers as createRawHandlers } from "./application/commands";
import type { ChatRepository } from "./application/ports";
import { DrizzleChatRepository } from "./infrastructure/drizzle-chat-repository";

export function createChatCommandHandlers(
	repoFactory: (tx: DbClient) => ChatRepository = (tx) =>
		new DrizzleChatRepository(tx),
): CommandHandler[] {
	return createRawHandlers(repoFactory);
}
export {
	DiscardChatMessageHandler,
	ReleaseChatMessageHandler,
	ReorderChatQueueHandler,
	RestoreChatMessageHandler,
	SendChatMessageHandler,
} from "./application/commands";
export * from "./domain/errors";
export { DrizzleChatRepository } from "./infrastructure/drizzle-chat-repository";
