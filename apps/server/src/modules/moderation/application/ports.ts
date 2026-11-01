import type { SessionKickInput, SessionKickRecord } from "@/modules/sessions";

export interface BlacklistEntryInput {
  id: string;
  fingerprintHash: string;
  reason: string;
  expiresAt: number | null;
  createdAt: number;
}

export interface SessionKickStore {
  findActiveSessionKick(sessionId: string, playerId: string): Promise<SessionKickRecord | null>;
  recordSessionKick(kick: SessionKickInput): Promise<void>;
  liftSessionKick(sessionId: string, playerId: string, liftedAt: number): Promise<boolean>;
}

export interface ModerationRepository {
  findPlayerFingerprintHash(playerId: string): Promise<string | null>;
  upsertBlacklistEntry(entry: BlacklistEntryInput): Promise<void>;
  deleteBlacklistEntry(fingerprintHash: string): Promise<boolean>;
}
