import type {
	SeatHolderInput,
	SessionKickInput,
	SessionKickRecord,
} from "@/modules/sessions";

export interface BlacklistEntryInput {
	id: string;
	fingerprintHash: string;
	playerId: string | null;
	userId: string | null;
	displayName: string | null;
	reason: string;
	expiresAt: number | null;
	createdAt: number;
}

export interface PlayerBanContext {
	fingerprintHash: string;
	displayName: string | null;
}

export interface SessionKickStore {
	findActiveSessionKick(
		sessionId: string,
		holder: SeatHolderInput,
	): Promise<SessionKickRecord | null>;
	recordSessionKick(kick: SessionKickInput): Promise<void>;
	liftSessionKick(
		sessionId: string,
		holder: SeatHolderInput,
		liftedAt: number,
	): Promise<boolean>;
}

export interface ModerationRepository {
	findPlayerBanContext(playerId: string): Promise<PlayerBanContext | null>;
	findUserBanContext(userId: string): Promise<PlayerBanContext | null>;
	upsertBlacklistEntry(entry: BlacklistEntryInput): Promise<void>;
	deleteBlacklistEntry(selector: {
		fingerprintHash?: string;
		playerId?: string;
		userId?: string;
		id?: string;
	}): Promise<boolean>;
}
