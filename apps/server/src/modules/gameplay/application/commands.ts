import {
	type CheckRequestDto,
	CreateCheckRequestCommand,
	canPlayerInitiateDiceRoll,
	EditCharacterStateCommand,
	PerformCheckCommand,
	PerformSanCheckCommand,
	RespondCheckRequestCommand,
	RollDiceCommand,
	type RuleId,
	type SessionPhase,
} from "@cogm/shared";
import { CharacterNotFoundError } from "@/modules/characters";
import { ForbiddenError } from "@/modules/identity";
import type {
	CommandHandler,
	CommandHandlerContext,
	CommandHandlerResult,
	ProducedEvent,
} from "@/modules/realtime";
import {
	SessionPhaseForbidsActionError,
	SessionStateInvalidError,
} from "@/modules/sessions";
import type { DbClient } from "@/platform/db/client";
import { AppError } from "@/platform/errors/app-error";
import { validationFailed } from "@/platform/errors/validation";
import {
	formatExpression,
	formatRollDetail,
	parseDiceExpression,
	rollDice,
} from "@/rules/dice-engine";
import type { RuleRegistry } from "@/rules/registry";
import type { RuleSystem } from "@/rules/rule-system";
import {
	CheckRequestAlreadyResolvedError,
	CheckRequestNotFoundError,
	InvalidSanLossExpressionError,
	SkillNotFoundError,
} from "../domain/errors";
import type { GameplayRepository } from "./ports";

interface LoadedCharacterContext {
	character: {
		id: string;
		name: string;
		kind: string;
		ruleId: string;
		sheetJson: string;
	};
	sessionCharacter: { kind: string; stateJson: string };
	rule: RuleSystem<unknown, unknown>;
	sheet: unknown;
	state: unknown;
}

async function loadCharacterContext(
	ctx: CommandHandlerContext,
	repo: GameplayRepository,
	characterId: string,
	ruleRegistry: RuleRegistry,
): Promise<LoadedCharacterContext> {
	const character = await repo.findCharacter(characterId);
	if (!character) {
		throw new CharacterNotFoundError();
	}
	const sessionCharacter = await repo.findSessionCharacter(
		ctx.sessionId,
		characterId,
	);
	if (!sessionCharacter) {
		throw new CharacterNotFoundError(
			"Character is not participating in this session",
		);
	}

	const rule = ruleRegistry.get(character.ruleId as RuleId);

	let sheet: unknown;
	try {
		sheet = rule.characterSheetSchema.parse(JSON.parse(character.sheetJson));
	} catch {
		throw new SessionStateInvalidError(
			`Character sheet of ${character.name} failed rule schema validation`,
		);
	}

	let state: unknown;
	try {
		state = rule.sessionStateSchema.parse(
			JSON.parse(sessionCharacter.stateJson),
		);
	} catch {
		throw new SessionStateInvalidError(
			`Session state of ${character.name} failed rule schema validation`,
		);
	}

	return { character, sessionCharacter, rule, sheet, state };
}

/** 持久化新状态并生成 state:changed（PC 全员可见 / NPC 仅 GM）与 state:hint（仅 GM） */
async function persistStateAndBuildEvents(
	ctx: CommandHandlerContext,
	repo: GameplayRepository,
	characterId: string,
	kind: string,
	newState: unknown,
	hints: string[],
	rule: RuleSystem<unknown, unknown>,
	hidden: boolean,
	obSeePcState: boolean,
): Promise<ProducedEvent[]> {
	await repo.updateSessionCharacterState(
		ctx.sessionId,
		characterId,
		JSON.stringify(newState),
	);

	const visibility = stateVisibilityScope(hidden, kind, obSeePcState);
	const events: ProducedEvent[] = [
		{
			type: "state:changed",
			payload: {
				characterId,
				kind: kind === "npc" ? "npc" : "pc",
				state: rule.viewSessionState(newState, {
					hidden: visibility.type === "gmOnly",
				}),
			},
			visibility,
		},
	];
	if (hints.length > 0) {
		events.push({
			type: "state:hint",
			payload: { characterId, hints },
			visibility: { type: "gmOnly" },
		});
	}
	return events;
}

function checkVisibilityScope(
	hidden: boolean,
	kind: string,
): { type: "gmOnly" } | { type: "public" } {
	if (hidden || kind === "npc") {
		return { type: "gmOnly" };
	}
	return { type: "public" };
}

function stateVisibilityScope(
	hidden: boolean,
	kind: string,
	obSeePcState: boolean,
): { type: "gmOnly" } | { type: "public" } | { type: "pcPlayers" } {
	if (hidden || kind === "npc") {
		return { type: "gmOnly" };
	}
	return obSeePcState ? { type: "public" } : { type: "pcPlayers" };
}

function assertPlayerCanRoll(ctx: CommandHandlerContext): void {
	if (ctx.actor.type === "user" && ctx.actor.role === "gm") {
		return;
	}
	const allowed = canPlayerInitiateDiceRoll(
		ctx.session.phase as SessionPhase,
		ctx.actor.type === "user" && ctx.actor.role === "gm" ? "gm" : "player",
		ctx.seat?.role ?? null,
	);
	if (!allowed) {
		throw new SessionPhaseForbidsActionError(
			"Current phase forbids player-initiated rolls",
		);
	}
}

function parseSanLossExpression(expression: string): {
	successLoss: string;
	failureLoss: string;
} {
	const parts = expression.split("/");
	if (parts.length !== 2 || !parts[0] || !parts[1]) {
		throw new InvalidSanLossExpressionError();
	}
	for (const part of parts) {
		if (!/^\d+$/.test(part.trim())) {
			try {
				parseDiceExpression(part);
			} catch {
				throw new InvalidSanLossExpressionError();
			}
		}
	}
	return { successLoss: parts[0].trim(), failureLoss: parts[1].trim() };
}

function isGrowthEligible(result: unknown): boolean {
	if (!result || typeof result !== "object") {
		return false;
	}
	const record = result as {
		growthEligible?: unknown;
		outcome?: unknown;
		success?: unknown;
	};
	if (typeof record.growthEligible === "boolean") {
		return record.growthEligible;
	}
	if (typeof record.outcome === "string") {
		return (
			record.outcome === "critical" ||
			record.outcome === "extreme_success" ||
			record.outcome === "hard_success" ||
			record.outcome === "regular_success"
		);
	}
	return record.success === true;
}

export class RollDiceHandler implements CommandHandler {
	readonly type = "dice:roll" as const;

	async execute(
		ctx: CommandHandlerContext,
		payload: unknown,
	): Promise<CommandHandlerResult> {
		const parsed = RollDiceCommand.safeParse(payload);
		if (!parsed.success) {
			throw validationFailed(parsed.error);
		}
		const input = parsed.data;

		const isGm = ctx.actor.type === "user" && ctx.actor.role === "gm";
		if (!isGm && input.hidden) {
			throw new ForbiddenError("Only the GM can roll hidden dice");
		}
		assertPlayerCanRoll(ctx);

		const term = parseDiceExpression(input.expression);
		const outcome = rollDice(term, ctx.randomSource);
		const hidden = isGm && input.hidden === true;

		const event: ProducedEvent = {
			type: "dice:rolled",
			payload: {
				rollerType: isGm ? "gm" : "player",
				rollerId: ctx.actor.type === "player" ? ctx.actor.playerId : null,
				characterId: ctx.seat?.characterId ?? null,
				characterName: null,
				hidden,
				result: {
					expression: formatExpression(term),
					detail: formatRollDetail(term, outcome),
					total: outcome.total,
					comment: input.comment,
				},
			},
			visibility: hidden ? { type: "gmOnly" } : { type: "public" },
		};

		return {
			events: [event],
			replyPayload: { rolled: true, total: outcome.total, hidden },
		};
	}
}

export class PerformCheckHandler implements CommandHandler {
	readonly type = "check:perform" as const;

	constructor(
		private readonly ruleRegistry: RuleRegistry,
		private readonly repoFactory: (tx: DbClient) => GameplayRepository,
	) {}

	async execute(
		ctx: CommandHandlerContext,
		payload: unknown,
	): Promise<CommandHandlerResult> {
		const parsed = PerformCheckCommand.safeParse(payload);
		if (!parsed.success) {
			throw validationFailed(parsed.error);
		}
		const input = parsed.data;

		const isGm = ctx.actor.type === "user" && ctx.actor.role === "gm";
		if (!isGm) {
			if (input.hidden) {
				throw new ForbiddenError("Only the GM can roll hidden checks");
			}
			if (ctx.seat?.characterId !== input.characterId) {
				throw new ForbiddenError(
					"Players can only check with their claimed character",
				);
			}
			assertPlayerCanRoll(ctx);
		}
		const hidden = isGm && input.hidden === true;

		const repo = this.repoFactory(ctx.tx);
		const { character, sessionCharacter, rule, sheet, state } =
			await loadCharacterContext(
				ctx,
				repo,
				input.characterId,
				this.ruleRegistry,
			);

		const targetValue = rule.getSkillTargetValue(sheet, input.skillKey);
		if (targetValue === null) {
			throw new SkillNotFoundError();
		}

		const result = rule.evaluateSkillCheck(
			{
				characterId: input.characterId,
				skillKey: input.skillKey,
				targetValue,
				difficulty: input.difficulty,
				bonusDice: input.bonusDice,
				penaltyDice: input.penaltyDice,
			},
			ctx.randomSource,
		);

		const events: ProducedEvent[] = [
			{
				type: "check:resolved",
				payload: {
					requestId: null,
					characterId: input.characterId,
					characterName: character.name,
					skillKey: input.skillKey,
					hidden,
					result,
				},
				visibility: checkVisibilityScope(hidden, sessionCharacter.kind),
			},
		];

		if (isGrowthEligible(result)) {
			const newState = hidden
				? rule.markSkillGrowthHidden(state, input.skillKey)
				: rule.markSkillGrowth(state, input.skillKey);
			events.push(
				...(await persistStateAndBuildEvents(
					ctx,
					repo,
					input.characterId,
					sessionCharacter.kind,
					newState,
					[],
					rule,
					hidden,
					ctx.session.obSeePcState === 1,
				)),
			);
		}

		return { events, replyPayload: { rolled: true, hidden } };
	}
}

/** GM 发起理智检定：立即判定、扣 SAN、广播。暗骰时结果与随之的状态变更都只发 GM。 */
export class PerformSanCheckHandler implements CommandHandler {
	readonly type = "check:san" as const;

	constructor(
		private readonly ruleRegistry: RuleRegistry,
		private readonly repoFactory: (tx: DbClient) => GameplayRepository,
	) {}

	async execute(
		ctx: CommandHandlerContext,
		payload: unknown,
	): Promise<CommandHandlerResult> {
		if (ctx.actor.type !== "user" || ctx.actor.role !== "gm") {
			throw new ForbiddenError("Only the GM can perform SAN checks");
		}
		const parsed = PerformSanCheckCommand.safeParse(payload);
		if (!parsed.success) {
			throw validationFailed(parsed.error);
		}
		const input = parsed.data;
		const { successLoss, failureLoss } = parseSanLossExpression(
			input.sanLossExpression,
		);
		const hidden = input.hidden === true;

		const repo = this.repoFactory(ctx.tx);
		const { character, sessionCharacter, rule, state } =
			await loadCharacterContext(
				ctx,
				repo,
				input.characterId,
				this.ruleRegistry,
			);

		const sanCurrent = rule.getSanCurrent(state);
		const sanResult = rule.evaluateSanCheck(
			{
				characterId: input.characterId,
				sanCurrent,
				successLoss,
				failureLoss,
			},
			ctx.randomSource,
		) as { loss: number };

		const events: ProducedEvent[] = [
			{
				type: "check:resolved",
				payload: {
					requestId: null,
					characterId: input.characterId,
					characterName: character.name,
					skillKey: "san",
					hidden,
					result: sanResult,
				},
				visibility: checkVisibilityScope(hidden, sessionCharacter.kind),
			},
		];

		const mutated = rule.applySanLoss(state, sanResult.loss) as {
			state: unknown;
			hints: string[];
		};
		events.push(
			...(await persistStateAndBuildEvents(
				ctx,
				repo,
				input.characterId,
				sessionCharacter.kind,
				mutated.state,
				mutated.hints,
				rule,
				hidden,
				ctx.session.obSeePcState === 1,
			)),
		);

		return { events, replyPayload: { rolled: true, hidden } };
	}
}

export class CreateCheckRequestHandler implements CommandHandler {
	readonly type = "check:request" as const;

	constructor(
		private readonly ruleRegistry: RuleRegistry,
		private readonly repoFactory: (tx: DbClient) => GameplayRepository,
	) {}

	async execute(
		ctx: CommandHandlerContext,
		payload: unknown,
	): Promise<CommandHandlerResult> {
		if (ctx.actor.type !== "user" || ctx.actor.role !== "gm") {
			throw new ForbiddenError("Only the GM can create check requests");
		}
		const parsed = CreateCheckRequestCommand.safeParse(payload);
		if (!parsed.success) {
			throw validationFailed(parsed.error);
		}
		const input = parsed.data;
		const repo = this.repoFactory(ctx.tx);
		const { sessionCharacter, rule, sheet } = await loadCharacterContext(
			ctx,
			repo,
			input.characterId,
			this.ruleRegistry,
		);

		if (sessionCharacter.kind !== "pc") {
			throw new AppError(
				"VALIDATION_FAILED",
				"Check requests can only target PC characters",
				400,
			);
		}
		if (rule.getSkillTargetValue(sheet, input.skillKey) === null) {
			throw new SkillNotFoundError();
		}

		const now = ctx.clock.nowEpochMs();
		const requestId = ctx.idGenerator.nextId();
		await repo.insertCheckRequest({
			id: requestId,
			sessionId: ctx.sessionId,
			characterId: input.characterId,
			skillKey: input.skillKey,
			difficulty: input.difficulty,
			bonusDice: input.bonusDice,
			penaltyDice: input.penaltyDice,
			hidden: input.hidden === true ? 1 : 0,
			sanLossExpression: null,
			status: "pending",
			resolvedCheckResultJson: null,
			createdAt: now,
		});

		const requestDto: CheckRequestDto = {
			id: requestId,
			sessionId: ctx.sessionId,
			characterId: input.characterId,
			skillKey: input.skillKey,
			difficulty: input.difficulty,
			bonusDice: input.bonusDice,
			penaltyDice: input.penaltyDice,
			hidden: input.hidden === true,
			sanLossExpression: null,
			status: "pending",
			createdAt: now,
		};

		return {
			events: [
				{
					type: "check:requested",
					payload: { request: requestDto },
					visibility: { type: "selectedPcIds", pcIds: [input.characterId] },
				},
			],
			replyPayload: { requestId },
		};
	}
}

export class RespondCheckRequestHandler implements CommandHandler {
	readonly type = "check:respond" as const;

	constructor(
		private readonly ruleRegistry: RuleRegistry,
		private readonly repoFactory: (tx: DbClient) => GameplayRepository,
	) {}

	async execute(
		ctx: CommandHandlerContext,
		payload: unknown,
	): Promise<CommandHandlerResult> {
		const parsed = RespondCheckRequestCommand.safeParse(payload);
		if (!parsed.success) {
			throw validationFailed(parsed.error);
		}
		const repo = this.repoFactory(ctx.tx);

		const request = await repo.findCheckRequest(parsed.data.requestId);
		if (!request || request.sessionId !== ctx.sessionId) {
			throw new CheckRequestNotFoundError();
		}
		if (request.status !== "pending") {
			throw new CheckRequestAlreadyResolvedError();
		}

		const isGm = ctx.actor.type === "user" && ctx.actor.role === "gm";
		if (!isGm && ctx.seat?.characterId !== request.characterId) {
			throw new ForbiddenError(
				"Only the targeted player can respond to this request",
			);
		}

		const { character, sessionCharacter, rule, sheet, state } =
			await loadCharacterContext(
				ctx,
				repo,
				request.characterId,
				this.ruleRegistry,
			);

		const hidden = request.hidden === 1;
		const targetValue = rule.getSkillTargetValue(sheet, request.skillKey);
		if (targetValue === null) {
			throw new SkillNotFoundError();
		}
		const skillResult = rule.evaluateSkillCheck(
			{
				characterId: request.characterId,
				skillKey: request.skillKey,
				targetValue,
				difficulty: request.difficulty as "regular" | "hard" | "extreme",
				bonusDice: request.bonusDice,
				penaltyDice: request.penaltyDice,
			},
			ctx.randomSource,
		);

		const resultJson = JSON.stringify(skillResult);
		const casOk = await repo.resolveCheckRequestIfPending(
			request.id,
			resultJson,
		);
		if (!casOk) {
			throw new CheckRequestAlreadyResolvedError();
		}

		const events: ProducedEvent[] = [
			{
				type: "check:resolved",
				payload: {
					requestId: request.id,
					characterId: request.characterId,
					characterName: character.name,
					skillKey: request.skillKey,
					hidden,
					result: skillResult,
				},
				visibility: checkVisibilityScope(hidden, sessionCharacter.kind),
			},
		];

		if (isGrowthEligible(skillResult)) {
			const newState = hidden
				? rule.markSkillGrowthHidden(state, request.skillKey)
				: rule.markSkillGrowth(state, request.skillKey);
			events.push(
				...(await persistStateAndBuildEvents(
					ctx,
					repo,
					request.characterId,
					sessionCharacter.kind,
					newState,
					[],
					rule,
					hidden,
					ctx.session.obSeePcState === 1,
				)),
			);
		}

		return {
			events,
			replyPayload: { requestId: request.id, rolled: true, hidden },
		};
	}
}

export class EditCharacterStateHandler implements CommandHandler {
	readonly type = "state:edit" as const;

	constructor(
		private readonly ruleRegistry: RuleRegistry,
		private readonly repoFactory: (tx: DbClient) => GameplayRepository,
	) {}

	async execute(
		ctx: CommandHandlerContext,
		payload: unknown,
	): Promise<CommandHandlerResult> {
		if (ctx.actor.type !== "user" || ctx.actor.role !== "gm") {
			throw new ForbiddenError("Only the GM can edit character state");
		}
		const parsed = EditCharacterStateCommand.safeParse(payload);
		if (!parsed.success) {
			throw validationFailed(parsed.error);
		}
		const input = parsed.data;

		const repo = this.repoFactory(ctx.tx);
		const { sessionCharacter, rule, state } = await loadCharacterContext(
			ctx,
			repo,
			input.characterId,
			this.ruleRegistry,
		);

		const { characterId: _characterId, ...editFields } = input;
		const mutated = rule.applyGmStateEdit(state, editFields) as {
			state: unknown;
			hints: string[];
		};

		const events = await persistStateAndBuildEvents(
			ctx,
			repo,
			input.characterId,
			sessionCharacter.kind,
			mutated.state,
			mutated.hints,
			rule,
			false,
			ctx.session.obSeePcState === 1,
		);

		return { events, replyPayload: { ok: true } };
	}
}

export function createGameplayCommandHandlers(
	ruleRegistry: RuleRegistry,
	repoFactory: (tx: DbClient) => GameplayRepository,
): CommandHandler[] {
	return [
		new RollDiceHandler(),
		new PerformCheckHandler(ruleRegistry, repoFactory),
		new PerformSanCheckHandler(ruleRegistry, repoFactory),
		new CreateCheckRequestHandler(ruleRegistry, repoFactory),
		new RespondCheckRequestHandler(ruleRegistry, repoFactory),
		new EditCharacterStateHandler(ruleRegistry, repoFactory),
	];
}
