export const PLAYER_TOKEN_KEY = "cogm.playerToken";
export const PLAYER_ID_KEY = "cogm.playerId";

export function readPlayerToken(): string | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  return localStorage.getItem(PLAYER_TOKEN_KEY);
}

export function readPlayerId(): string | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  return localStorage.getItem(PLAYER_ID_KEY);
}

export function writePlayerIdentity(playerId: string, token: string): void {
  localStorage.setItem(PLAYER_ID_KEY, playerId);
  localStorage.setItem(PLAYER_TOKEN_KEY, token);
}
