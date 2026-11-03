import type { UserRole } from "../domain/actor";

export interface UserRecord {
  id: string;
  username: string;
  usernameNormalized: string;
  passwordHash: string;
  role: UserRole;
  disabledAt: number | null;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface UserSessionRecord {
  id: string;
  userId: string;
  sessionTokenHash: string;
  expiresAt: number;
  revokedAt: number | null;
  replacedBySessionId: string | null;
  createdAt: number;
}

export interface AnonymousPlayer {
  id: string;
  fingerprintHash: string;
  firstActiveAt: number;
  lastActiveAt: number;
}

export interface PlayerToken {
  id: string;
  tokenHash: string;
  playerId: string;
  expiresAt: number;
  revokedAt: number | null;
  createdAt: number;
}

export interface BlacklistEntry {
  id: string;
  fingerprintHash: string;
  playerId: string | null;
  userId: string | null;
  displayName: string | null;
  reason: string;
  expiresAt: number | null;
  createdAt: number;
}

export interface IdentityRepository {
  findUserById(id: string): Promise<UserRecord | null>;
  findUserByUsernameNormalized(usernameNormalized: string): Promise<UserRecord | null>;
  createUser(user: UserRecord): Promise<void>;
  updateUser(
    id: string,
    patch: Partial<
      Pick<
        UserRecord,
        "username" | "usernameNormalized" | "passwordHash" | "role" | "disabledAt" | "deletedAt" | "updatedAt"
      >
    >
  ): Promise<void>;
  listUsers(includeDeleted: boolean): Promise<UserRecord[]>;
  countActiveAdmins(excludeUserId?: string): Promise<number>;

  findUserSessionByTokenHash(tokenHash: string): Promise<UserSessionRecord | null>;
  listSessionsByUser(userId: string): Promise<UserSessionRecord[]>;
  createUserSession(session: UserSessionRecord): Promise<void>;
  revokeSession(id: string, revokedAt: number, replacedBySessionId?: string | null): Promise<void>;
  revokeAllUserSessions(userId: string, revokedAt: number, keepSessionId?: string): Promise<void>;

  findAnonymousPlayerById(id: string): Promise<AnonymousPlayer | null>;
  findAnonymousPlayerByFingerprintHash(fingerprintHash: string): Promise<AnonymousPlayer | null>;
  saveAnonymousPlayer(player: AnonymousPlayer): Promise<void>;
  updateAnonymousPlayerActiveTime(id: string, lastActiveAt: number): Promise<void>;

  findPlayerTokenByTokenHash(tokenHash: string): Promise<PlayerToken | null>;
  savePlayerToken(token: PlayerToken): Promise<void>;
  revokePlayerToken(id: string, revokedAt: number): Promise<void>;

  isFingerprintBlacklisted(fingerprintHash: string): Promise<boolean>;
  listBlacklistEntries(): Promise<BlacklistEntry[]>;
}
