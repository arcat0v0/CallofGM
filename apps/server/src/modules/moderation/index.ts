import type { CommandHandler } from "@/modules/realtime";
import { DrizzleSessionsRepository } from "@/modules/sessions";
import type { DbClient } from "@/platform/db/client";
import { createModerationCommandHandlers as createRawHandlers } from "./application/commands";
import type {
	ModerationRepository,
	SessionKickStore,
} from "./application/ports";
import { DrizzleModerationRepository } from "./infrastructure/drizzle-moderation-repository";

export function createModerationCommandHandlers(
	repoFactory: (tx: DbClient) => ModerationRepository = (tx) =>
		new DrizzleModerationRepository(tx),
	kickStoreFactory: (tx: DbClient) => SessionKickStore = (tx) =>
		new DrizzleSessionsRepository(tx),
): CommandHandler[] {
	return createRawHandlers(repoFactory, kickStoreFactory);
}
export {
	BanFingerprintHandler,
	KickPlayerHandler,
	PlayerNotFoundError,
	UnbanFingerprintHandler,
	UnkickPlayerHandler,
} from "./application/commands";
export { DrizzleModerationRepository } from "./infrastructure/drizzle-moderation-repository";
