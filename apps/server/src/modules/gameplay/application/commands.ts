import {
	type CheckAmendedEvent,
	type CheckRequestDto,
	CreateCheckRequestCommand,
	canPlayerInitiateDiceRoll,
	type DiceSealedEvent,
	EditCharacterStateCommand,
	type LuckRecoveredEvent,
	PerformCheckCommand,
	PerformLuckRecoveryCommand,
	PerformSanCheckCommand,
	RespondCheckRequestCommand,
	RollDiceCommand,
	RuleActionCommand,
	type RuleId,
	type SessionPhase,
	SpendLuckCommand,
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
	requireLuckCapability,
	requireSanityCheckCapability,
} from "@/rules/capabilities";
import {
	formatExpression,
	formatRollDetail,
	parseDiceExpression,
	rollDice,
} from "@/rules/dice-engine";
import type { RuleRegistry } from "@/rules/registry";
import {
	type CheckInput,
	type RuleMutation,
	type RuleRuntime,
	type RuleSystem,
	type RuntimeCharacter,
	unsupportedRuleAction,
} from "@/rules/rule-system";
import {
	CheckRequestAlreadyResolvedError,
	CheckRequestNotFoundError,
	InvalidSanLossExpressionError,
	LuckSpendAlreadyUsedError,
	LuckSpendInsufficientError,
	LuckSpendInvalidPointsError,
	LuckSpendNotAllowedError,
	LuckSpendNotLatestError,
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
	sessionCharacter: { name: string; kind: string; stateJson: string };
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
	if (character.ruleId !== ctx.session.ruleId) throw new CharacterNotFoundError();

	const rule = ruleRegistry.get(character.ruleId as RuleId);

	let sheet: unknown;
	try {
		sheet = rule.characterSheetSchema.parse(JSON.parse(sessionCharacter.sheetJson));
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

function buildRuleRuntime(ctx: CommandHandlerContext, repo: GameplayRepository, registry: RuleRegistry, hidden = false, requested = false) {
	const cache = new Map<string, LoadedCharacterContext>();
	const runtime: RuleRuntime<unknown, unknown> = {
		isGm: ctx.actor.type === "user" && ctx.actor.role === "gm",
		requested,
		hidden,
		random: ctx.randomSource,
		ruleState: ctx.session.ruleStateJson ? JSON.parse(ctx.session.ruleStateJson) : null,
		async findCharacter(id) {
			let loaded = cache.get(id);
			if (!loaded) {
				try {
					loaded = await loadCharacterContext(ctx, repo, id, registry);
				} catch (error) {
					if (error instanceof CharacterNotFoundError) return null;
					throw error;
				}
				cache.set(id, loaded);
			}
			return runtimeCharacter(loaded);
		},
	};
	return runtime;
}

function runtimeCharacter(loaded: LoadedCharacterContext): RuntimeCharacter<unknown, unknown> {
	return { id: loaded.character.id, name: loaded.sessionCharacter.name, kind: loaded.sessionCharacter.kind === "npc" ? "npc" : "pc", sheet: loaded.sheet, state: loaded.state };
}

function checkInput(
	input: {
		options?: unknown;
		difficulty: string;
		bonusDice: number;
		penaltyDice: number;
	},
	payload: unknown = input,
): CheckInput {
	if (input.options !== undefined) return { options: input.options };
	if (payload === null || typeof payload !== "object") return undefined;
	if (
		!(
			"difficulty" in payload ||
			"bonusDice" in payload ||
			"penaltyDice" in payload
		)
	)
		return undefined;
	const { difficulty, bonusDice, penaltyDice } = input;
	return { legacy: { difficulty, bonusDice, penaltyDice } };
}

async function persistRuleMutations(ctx: CommandHandlerContext, repo: GameplayRepository, rule: RuleSystem<unknown, unknown>, runtime: RuleRuntime<unknown, unknown>, mutations: RuleMutation<unknown>[] | undefined, eventIsPrivate: boolean) {
	const events: ProducedEvent[] = [];
	for (const mutation of mutations ?? []) {
		const character = await runtime.findCharacter(mutation.characterId);
		if (!character) throw new CharacterNotFoundError();
		const updates = await persistStateAndBuildEvents(ctx, repo, mutation.characterId, character.kind, mutation.state, mutation.hints, rule, eventIsPrivate, ctx.session.obSeePcState === 1);
		events.push(...updates);
	}
	return events;
}

function parseNpcPublicStateFields(fieldsJson: string | undefined): string[] {
	try {
		const parsed: unknown = JSON.parse(fieldsJson ?? "[]");
		return Array.isArray(parsed)
			? parsed.filter((field): field is string => typeof field === "string")
			: [];
	} catch {
		return [];
	}
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

	const isNpc = kind === "npc";
	const publicStateFields = isNpc
		? parseNpcPublicStateFields(
				(await repo.findSessionCharacter(ctx.sessionId, characterId))
					?.publicStateFieldsJson,
			)
		: [];
	const publicState = isNpc
		? rule.projectPublicSessionState(newState, publicStateFields)
		: undefined;
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
				...(isNpc
					? {
							publicState,
							publicStateFields,
						}
					: {}),
			},
			visibility,
		},
	];
	if (isNpc && !hidden && publicStateFields.length > 0) {
		events.push({
			type: "state:public-changed",
			payload: {
				characterId,
				kind: "npc",
				state: publicState,
			},
			visibility: { type: "playerOnly" },
		});
	}
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

function sealedDiceEvent(
	activityType: DiceSealedEvent["activityType"],
): DiceSealedEvent {
	return { activityType, rollerType: "gm", hidden: true };
}

function withSealedDiceEvent(
	events: ProducedEvent[],
	activityType: DiceSealedEvent["activityType"],
	hidden: boolean,
): ProducedEvent[] {
	if (!hidden) return events;
	return [
		...events,
		{
			type: "dice:sealed",
			payload: sealedDiceEvent(activityType),
			visibility: { type: "playerOnly" },
		},
	];
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
					rolls: outcome.rolls,
					comment: input.comment,
				},
			},
			visibility: hidden ? { type: "gmOnly" } : { type: "public" },
		};

		return {
			events: withSealedDiceEvent([event], "dice:rolled", hidden),
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
		const loaded = await loadCharacterContext(ctx, repo, input.characterId, this.ruleRegistry);
		const { sessionCharacter, rule } = loaded;
		const runtime = buildRuleRuntime(ctx, repo, this.ruleRegistry, hidden);
		const { result, mutations } = await rule.resolveCheck(
			runtimeCharacter(loaded),
			input.skillKey,
			checkInput(input, payload),
			runtime,
		);

		const events: ProducedEvent[] = withSealedDiceEvent(
			[
				{
					type: "check:resolved",
					payload: {
						requestId: null,
						characterId: input.characterId,
						characterName: sessionCharacter.name,
						skillKey: input.skillKey,
						hidden,
						result,
					},
					visibility: checkVisibilityScope(hidden, sessionCharacter.kind),
				},
			],
			"check:resolved",
			hidden,
		);

		events.push(...await persistRuleMutations(ctx, repo, rule, runtime, mutations, hidden));

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

		const sanRule = requireSanityCheckCapability(rule);
		const sanCurrent = sanRule.getSanCurrent(state);
		const sanResult = sanRule.evaluateSanCheck(
			{
				characterId: input.characterId,
				sanCurrent,
				successLoss,
				failureLoss,
			},
			ctx.randomSource,
		);

		const events: ProducedEvent[] = withSealedDiceEvent(
			[
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
			],
			"check:resolved",
			hidden,
		);

		const mutated = sanRule.applySanLoss(state, sanResult.loss);
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
		const loaded = await loadCharacterContext(
			ctx,
			repo,
			input.characterId,
			this.ruleRegistry,
		);
		const { sessionCharacter, rule } = loaded;

		if (sessionCharacter.kind !== "pc") {
			throw new AppError(
				"VALIDATION_FAILED",
				"Check requests can only target PC characters",
				400,
			);
		}
		const runtime = buildRuleRuntime(
			ctx,
			repo,
			this.ruleRegistry,
			input.hidden === true,
			true,
		);
		const options = await rule.validateCheckOptions(
			runtimeCharacter(loaded),
			input.skillKey,
			checkInput(input, payload),
			runtime,
		);

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
			optionsJson: options === undefined ? null : JSON.stringify(options),
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
			...(options === undefined ? {} : { options }),
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

		const loaded = await loadCharacterContext(ctx, repo, request.characterId, this.ruleRegistry);
		const { sessionCharacter, rule } = loaded;
		const hidden = request.hidden === 1;
		const runtime = buildRuleRuntime(
			ctx,
			repo,
			this.ruleRegistry,
			hidden,
			true,
		);
		const input = request.optionsJson
			? { options: JSON.parse(request.optionsJson) }
			: checkInput(request);
		const { result: skillResult, mutations } = await rule.resolveCheck(
			runtimeCharacter(loaded),
			request.skillKey,
			input,
			runtime,
		);

		const resultJson = JSON.stringify(skillResult);
		const casOk = await repo.resolveCheckRequestIfPending(
			request.id,
			resultJson,
		);
		if (!casOk) {
			throw new CheckRequestAlreadyResolvedError();
		}

		const events: ProducedEvent[] = withSealedDiceEvent(
			[
				{
					type: "check:resolved",
					payload: {
						requestId: request.id,
						characterId: request.characterId,
						characterName: sessionCharacter.name,
						skillKey: request.skillKey,
						hidden,
						result: skillResult,
					},
					visibility: checkVisibilityScope(hidden, sessionCharacter.kind),
				},
			],
			"check:resolved",
			hidden,
		);

		events.push(...await persistRuleMutations(ctx, repo, rule, runtime, mutations, hidden));

		return {
			events,
			replyPayload: { requestId: request.id, rolled: true, hidden },
		};
	}
}

/** 玩家花费自己的幸运，修正最近一次自己的检定结果。 */
export class SpendLuckHandler implements CommandHandler {
	readonly type = "check:spend-luck" as const;

	constructor(
		private readonly ruleRegistry: RuleRegistry,
		private readonly repoFactory: (tx: DbClient) => GameplayRepository,
	) {}

	async execute(
		ctx: CommandHandlerContext,
		payload: unknown,
	): Promise<CommandHandlerResult> {
		const parsed = SpendLuckCommand.safeParse(payload);
		if (!parsed.success) {
			throw validationFailed(parsed.error);
		}
		const input = parsed.data;

		const isGm = ctx.actor.type === "user" && ctx.actor.role === "gm";
		if (isGm) {
			throw new ForbiddenError("The GM cannot spend a player's luck");
		}
		if (
			ctx.seat?.role !== "pc" ||
			ctx.seat.characterId !== input.characterId
		) {
			throw new ForbiddenError(
				"Players can only spend luck on their own character's checks",
			);
		}

		const repo = this.repoFactory(ctx.tx);
		const { character, sessionCharacter, rule, state } =
			await loadCharacterContext(
				ctx,
				repo,
				input.characterId,
				this.ruleRegistry,
			);
		if (sessionCharacter.kind !== "pc") {
			throw new LuckSpendNotAllowedError(
				"Only player character checks can be amended",
			);
		}

		const recent = await repo.findRecentCheckEvents(ctx.sessionId, 200);
		const entries: Array<{
			eventId: number;
			type: string;
			payload: Record<string, unknown>;
		}> = [];
		for (const row of recent) {
			try {
				const value: unknown = JSON.parse(row.payloadJson);
				if (value && typeof value === "object") {
					entries.push({
						eventId: row.eventId,
						type: row.type,
						payload: value as Record<string, unknown>,
					});
				}
			} catch {
				continue;
			}
		}

		const latest = entries.find(
			(entry) =>
				entry.type === "check:resolved" &&
				entry.payload.characterId === input.characterId,
		);
		if (!latest || latest.eventId !== input.eventId) {
			throw new LuckSpendNotLatestError();
		}
		if (latest.payload.hidden === true) {
			throw new LuckSpendNotAllowedError(
				"Hidden checks cannot be amended by players",
			);
		}
		const alreadyAmended = entries.some(
			(entry) =>
				entry.type === "check:amended" &&
				entry.payload.amendsEventId === input.eventId,
		);
		if (alreadyAmended) {
			throw new LuckSpendAlreadyUsedError();
		}

		const luckRule = requireLuckCapability(rule);
		const luckCurrent = luckRule.getLuckCurrent(state);
		if (input.points > luckCurrent) {
			throw new LuckSpendInsufficientError();
		}
		const mutated = luckRule.spendLuckOnCheck(
			state,
			latest.payload.result,
			input.points,
		);
		const amended = mutated.result;
		if (
			amended.luckSpent !== input.points ||
			typeof amended.luckAfter !== "number"
		) {
			throw new LuckSpendInvalidPointsError();
		}

		const amendedPayload: CheckAmendedEvent = {
			amendsEventId: input.eventId,
			characterId: input.characterId,
			characterName: character.name,
			skillKey:
				typeof latest.payload.skillKey === "string"
					? latest.payload.skillKey
					: "",
			hidden: false,
			result: mutated.result,
		};
		const events: ProducedEvent[] = [
			{
				type: "check:amended",
				payload: amendedPayload,
				visibility: checkVisibilityScope(false, sessionCharacter.kind),
			},
		];
		events.push(
			...(await persistStateAndBuildEvents(
				ctx,
				repo,
				input.characterId,
				sessionCharacter.kind,
				mutated.state,
				[],
				rule,
				false,
				ctx.session.obSeePcState === 1,
			)),
		);

		return {
			events,
			replyPayload: {
				ok: true,
				luckSpent: amended.luckSpent,
				luckAfter: amended.luckAfter,
			},
		};
	}
}

/** GM 手动发起幸运恢复检定：团进行中或团后可用。 */
export class LuckRecoverHandler implements CommandHandler {
	readonly type = "luck:recover" as const;
	readonly allowWhenEnded = true;

	constructor(
		private readonly ruleRegistry: RuleRegistry,
		private readonly repoFactory: (tx: DbClient) => GameplayRepository,
	) {}

	async execute(
		ctx: CommandHandlerContext,
		payload: unknown,
	): Promise<CommandHandlerResult> {
		if (ctx.actor.type !== "user" || ctx.actor.role !== "gm") {
			throw new ForbiddenError("Only the GM can recover luck");
		}
		const parsed = PerformLuckRecoveryCommand.safeParse(payload);
		if (!parsed.success) {
			throw validationFailed(parsed.error);
		}
		const input = parsed.data;

		const repo = this.repoFactory(ctx.tx);
		const { character, sessionCharacter, rule, state } =
			await loadCharacterContext(
				ctx,
				repo,
				input.characterId,
				this.ruleRegistry,
			);
		if (sessionCharacter.kind !== "pc") {
			throw new AppError(
				"VALIDATION_FAILED",
				"Luck recovery only applies to player characters",
				400,
			);
		}

		const recovered = requireLuckCapability(rule).recoverLuck(
			state,
			ctx.randomSource,
		);
		const recoveredPayload: LuckRecoveredEvent = {
			characterId: input.characterId,
			characterName: character.name,
			roll: recovered.roll,
			luckBefore: recovered.before,
			luckAfter: recovered.after,
			gain: recovered.gain,
		};
		const events: ProducedEvent[] = [
			{
				type: "luck:recovered",
				payload: recoveredPayload,
				visibility: checkVisibilityScope(false, sessionCharacter.kind),
			},
		];
		events.push(
			...(await persistStateAndBuildEvents(
				ctx,
				repo,
				input.characterId,
				sessionCharacter.kind,
				recovered.state,
				[],
				rule,
				false,
				ctx.session.obSeePcState === 1,
			)),
		);

		return {
			events,
			replyPayload: {
				ok: true,
				roll: recovered.roll,
				gain: recovered.gain,
				luckAfter: recovered.after,
			},
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

class RuleActionHandler implements CommandHandler {
	readonly type = "rule:action" as const;

	constructor(private readonly registry: RuleRegistry, private readonly repoFactory: (tx: DbClient) => GameplayRepository) {}

	async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
		const parsed = RuleActionCommand.safeParse(payload);
		if (!parsed.success) throw validationFailed(parsed.error);
		const repo = this.repoFactory(ctx.tx);
		const runtime = buildRuleRuntime(ctx, repo, this.registry);
		if (!runtime.isGm && (!parsed.data.characterId || ctx.seat?.role !== "pc" || ctx.seat.characterId !== parsed.data.characterId)) throw new ForbiddenError("Players can only act with their claimed character");
		assertPlayerCanRoll(ctx);
		const rule = this.registry.get(ctx.session.ruleId);
		if (!rule.applyRuleAction) unsupportedRuleAction();
		const update = await rule.applyRuleAction(parsed.data, runtime);
		const events = await persistRuleMutations(ctx, repo, rule, runtime, update.mutations, false);
		if (update.ruleState !== undefined) {
			await repo.updateSessionRuleState(
				ctx.sessionId,
				update.ruleState === null ? null : JSON.stringify(update.ruleState),
			);
			events.push({
				type: "rule:state-changed",
				payload: { ruleId: rule.id, state: update.ruleState },
				visibility: { type: "public" },
			});
		}
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
		new SpendLuckHandler(ruleRegistry, repoFactory),
		new LuckRecoverHandler(ruleRegistry, repoFactory),
		new EditCharacterStateHandler(ruleRegistry, repoFactory),
		new RuleActionHandler(ruleRegistry, repoFactory),
	];
}
