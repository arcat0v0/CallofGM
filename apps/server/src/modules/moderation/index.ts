import { createModerationCommandHandlers as createRawHandlers } from "./application/commands";
import { DrizzleModerationRepository } from "./infrastructure/drizzle-moderation-repository";
import { DrizzleSessionsRepository } from "@/modules/sessions";
import type { DbClient } from "@/platform/db/client";
import type { ModerationRepository, SessionKickStore } from "./application/ports";
import type { CommandHandler } from "@/modules/realtime";

export function createModerationCommandHandlers(
  repoFactory: (tx: DbClient) => ModerationRepository = (tx) => new DrizzleModerationRepository(tx),
  kickStoreFactory: (tx: DbClient) => SessionKickStore = (tx) => new DrizzleSessionsRepository(tx)
): CommandHandler[] {
  return createRawHandlers(repoFactory, kickStoreFactory);
}
export {
  KickPlayerHandler,
  UnkickPlayerHandler,
  BanFingerprintHandler,
  UnbanFingerprintHandler,
  PlayerNotFoundError,
} from "./application/commands";
export { DrizzleModerationRepository } from "./infrastructure/drizzle-moderation-repository";
