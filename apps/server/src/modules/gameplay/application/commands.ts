import {
  RollDiceCommand,
  PerformCheckCommand,
  CreateCheckRequestCommand,
  RespondCheckRequestCommand,
  EditCharacterStateCommand,
  type CheckRequestDto,
  type SessionPhase,
  type RuleId,
} from "@cogm/shared";
import type {
  CommandHandler,
  CommandHandlerContext,
  CommandHandlerResult,
  ProducedEvent,
} from "@/modules/realtime";
import { AppError } from "@/platform/errors/app-error";
import { ForbiddenError } from "@/modules/identity";
import { SessionPhaseForbidsActionError, SessionStateInvalidError } from "@/modules/sessions";
import { CharacterNotFoundError } from "@/modules/characters";
import { canPlayerInitiateDiceRoll } from "@/modules/chat";
import { parseDiceExpression, rollDice, formatExpression, formatRollDetail } from "@/rules/dice-engine";
import type { RuleRegistry } from "@/rules/registry";
import type { RuleSystem } from "@/rules/rule-system";
import {
  SkillNotFoundError,
  CheckRequestNotFoundError,
  CheckRequestAlreadyResolvedError,
  InvalidSanLossExpressionError,
} from "../domain/errors";
import { DrizzleGameplayRepository } from "../infrastructure/drizzle-gameplay-repository";

// ---------- 共享辅助 ----------

interface LoadedCharacterContext {
  character: { id: string; name: string; kind: string; ruleId: string; sheetJson: string };
  sessionCharacter: { kind: string; stateJson: string };
  rule: RuleSystem<unknown, unknown>;
  sheet: unknown;
  state: unknown;
}

/** 加载人物卡 + 团内状态 + 规则系统，并完成规则 schema 校验（读写两侧防历史数据漂移） */
async function loadCharacterContext(
  ctx: CommandHandlerContext,
  repo: DrizzleGameplayRepository,
  characterId: string,
  ruleRegistry: RuleRegistry
): Promise<LoadedCharacterContext> {
  const character = await repo.findCharacter(characterId);
  if (!character) {
    throw new CharacterNotFoundError();
  }
  const sessionCharacter = await repo.findSessionCharacter(ctx.sessionId, characterId);
  if (!sessionCharacter) {
    throw new CharacterNotFoundError("Character is not participating in this session");
  }

  const rule = ruleRegistry.get(character.ruleId as RuleId);

  let sheet: unknown;
  try {
    sheet = rule.characterSheetSchema.parse(JSON.parse(character.sheetJson));
  } catch {
    throw new SessionStateInvalidError(`Character sheet of ${character.name} failed rule schema validation`);
  }

  let state: unknown;
  try {
    state = rule.sessionStateSchema.parse(JSON.parse(sessionCharacter.stateJson));
  } catch {
    throw new SessionStateInvalidError(`Session state of ${character.name} failed rule schema validation`);
  }

  return {
    character,
    sessionCharacter,
    rule,
    sheet,
    state,
  };
}

/** 持久化新状态并生成 state:changed（按 PC/NPC 可见性）与 state:hint（仅 GM）事件 */
async function persistStateAndBuildEvents(
  ctx: CommandHandlerContext,
  repo: DrizzleGameplayRepository,
  characterId: string,
  kind: string,
  newState: unknown,
  hints: string[],
  visibilityOverride?: { type: "gmOnly" }
): Promise<ProducedEvent[]> {
  await repo.updateSessionCharacterState(ctx.sessionId, characterId, JSON.stringify(newState));

  const events: ProducedEvent[] = [
    {
      type: "state:changed",
      payload: { characterId, kind: kind === "npc" ? "npc" : "pc", state: newState },
      visibility: visibilityOverride ?? (kind === "npc" ? { type: "gmOnly" } : { type: "public" }),
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

function checkVisibilityScope(hidden: boolean, kind: string): { type: "gmOnly" } | { type: "public" } {
  // 暗骰仅 GM 可见；NPC 的鉴定结果含精确数值，同样仅 GM 可见
  if (hidden || kind === "npc") {
    return { type: "gmOnly" };
  }
  return { type: "public" };
}

function assertPlayerCanRoll(ctx: CommandHandlerContext): void {
  if (ctx.actor.type === "gm") {
    return;
  }
  const allowed = canPlayerInitiateDiceRoll(
    ctx.session.phase as SessionPhase,
    ctx.actor.type,
    ctx.seat?.role ?? null
  );
  if (!allowed) {
    throw new SessionPhaseForbidsActionError("Current phase forbids player-initiated rolls");
  }
}

// ---------- dice:roll ----------

export class RollDiceHandler implements CommandHandler {
  readonly type = "dice:roll" as const;

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    const parsed = RollDiceCommand.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }
    const input = parsed.data;

    const isGm = ctx.actor.type === "gm";
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

// ---------- check:perform ----------

export class PerformCheckHandler implements CommandHandler {
  readonly type = "check:perform" as const;

  constructor(private readonly ruleRegistry: RuleRegistry) {}

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    const parsed = PerformCheckCommand.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }
    const input = parsed.data;

    const isGm = ctx.actor.type === "gm";
    if (!isGm) {
      if (input.hidden) {
        throw new ForbiddenError("Only the GM can roll hidden checks");
      }
      if (ctx.seat?.characterId !== input.characterId) {
        throw new ForbiddenError("Players can only check with their claimed character");
      }
      assertPlayerCanRoll(ctx);
    }
    const hidden = isGm && input.hidden === true;

    const repo = new DrizzleGameplayRepository(ctx.tx);
    const { character, sessionCharacter, rule, sheet, state } = await loadCharacterContext(
      ctx,
      repo,
      input.characterId,
      this.ruleRegistry
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
      ctx.randomSource
    ) as { success: boolean };

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

    // 常规成功及以上：写入成长标记
    if (result.success) {
      const newState = rule.markSkillGrowth(state, input.skillKey);
      const stateEvents = await persistStateAndBuildEvents(
        ctx,
        repo,
        input.characterId,
        sessionCharacter.kind,
        newState,
        [],
        hidden ? { type: "gmOnly" } : undefined
      );
      events.push(...stateEvents);
    }

    return { events, replyPayload: { rolled: true, hidden } };
  }
}

// ---------- check:request ----------

export class CreateCheckRequestHandler implements CommandHandler {
  readonly type = "check:request" as const;

  constructor(private readonly ruleRegistry: RuleRegistry) {}

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    if (ctx.actor.type !== "gm") {
      throw new ForbiddenError("Only the GM can create check requests");
    }
    const parsed = CreateCheckRequestCommand.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }
    const input = parsed.data;

    const repo = new DrizzleGameplayRepository(ctx.tx);

    // SAN 检定表达式 "成功损失/失败损失" 必须预先可解析
    let successLoss: string | null = null;
    let failureLoss: string | null = null;
    if (input.sanLossExpression) {
      const parts = input.sanLossExpression.split("/");
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
      successLoss = parts[0].trim();
      failureLoss = parts[1].trim();
    }

    // 确认目标人物在本团中（同时完成人物卡/状态 schema 校验）
    await loadCharacterContext(ctx, repo, input.characterId, this.ruleRegistry);

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
      sanLossExpression: input.sanLossExpression ?? null,
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
      sanLossExpression: input.sanLossExpression ?? null,
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

// ---------- check:respond ----------

export class RespondCheckRequestHandler implements CommandHandler {
  readonly type = "check:respond" as const;

  constructor(private readonly ruleRegistry: RuleRegistry) {}

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    const parsed = RespondCheckRequestCommand.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }
    const repo = new DrizzleGameplayRepository(ctx.tx);

    const request = await repo.findCheckRequest(parsed.data.requestId);
    if (!request || request.sessionId !== ctx.sessionId) {
      throw new CheckRequestNotFoundError();
    }
    if (request.status !== "pending") {
      throw new CheckRequestAlreadyResolvedError();
    }

    const isGm = ctx.actor.type === "gm";
    if (!isGm && ctx.seat?.characterId !== request.characterId) {
      throw new ForbiddenError("Only the targeted player can respond to this request");
    }

    const { character, sessionCharacter, rule, sheet, state } = await loadCharacterContext(
      ctx,
      repo,
      request.characterId,
      this.ruleRegistry
    );

    const hidden = request.hidden === 1;
    const events: ProducedEvent[] = [];
    let resultJson: string;

    if (request.sanLossExpression) {
      // 理智检定：对当前 SAN 掷骰，按成败扣减并广播
      const parts = request.sanLossExpression.split("/");
      const sanCurrent = rule.getSanCurrent(state);
      const sanResult = rule.evaluateSanCheck(
        {
          characterId: request.characterId,
          sanCurrent,
          successLoss: parts[0]!.trim(),
          failureLoss: parts[1]!.trim(),
        },
        ctx.randomSource
      ) as { loss: number };

      resultJson = JSON.stringify(sanResult);
      const casOk = await repo.resolveCheckRequestIfPending(request.id, resultJson);
      if (!casOk) {
        throw new CheckRequestAlreadyResolvedError();
      }

      events.push({
        type: "check:resolved",
        payload: {
          requestId: request.id,
          characterId: request.characterId,
          characterName: character.name,
          skillKey: request.skillKey,
          hidden,
          result: sanResult,
        },
        visibility: checkVisibilityScope(hidden, sessionCharacter.kind),
      });

      const mutated = rule.applySanLoss(state, sanResult.loss) as {
        state: unknown;
        hints: string[];
      };
      const stateEvents = await persistStateAndBuildEvents(
        ctx,
        repo,
        request.characterId,
        sessionCharacter.kind,
        mutated.state,
        mutated.hints,
        hidden ? { type: "gmOnly" } : undefined
      );
      events.push(...stateEvents);
    } else {
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
        ctx.randomSource
      ) as { success: boolean };

      resultJson = JSON.stringify(skillResult);
      const casOk = await repo.resolveCheckRequestIfPending(request.id, resultJson);
      if (!casOk) {
        throw new CheckRequestAlreadyResolvedError();
      }

      events.push({
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
      });

      if (skillResult.success) {
        const newState = rule.markSkillGrowth(state, request.skillKey);
        const stateEvents = await persistStateAndBuildEvents(
          ctx,
          repo,
          request.characterId,
          sessionCharacter.kind,
          newState,
          [],
          hidden ? { type: "gmOnly" } : undefined
        );
        events.push(...stateEvents);
      }
    }

    // 暗骰：发起玩家仅收到"已掷出"回执，结果仅 GM 可见
    return {
      events,
      replyPayload: { rolled: true, hidden },
    };
  }
}

// ---------- state:edit ----------

export class EditCharacterStateHandler implements CommandHandler {
  readonly type = "state:edit" as const;

  constructor(private readonly ruleRegistry: RuleRegistry) {}

  async execute(ctx: CommandHandlerContext, payload: unknown): Promise<CommandHandlerResult> {
    if (ctx.actor.type !== "gm") {
      throw new ForbiddenError("Only the GM can edit character state");
    }
    const parsed = EditCharacterStateCommand.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.message, 400);
    }
    const input = parsed.data;

    const repo = new DrizzleGameplayRepository(ctx.tx);
    const { sessionCharacter, rule, state } = await loadCharacterContext(
      ctx,
      repo,
      input.characterId,
      this.ruleRegistry
    );

    const { characterId, ...editFields } = input;
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
      mutated.hints
    );

    return { events, replyPayload: { ok: true } };
  }
}

export function createGameplayCommandHandlers(ruleRegistry: RuleRegistry): CommandHandler[] {
  return [
    new RollDiceHandler(),
    new PerformCheckHandler(ruleRegistry),
    new CreateCheckRequestHandler(ruleRegistry),
    new RespondCheckRequestHandler(ruleRegistry),
    new EditCharacterStateHandler(ruleRegistry),
  ];
}
