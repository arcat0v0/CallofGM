import { createHandoutCommandHandlers as createRawHandlers } from "./application/commands";
import { DrizzleHandoutsRepository } from "./infrastructure/drizzle-handouts-repository";
import type { DbClient } from "@/platform/db/client";
import type { HandoutsRepository } from "./application/ports";
import type { CommandHandler } from "@/modules/realtime";

export function createHandoutCommandHandlers(
  repoFactory: (tx: DbClient) => HandoutsRepository = (tx) => new DrizzleHandoutsRepository(tx)
): CommandHandler[] {
  return createRawHandlers(repoFactory);
}
export {
  GrantHandoutHandler,
  AppendHandoutRecipientsHandler,
  ReadHandoutHandler,
} from "./application/commands";
export * from "./domain/errors";
export { DrizzleHandoutsRepository } from "./infrastructure/drizzle-handouts-repository";
