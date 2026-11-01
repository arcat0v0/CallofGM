export const PLAYER_ID_KEY = "cogm.playerId";
export const ROTATE_SUGGESTION_KEY = "cogm.rotateSuggestionDismissed";

export function readPlayerId(): string | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  return localStorage.getItem(PLAYER_ID_KEY);
}

export function writePlayerId(playerId: string): void {
  localStorage.setItem(PLAYER_ID_KEY, playerId);
}

export function readRotateSuggestionDismissed(): boolean {
  if (typeof localStorage === "undefined") {
    return false;
  }
  return localStorage.getItem(ROTATE_SUGGESTION_KEY) === "1";
}

export function writeRotateSuggestionDismissed(): void {
  localStorage.setItem(ROTATE_SUGGESTION_KEY, "1");
}
