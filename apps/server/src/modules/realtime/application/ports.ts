import type { SeatHolder } from "@/modules/identity";

export interface ActiveClaimLookup {
	findActiveClaims(sessionId: string): Promise<
		Array<{
			userId: string | null;
			playerId: string | null;
			characterId: string | null;
		}>
	>;
}

export interface VoiceClaim {
	id: string;
	userId: string | null;
	playerId: string | null;
	role: string;
	characterId: string | null;
	characterName: string | null;
	username: string | null;
	kicked: boolean;
}

export interface VoiceSession {
	ownerId: string;
	ownerName: string | null;
	status: string;
	phase: string;
	voiceLimit: number | null;
	claims: VoiceClaim[];
}

export interface VoiceSessionStore {
	loadSession(
		sessionId: string,
		claims?: SeatHolder | "all" | "none",
	): Promise<VoiceSession | null>;
	setVoiceLimit(sessionId: string, voiceLimit: number): Promise<void>;
}
