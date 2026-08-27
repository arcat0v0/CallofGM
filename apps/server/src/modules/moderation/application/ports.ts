export interface BlacklistEntryInput {
  id: string;
  fingerprintHash: string;
  reason: string;
  expiresAt: number | null;
  createdAt: number;
}

export interface ModerationRepository {
  findPlayerFingerprintHash(playerId: string): Promise<string | null>;
  upsertBlacklistEntry(entry: BlacklistEntryInput): Promise<void>;
  deleteBlacklistEntry(fingerprintHash: string): Promise<boolean>;
}
