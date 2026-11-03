import type { IdGenerator, Clock } from "@/platform/ports";
import type { RuleRegistry } from "@/rules/registry";
import type { SessionsRepository, SeatHolderInput, HolderKind } from "./ports";
import { holderKeyOf } from "./ports";
import { CharacterNotFoundError } from "@/modules/characters";
import { ModuleNotFoundError } from "@/modules/catalog";
import {
  SessionNotFoundError,
  SessionStateInvalidError,
  SeatAlreadyClaimedError,
  SessionKickedError,
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

function resolvedHolder(holder: SeatHolderInput) {
  return {
    holderKind: holder.holderKind,
    playerId: holder.holderKind === "anonymous" ? holder.playerId : null,
    userId: holder.holderKind === "user" ? holder.userId : null,
  };
}

export class CreateSessionUseCase {
  constructor(
    private readonly repo: SessionsRepository,
    private readonly ruleRegistry: RuleRegistry,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: {
    ownerId: string;
    moduleId: string;
    characterIds: string[];
    name?: string;
    status?: "waiting" | "preparing";
  }) {
    const moduleRecord = await this.repo.findModuleById(input.moduleId);
    if (!moduleRecord || moduleRecord.ownerId !== input.ownerId) {
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
      ownerId: input.ownerId,
      name: normaliseSessionName(input.name),
      moduleId: input.moduleId,
      ruleId: moduleRecord.ruleId,
      status: input.status ?? ("waiting" as const),
      phase: "free_discussion" as const,
      currentSceneId: null,
      lastEventId: 0,
      sharePcSheets: 1,
      obSeePcState: 1,
      portraitLayout: "auto",
      portraitScale: "md",
      growthConfirmedAt: null,
      deletedAt: null,
      createdAt: now,
    };

    const ruleSystem = this.ruleRegistry.get(moduleRecord.ruleId);

    const sessionChars = loadedCharacters.map((char) => {
      const parsedSheet = ruleSystem.characterSheetSchema.parse(JSON.parse(char.sheetJson));
      const initialState = ruleSystem.initializeSessionState(parsedSheet) as Record<string, unknown>;
      initialState.sessionId = sessionId;
      initialState.characterId = char.id;

      return {
        id: this.idGenerator.nextId(),
        sessionId,
        characterId: char.id,
        kind: char.kind,
        name: char.name,
        background: char.background,
        ruleId: char.ruleId,
        sheetJson: char.sheetJson,
        baseSheetVersion: char.sheetVersion,
        baseProfileVersion: char.profileVersion,
        currentExpressionKey: null,
        stateJson: JSON.stringify(initialState),
        createdAt: now,
      };
    });

    const checkpoint = {
      phase: session.phase,
      currentSceneId: session.currentSceneId,
      characters: sessionChars.map((character) => ({
        characterId: character.characterId,
        kind: character.kind,
        currentExpressionKey: character.currentExpressionKey,
        stateJson: character.stateJson,
        name: character.name,
        background: character.background,
        sheetJson: character.sheetJson,
        baseSheetVersion: character.baseSheetVersion,
        baseProfileVersion: character.baseProfileVersion,
      })),
      checkRequests: [],
      handoutGrants: [],
    };

    await this.repo.createSession(session, sessionChars, {
      id: this.idGenerator.nextId(),
      eventId: 0,
      stateJson: JSON.stringify(checkpoint),
      createdAt: now,
    });

    return { session, characters: sessionChars };
  }
}

export class ClaimSeatUseCase {
  constructor(
    private readonly repo: SessionsRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly onClaimReplaced?: (input: { sessionId: string; holder: SeatHolderInput }) => void
  ) {}

  async execute(input: {
    sessionId: string;
    holder: SeatHolderInput;
    role: "pc" | "ob";
    characterId?: string;
  }) {
    const session = await this.repo.findSessionById(input.sessionId);
    if (!session) {
      throw new SessionNotFoundError();
    }
    const activeKick = await this.repo.findActiveSessionKick(input.sessionId, input.holder);
    if (activeKick) {
      throw new SessionKickedError();
    }
    if (session.status === "ended") {
      if (input.role !== "ob") {
        throw new SessionStateInvalidError("Cannot claim PC seat in an ended session");
      }
    }

    if (input.role === "pc") {
      if (input.holder.holderKind !== "user") {
        throw new SessionStateInvalidError("PC seats require a player account");
      }
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
      if (activeClaim) {
        const sameHolder = input.holder.holderKind === "user"
          ? activeClaim.userId === input.holder.userId
          : activeClaim.playerId === input.holder.playerId;
        if (!sameHolder) {
          throw new SeatAlreadyClaimedError("This character's seat is already claimed");
        }
      }
    }

    const now = this.clock.nowEpochMs();
    const previousClaim = await this.repo.findActiveClaimByHolder(input.sessionId, input.holder);

    const claim = {
      id: this.idGenerator.nextId(),
      sessionId: input.sessionId,
      ...resolvedHolder(input.holder),
      role: input.role,
      characterId: input.role === "pc" ? input.characterId || null : null,
      releasedAt: null,
      createdAt: now,
    };

    const claimed = await this.repo.replaceHolderClaim(claim, now);
    if (!claimed) {
      throw new SeatAlreadyClaimedError("This character's seat is already claimed");
    }
    if (previousClaim) {
      this.onClaimReplaced?.({ sessionId: input.sessionId, holder: input.holder });
    }
    return claim;
  }
}

export class GmAssignClaimUseCase {
  constructor(
    private readonly repo: SessionsRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: { ownerId: string; sessionId: string; holder: SeatHolderInput; characterId: string }) {
    const session = await this.repo.findSessionById(input.sessionId);
    if (!session || session.ownerId !== input.ownerId) {
      throw new SessionNotFoundError();
    }
    if (session.status === "ended") {
      throw new SessionStateInvalidError("Cannot assign PC seat in an ended session");
    }
    const activeKick = await this.repo.findActiveSessionKick(input.sessionId, input.holder);
    if (activeKick) {
      throw new SessionKickedError();
    }

    const kind = await this.repo.findSessionCharacterKind(input.sessionId, input.characterId);
    if (!kind) {
      throw new CharacterNotFoundError("Character not participating in this session");
    }
    if (kind !== "pc") {
      throw new SessionStateInvalidError("Only PC seats can be assigned");
    }

    const now = this.clock.nowEpochMs();
    const claim = {
      id: this.idGenerator.nextId(),
      sessionId: input.sessionId,
      ...resolvedHolder(input.holder),
      role: "pc" as const,
      characterId: input.characterId,
      releasedAt: null,
      createdAt: now,
    };

    const { displacedHolderKeys } = await this.repo.forceReplaceHolderClaim(claim, now);
    return { claim, displacedHolderKeys };
  }
}

export class ReleaseSeatUseCase {
  constructor(
    private readonly repo: SessionsRepository,
    private readonly clock: Clock
  ) {}

  async execute(input: { sessionId: string; holder: SeatHolderInput }) {
    const session = await this.repo.findSessionById(input.sessionId);
    if (!session) {
      throw new SessionNotFoundError();
    }
    const now = this.clock.nowEpochMs();
    await this.repo.releaseHolderClaims(input.sessionId, input.holder, now);
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

  async execute(input: {
    ownerId: string;
    sessionId: string;
    status: "waiting" | "preparing" | "active" | "ended";
  }) {
    const allowedTransition: Record<string, string> = {
      waiting: "preparing",
      preparing: "active",
      active: "ended",
    };

    const { session, staged, ended } = await this.transactionRunner.run(async (tx) => {
      const current = await this.repo.findSessionById(input.sessionId, tx);
      if (!current || current.ownerId !== input.ownerId) {
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
    ownerId: string;
    sessionId: string;
    phase: "free_discussion" | "performance_time" | "forced_cg" | "free_performance";
  }) {
    const { session, staged } = await this.transactionRunner.run(async (tx) => {
      const current = await this.repo.findSessionById(input.sessionId, tx);
      if (!current || current.ownerId !== input.ownerId) {
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
    return { session, characters };
  }
}

export class RenameSessionUseCase {
  constructor(private readonly repo: SessionsRepository) {}

  async execute(input: { ownerId: string; sessionId: string; name: string | null }) {
    const session = await this.repo.findSessionById(input.sessionId);
    if (!session || session.ownerId !== input.ownerId) {
      throw new SessionNotFoundError();
    }
    const name = normaliseSessionName(input.name);
    await this.repo.updateSession(input.sessionId, { name });
    return { ...session, name };
  }
}

export class SoftDeleteSessionUseCase {
  constructor(
    private readonly repo: SessionsRepository,
    private readonly clock: Clock
  ) {}

  async execute(input: { ownerId: string; sessionId: string }) {
    const session = await this.repo.findSessionById(input.sessionId);
    if (!session || session.ownerId !== input.ownerId) {
      throw new SessionNotFoundError();
    }
    await this.repo.softDeleteSession(input.sessionId, this.clock.nowEpochMs());
    return { success: true };
  }
}

export class ListSessionsUseCase {
  constructor(private readonly repo: SessionsRepository) {}
  async execute(options: { ownerId?: string; limit: number; offset?: number; cursor?: string }) {
    return await this.repo.listSessions(options);
  }
}

export { CharacterAlreadyParticipatingError, holderKeyOf };
export type { HolderKind, SeatHolderInput };
