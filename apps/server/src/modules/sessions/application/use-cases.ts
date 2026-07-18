import type { RuleId } from "@cogm/shared";
import type { IdGenerator, Clock } from "@/platform/ports";
import type { RuleRegistry } from "@/rules/registry";
import type { DrizzleSessionsRepository } from "../infrastructure/drizzle-sessions-repository";
import { CharacterNotFoundError } from "@/modules/characters";
import { ModuleNotFoundError } from "@/modules/catalog";
import {
  SessionNotFoundError,
  SessionStateInvalidError,
  SeatAlreadyClaimedError,
  CharacterAlreadyParticipatingError,
} from "../domain/errors";

export class CreateSessionUseCase {
  constructor(
    private readonly repo: DrizzleSessionsRepository,
    private readonly ruleRegistry: RuleRegistry,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: { moduleId: string; characterIds: string[] }) {
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

    const sessionId = this.idGenerator.nextId();
    const now = this.clock.nowEpochMs();

    const session = {
      id: sessionId,
      moduleId: input.moduleId,
      status: "waiting" as const,
      phase: "free_discussion" as const,
      currentSceneId: null,
      lastEventId: 0,
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
    private readonly repo: DrizzleSessionsRepository,
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
      throw new SessionStateInvalidError("Cannot claim seat in an ended session");
    }

    if (input.role === "pc") {
      if (!input.characterId) {
        throw new SessionStateInvalidError("Character ID is required for pc role");
      }

      const inSession = await this.repo.isCharacterInSession(input.sessionId, input.characterId);
      if (!inSession) {
        throw new CharacterNotFoundError("Character not participating in this session");
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
    private readonly repo: DrizzleSessionsRepository,
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
  constructor(private readonly repo: DrizzleSessionsRepository) {}

  async execute(input: { sessionId: string; status: "waiting" | "preparing" | "active" | "ended" }) {
    const session = await this.repo.findSessionById(input.sessionId);
    if (!session) {
      throw new SessionNotFoundError();
    }

    const allowedTransition: Record<string, string> = {
      waiting: "preparing",
      preparing: "active",
      active: "ended",
    };

    if (session.status !== input.status) {
      if (allowedTransition[session.status] !== input.status) {
        throw new SessionStateInvalidError(`Invalid transition from ${session.status} to ${input.status}`);
      }
      await this.repo.updateSession(input.sessionId, { status: input.status });
    }

    return { ...session, status: input.status };
  }
}

export class UpdateSessionPhaseUseCase {
  constructor(private readonly repo: DrizzleSessionsRepository) {}

  async execute(input: {
    sessionId: string;
    phase: "free_discussion" | "performance_time" | "forced_cg" | "free_performance";
  }) {
    const session = await this.repo.findSessionById(input.sessionId);
    if (!session) {
      throw new SessionNotFoundError();
    }
    if (session.status !== "active") {
      throw new SessionStateInvalidError("Phase updates are only allowed in active sessions");
    }

    await this.repo.updateSession(input.sessionId, { phase: input.phase });
    return { ...session, phase: input.phase };
  }
}

export class GetSessionSnapshotUseCase {
  constructor(private readonly repo: DrizzleSessionsRepository) {}

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

export class ListSessionsUseCase {
  constructor(private readonly repo: DrizzleSessionsRepository) {}

  async execute() {
    return await this.repo.listSessions();
  }
}
