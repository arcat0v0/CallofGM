import type { CommandHandler } from "@/modules/realtime";
import type { DbClient } from "@/platform/db/client";
import { createHandoutCommandHandlers as createRawHandlers } from "./application/commands";
import type { HandoutsRepository } from "./application/ports";
import { DrizzleHandoutsRepository } from "./infrastructure/drizzle-handouts-repository";

export function createHandoutCommandHandlers(
	repoFactory: (tx: DbClient) => HandoutsRepository = (tx) =>
		new DrizzleHandoutsRepository(tx),
): CommandHandler[] {
	return createRawHandlers(repoFactory);
}
export {
	AppendHandoutRecipientsHandler,
	GrantHandoutHandler,
	ReadHandoutHandler,
} from "./application/commands";
export { buildHandoutGrantOverview } from "./application/grant-overview";
export * from "./domain/errors";
export { DrizzleHandoutsRepository } from "./infrastructure/drizzle-handouts-repository";
