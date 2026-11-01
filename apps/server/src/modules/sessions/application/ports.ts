import type { DbClient } from "@/platform/db/client";

export interface SessionRecord {
  id: string;
  name: string | null;
  moduleId: string;
  status: string;
  phase: string;
  currentSceneId: string | null;
  lastEventId: number;
  sharePcSheets: number;
  obSeePcState: number;
  createdAt: number;
}
export interface CharacterItem {
  id: string;
  name: string;
  kind: string;
  ruleId: string;
  sheetJson: string;
}

export interface SessionCharacterSnapshotItem {
  id: string;
  characterId: string;
  name: string;
  kind: string;
  currentExpressionKey: string | null;
  state: unknown;
  claim: {
    playerId: string;
    role: string;
  } | null;
}

export interface SessionKickRecord {
  id: string;
  sessionId: string;
  playerId: string;
  reason: string | null;
  createdAt: number;
  liftedAt: number | null;
}

export interface SessionKickInput {
  id: string;
  sessionId: string;
  playerId: string;
  reason: string | null;
  createdAt: number;
}

export interface SessionsRepository {
  findSessionById(id: string, db?: DbClient): Promise<SessionRecord | null>;
  saveSession(session: SessionRecord): Promise<void>;
  updateSession(
    id: string,
    updates: Partial<Omit<SessionRecord, "id" | "createdAt">>,
    db?: DbClient
  ): Promise<void>;
  createSession(
    session: SessionRecord,
    charactersToSave: Array<{
      id: string;
      sessionId: string;
      characterId: string;
      kind: string;
      currentExpressionKey: string | null;
      stateJson: string;
      createdAt: number;
    }>
  ): Promise<void>;
  findCharactersByIds(ids: string[]): Promise<CharacterItem[]>;
  findLinkedCharacterIds(moduleId: string, ids: string[]): Promise<string[]>;
  moduleExists(moduleId: string): Promise<boolean>;
  findModuleById(moduleId: string): Promise<{ id: string; name: string; ruleId: string } | null>;
  findSessionCharacterKind(sessionId: string, characterId: string): Promise<string | null>;
  isCharacterInSession(sessionId: string, characterId: string): Promise<boolean>;
  findActiveClaimByCharacterId(
    sessionId: string,
    characterId: string
  ): Promise<{ id: string; sessionId: string; playerId: string; role: string; characterId: string | null } | null>;
  releasePlayerClaims(sessionId: string, playerId: string, releasedAt: number): Promise<void>;
  saveClaim(claim: {
    id: string;
    sessionId: string;
    playerId: string;
    role: string;
    characterId: string | null;
    releasedAt: number | null;
    createdAt: number;
  }): Promise<void>;
  replacePlayerClaim(
    claim: {
      id: string;
      sessionId: string;
      playerId: string;
      role: string;
      characterId: string | null;
      releasedAt: number | null;
      createdAt: number;
    },
    releasedAt: number
  ): Promise<boolean>;
  listSessions(options: {
    limit: number;
    offset?: number;
    cursor?: string;
  }): Promise<{ items: SessionRecord[]; nextCursor: string | null }>;
  findSessionCharactersWithClaims(sessionId: string): Promise<SessionCharacterSnapshotItem[]>;
  findActiveClaims(
    sessionId: string
  ): Promise<Array<{ id: string; sessionId: string; playerId: string; role: string; characterId: string | null }>>;
  findActiveSessionKick(sessionId: string, playerId: string): Promise<SessionKickRecord | null>;
  recordSessionKick(kick: SessionKickInput): Promise<void>;
  liftSessionKick(sessionId: string, playerId: string, liftedAt: number): Promise<boolean>;
}
