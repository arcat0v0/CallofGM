import { create } from "zustand";
import { readPlayerId, writePlayerId } from "@/lib/storage";

type IdentityState = {
  playerId: string | null;
  gmAuthenticated: boolean | null;
  setPlayer: (playerId: string) => void;
  setGmAuthenticated: (value: boolean) => void;
};

export const useIdentityStore = create<IdentityState>((set) => ({
  playerId: readPlayerId(),
  gmAuthenticated: null,
  setPlayer(playerId) {
    writePlayerId(playerId);
    set({ playerId });
  },
  setGmAuthenticated(value) {
    set({ gmAuthenticated: value });
  },
}));
