import { create } from "zustand";
import { readPlayerId, readPlayerToken, writePlayerIdentity } from "@/lib/storage";

type IdentityState = {
  playerId: string | null;
  token: string | null;
  gmAuthenticated: boolean | null;
  setPlayer: (playerId: string, token: string) => void;
  setGmAuthenticated: (value: boolean) => void;
};

export const useIdentityStore = create<IdentityState>((set) => ({
  playerId: readPlayerId(),
  token: readPlayerToken(),
  gmAuthenticated: null,
  setPlayer(playerId, token) {
    writePlayerIdentity(playerId, token);
    set({ playerId, token });
  },
  setGmAuthenticated(value) {
    set({ gmAuthenticated: value });
  },
}));
