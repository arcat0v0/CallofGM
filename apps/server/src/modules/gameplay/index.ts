import { createGameplayCommandHandlers as createRawHandlers } from "./application/commands";
import { DrizzleGameplayRepository } from "./infrastructure/drizzle-gameplay-repository";
import type { DbClient } from "@/platform/db/client";
import type { GameplayRepository } from "./application/ports";
import type { RuleRegistry } from "@/rules/registry";
import type { CommandHandler } from "@/modules/realtime";

export function createGameplayCommandHandlers(
  ruleRegistry: RuleRegistry,
  repoFactory: (tx: DbClient) => GameplayRepository = (tx) => new DrizzleGameplayRepository(tx)
): CommandHandler[] {
  return createRawHandlers(ruleRegistry, repoFactory);
}
export {
  RollDiceHandler,
  PerformCheckHandler,
  PerformSanCheckHandler,
  CreateCheckRequestHandler,
  RespondCheckRequestHandler,
  EditCharacterStateHandler,
} from "./application/commands";
export * from "./domain/errors";
export { DrizzleGameplayRepository } from "./infrastructure/drizzle-gameplay-repository";
