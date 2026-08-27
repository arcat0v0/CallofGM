import { createChatCommandHandlers as createRawHandlers } from "./application/commands";
import { DrizzleChatRepository } from "./infrastructure/drizzle-chat-repository";
import type { DbClient } from "@/platform/db/client";
import type { ChatRepository } from "./application/ports";
import type { CommandHandler } from "@/modules/realtime";

export function createChatCommandHandlers(
  repoFactory: (tx: DbClient) => ChatRepository = (tx) => new DrizzleChatRepository(tx)
): CommandHandler[] {
  return createRawHandlers(repoFactory);
}
export {
  SendChatMessageHandler,
  ReleaseChatMessageHandler,
  DiscardChatMessageHandler,
  ReorderChatQueueHandler,
} from "./application/commands";
export { decideChatMessage, canPlayerInitiateDiceRoll, type MessageDecision } from "./domain/message-policy";
export * from "./domain/errors";
export { DrizzleChatRepository } from "./infrastructure/drizzle-chat-repository";
