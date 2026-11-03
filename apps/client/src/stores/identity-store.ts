import { create } from "zustand";
import { readPlayerId, writePlayerId } from "@/lib/storage";

export type AccountRole = "admin" | "gm" | "pl";

export type AccountIdentity = {
	userId: string;
	username: string;
	role: AccountRole;
};

type IdentityState = {
	playerId: string | null;
	account: AccountIdentity | null;
	accountResolved: boolean;
	setPlayer: (playerId: string) => void;
	setAccount: (account: AccountIdentity | null) => void;
};

export const useIdentityStore = create<IdentityState>((set) => ({
	playerId: readPlayerId(),
	account: null,
	accountResolved: false,
	setPlayer(playerId) {
		writePlayerId(playerId);
		set({ playerId });
	},
	setAccount(account) {
		set({ account, accountResolved: true });
	},
}));

export function holderKeyOfAccount(
	account: AccountIdentity | null,
): string | null {
	return account ? `user:${account.userId}` : null;
}

export function holderKeyOfAnonymous(playerId: string | null): string | null {
	return playerId ? `anonymous:${playerId}` : null;
}
