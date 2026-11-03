import type { CommandHandler } from "@/modules/realtime";
import type { DbClient } from "@/platform/db/client";
import type { RuleRegistry } from "@/rules/registry";
import { createGameplayCommandHandlers as createRawHandlers } from "./application/commands";
import type { GameplayRepository } from "./application/ports";
import { DrizzleGameplayRepository } from "./infrastructure/drizzle-gameplay-repository";

export function createGameplayCommandHandlers(
	ruleRegistry: RuleRegistry,
	repoFactory: (tx: DbClient) => GameplayRepository = (tx) =>
		new DrizzleGameplayRepository(tx),
): CommandHandler[] {
	return createRawHandlers(ruleRegistry, repoFactory);
}
export {
	CreateCheckRequestHandler,
	EditCharacterStateHandler,
	PerformCheckHandler,
	PerformSanCheckHandler,
	RespondCheckRequestHandler,
	RollDiceHandler,
} from "./application/commands";
export * from "./domain/errors";
export { DrizzleGameplayRepository } from "./infrastructure/drizzle-gameplay-repository";
