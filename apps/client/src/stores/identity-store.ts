import { create } from "zustand";

export const TOKEN_KEY = "cogm.playerToken";
export const PLAYER_ID_KEY = "cogm.playerId";

function readStoredToken(): string | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  return localStorage.getItem(TOKEN_KEY);
}

function readStoredPlayerId(): string | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  return localStorage.getItem(PLAYER_ID_KEY);
}

type IdentityState = {
  playerId: string | null;
  token: string | null;
  gmAuthenticated: boolean | null;
  setPlayer: (playerId: string, token: string) => void;
  setGmAuthenticated: (value: boolean) => void;
};

export const useIdentityStore = create<IdentityState>((set) => ({
  playerId: readStoredPlayerId(),
  token: readStoredToken(),
  gmAuthenticated: null,
  setPlayer(playerId, token) {
    localStorage.setItem(PLAYER_ID_KEY, playerId);
    localStorage.setItem(TOKEN_KEY, token);
    set({ playerId, token });
  },
  setGmAuthenticated(value) {
    set({ gmAuthenticated: value });
  },
}));
