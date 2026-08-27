import { createModerationCommandHandlers as createRawHandlers } from "./application/commands";
import { DrizzleModerationRepository } from "./infrastructure/drizzle-moderation-repository";
import type { DbClient } from "@/platform/db/client";
import type { ModerationRepository } from "./application/ports";
import type { CommandHandler } from "@/modules/realtime";

export function createModerationCommandHandlers(
  repoFactory: (tx: DbClient) => ModerationRepository = (tx) => new DrizzleModerationRepository(tx)
): CommandHandler[] {
  return createRawHandlers(repoFactory);
}
export {
  KickPlayerHandler,
  BanFingerprintHandler,
  UnbanFingerprintHandler,
  PlayerNotFoundError,
} from "./application/commands";
export { DrizzleModerationRepository } from "./infrastructure/drizzle-moderation-repository";
