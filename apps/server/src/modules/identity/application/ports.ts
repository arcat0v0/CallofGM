export interface GmLoginSession {
  id: string;
  sessionTokenHash: string;
  expiresAt: number;
  revokedAt: number | null;
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
  displayName: string | null;
  reason: string;
  expiresAt: number | null;
  createdAt: number;
}

export interface IdentityRepository {
  findGmPasswordHash(): Promise<string | null>;
  saveGmPasswordHash(passwordHash: string, updatedAt: number): Promise<void>;

  findGmSessionByTokenHash(tokenHash: string): Promise<GmLoginSession | null>;
  saveGmSession(session: GmLoginSession): Promise<void>;
  revokeGmSession(id: string, revokedAt: number): Promise<void>;

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
