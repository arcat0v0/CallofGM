import type { RuleId } from "@cogm/shared";
import type { IdGenerator, Clock } from "@/platform/ports";
import type { RuleRegistry } from "@/rules/registry";
import type { SessionsRepository } from "./ports";
import { CharacterNotFoundError } from "@/modules/characters";
import { ModuleNotFoundError } from "@/modules/catalog";
import {
  SessionNotFoundError,
  SessionStateInvalidError,
  SeatAlreadyClaimedError,
  CharacterAlreadyParticipatingError,
  CharacterNotInModuleError,
} from "../domain/errors";
import type { TransactionRunner } from "@/platform/db/transaction";
import type { SessionEventBus } from "@/modules/realtime";

function normaliseSessionName(name: string | null | undefined): string | null {
  if (typeof name !== "string") {
    return null;
  }
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class CreateSessionUseCase {
  constructor(
    private readonly repo: SessionsRepository,
    private readonly ruleRegistry: RuleRegistry,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: { moduleId: string; characterIds: string[]; name?: string }) {
    const moduleRecord = await this.repo.findModuleById(input.moduleId);
    if (!moduleRecord) {
      throw new ModuleNotFoundError();
    }

    if (new Set(input.characterIds).size !== input.characterIds.length) {
      throw new CharacterAlreadyParticipatingError("Duplicate character IDs provided");
    }

    const loadedCharacters = await this.repo.findCharactersByIds(input.characterIds);
    if (loadedCharacters.length !== input.characterIds.length) {
      throw new CharacterNotFoundError("One or more characters not found");
    }
    if (loadedCharacters.some((character) => character.ruleId !== moduleRecord.ruleId)) {
      throw new SessionStateInvalidError("Every character must use the module's rule system");
    }
    if (input.characterIds.length > 0) {
      const linkedIds = await this.repo.findLinkedCharacterIds(input.moduleId, input.characterIds);
      if (linkedIds.length !== input.characterIds.length) {
        throw new CharacterNotInModuleError();
      }
    }

    const sessionId = this.idGenerator.nextId();
    const now = this.clock.nowEpochMs();

    const session = {
      id: sessionId,
      name: normaliseSessionName(input.name),
      moduleId: input.moduleId,
      status: "waiting" as const,
      phase: "free_discussion" as const,
      currentSceneId: null,
      lastEventId: 0,
      sharePcSheets: 1,
      obSeePcState: 1,
      createdAt: now,
    };

    const sessionChars = loadedCharacters.map((char) => {
      const ruleSystem = this.ruleRegistry.get(moduleRecord.ruleId as RuleId);
      const parsedSheet = ruleSystem.characterSheetSchema.parse(JSON.parse(char.sheetJson));
      const initialState = ruleSystem.initializeSessionState(parsedSheet) as Record<string, unknown>;

      initialState.sessionId = sessionId;
      initialState.characterId = char.id;

      return {
        id: this.idGenerator.nextId(),
        sessionId,
        characterId: char.id,
        kind: char.kind,
        currentExpressionKey: null,
        stateJson: JSON.stringify(initialState),
        createdAt: now,
      };
    });

    await this.repo.createSession(session, sessionChars);

    return {
      session,
      characters: sessionChars,
    };
  }
}

export class ClaimSeatUseCase {
  constructor(
    private readonly repo: SessionsRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: {
    sessionId: string;
    playerId: string;
    role: "pc" | "ob";
    characterId?: string;
  }) {
    const session = await this.repo.findSessionById(input.sessionId);
    if (!session) {
      throw new SessionNotFoundError();
    }
    if (session.status === "ended") {
      if (input.role !== "ob") {
        throw new SessionStateInvalidError("Cannot claim PC seat in an ended session");
      }
    }

    if (input.role === "pc") {
      if (!input.characterId) {
        throw new SessionStateInvalidError("Character ID is required for pc role");
      }

      const kind = await this.repo.findSessionCharacterKind(input.sessionId, input.characterId);
      if (!kind) {
        throw new CharacterNotFoundError("Character not participating in this session");
      }
      if (kind !== "pc") {
        throw new SessionStateInvalidError("Only PC seats can be claimed");
      }

      const activeClaim = await this.repo.findActiveClaimByCharacterId(input.sessionId, input.characterId);
      if (activeClaim && activeClaim.playerId !== input.playerId) {
        throw new SeatAlreadyClaimedError("This character's seat is already claimed");
      }
    }

    const now = this.clock.nowEpochMs();

    const claim = {
      id: this.idGenerator.nextId(),
      sessionId: input.sessionId,
      playerId: input.playerId,
      role: input.role,
      characterId: input.role === "pc" ? input.characterId || null : null,
      releasedAt: null,
      createdAt: now,
    };

    const claimed = await this.repo.replacePlayerClaim(claim, now);
    if (!claimed) {
      throw new SeatAlreadyClaimedError("This character's seat is already claimed");
    }
    return claim;
  }
}

export class ReleaseSeatUseCase {
  constructor(
    private readonly repo: SessionsRepository,
    private readonly clock: Clock
  ) {}

  async execute(input: { sessionId: string; playerId: string }) {
    const session = await this.repo.findSessionById(input.sessionId);
    if (!session) {
      throw new SessionNotFoundError();
    }
    const now = this.clock.nowEpochMs();
    await this.repo.releasePlayerClaims(input.sessionId, input.playerId, now);
    return { success: true };
  }
}

export class UpdateSessionStatusUseCase {
  constructor(
    private readonly repo: SessionsRepository,
    private readonly transactionRunner: TransactionRunner,
    private readonly eventBus: SessionEventBus,
    private readonly afterEnded?: (sessionId: string) => void
  ) {}

  async execute(input: { sessionId: string; status: "waiting" | "preparing" | "active" | "ended" }) {
    const allowedTransition: Record<string, string> = {
      waiting: "preparing",
      preparing: "active",
      active: "ended",
    };

    const { session, staged, ended } = await this.transactionRunner.run(async (tx) => {
      const current = await this.repo.findSessionById(input.sessionId, tx);
      if (!current) {
        throw new SessionNotFoundError();
      }
      if (current.status === input.status) {
        return {
          session: current,
          staged: { sessionId: input.sessionId, outboxIds: [], entries: [] },
          ended: false,
        };
      }
      if (allowedTransition[current.status] !== input.status) {
        throw new SessionStateInvalidError(`Invalid transition from ${current.status} to ${input.status}`);
      }
      await this.repo.updateSession(input.sessionId, { status: input.status }, tx);
      const stagedEvents = await this.eventBus.stage(tx, input.sessionId, [
        {
          type: "session:status-changed",
          payload: { status: input.status },
          visibility: { type: "public" },
        },
      ]);
      return {
        session: { ...current, status: input.status },
        staged: stagedEvents,
        ended: input.status === "ended",
      };
    });

    await this.eventBus.deliver(staged);
    if (ended) {
      this.afterEnded?.(input.sessionId);
    }
    return session;
  }
}

export class UpdateSessionPhaseUseCase {
  constructor(
    private readonly repo: SessionsRepository,
    private readonly transactionRunner: TransactionRunner,
    private readonly eventBus: SessionEventBus
  ) {}

  async execute(input: {
    sessionId: string;
    phase: "free_discussion" | "performance_time" | "forced_cg" | "free_performance";
  }) {
    const { session, staged } = await this.transactionRunner.run(async (tx) => {
      const current = await this.repo.findSessionById(input.sessionId, tx);
      if (!current) {
        throw new SessionNotFoundError();
      }
      if (current.status !== "active") {
        throw new SessionStateInvalidError("Phase updates are only allowed in active sessions");
      }
      await this.repo.updateSession(input.sessionId, { phase: input.phase }, tx);
      const stagedEvents = await this.eventBus.stage(tx, input.sessionId, [
        {
          type: "session:phase-changed",
          payload: { phase: input.phase },
          visibility: { type: "public" },
        },
      ]);
      return { session: { ...current, phase: input.phase }, staged: stagedEvents };
    });
    await this.eventBus.deliver(staged);
    return session;
  }
}

export class GetSessionSnapshotUseCase {
  constructor(private readonly repo: SessionsRepository) {}
  async execute(sessionId: string) {
    const session = await this.repo.findSessionById(sessionId);
    if (!session) {
      throw new SessionNotFoundError();
    }

    const characters = await this.repo.findSessionCharactersWithClaims(sessionId);

    return {
      session,
      characters,
    };
  }
}

export class RenameSessionUseCase {
  constructor(private readonly repo: SessionsRepository) {}

  async execute(input: { sessionId: string; name: string | null }) {
    const session = await this.repo.findSessionById(input.sessionId);
    if (!session) {
      throw new SessionNotFoundError();
    }
    const name = normaliseSessionName(input.name);
    await this.repo.updateSession(input.sessionId, { name });
    return { ...session, name };
  }
}

export class ListSessionsUseCase {
  constructor(private readonly repo: SessionsRepository) {}
  async execute(options: { limit: number; offset?: number; cursor?: string }) {
    return await this.repo.listSessions(options);
  }
}

export { CharacterAlreadyParticipatingError };
