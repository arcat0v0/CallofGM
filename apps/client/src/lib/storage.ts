import { LOCAL_VOLUME_DEFAULT, normalizeLocalVolume } from "./local-volume";

export const PLAYER_ID_KEY = "cogm.playerId";
export const ROTATE_SUGGESTION_KEY = "cogm.rotateSuggestionDismissed";
export const LOCAL_VOLUME_KEY = "cogm.localVolume";
export const LOCAL_MUTED_KEY = "cogm.localMuted";

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

export function readLocalVolume(): number {
  if (typeof localStorage === "undefined") {
    return LOCAL_VOLUME_DEFAULT;
  }
  const raw = localStorage.getItem(LOCAL_VOLUME_KEY);
  if (raw === null || raw.trim() === "") {
    return LOCAL_VOLUME_DEFAULT;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? normalizeLocalVolume(parsed) : LOCAL_VOLUME_DEFAULT;
}

export function writeLocalVolume(value: number): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(LOCAL_VOLUME_KEY, String(normalizeLocalVolume(value)));
}

export function readLocalMuted(): boolean {
  if (typeof localStorage === "undefined") {
    return false;
  }
  return localStorage.getItem(LOCAL_MUTED_KEY) === "1";
}

export function writeLocalMuted(muted: boolean): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(LOCAL_MUTED_KEY, muted ? "1" : "0");
}
