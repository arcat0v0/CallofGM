export const PLAYER_ID_KEY = "cogm.playerId";

export function readPlayerId(): string | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  return localStorage.getItem(PLAYER_ID_KEY);
}

export function writePlayerId(playerId: string): void {
  localStorage.setItem(PLAYER_ID_KEY, playerId);
}
