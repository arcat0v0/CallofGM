import { LOCAL_VOLUME_DEFAULT, normalizeLocalVolume } from "./local-volume";

export const PLAYER_ID_KEY = "cogm.playerId";
export const ROTATE_SUGGESTION_KEY = "cogm.rotateSuggestionDismissed";
export const LOCAL_VOLUME_KEY = "cogm.localVolume";
export const LOCAL_MUTED_KEY = "cogm.localMuted";
export const PLAY_DISPLAY_KEY = "cogm.playDisplay";

export type PlayDisplayKey =
	| "sceneInfo"
	| "audio"
	| "characterStatus"
	| "dialogue"
	| "chat"
	| "handoutPrompt";

export type PlayDisplaySettings = Record<PlayDisplayKey, boolean>;

export const PLAY_DISPLAY_DEFAULTS: PlayDisplaySettings = {
	sceneInfo: true,
	audio: true,
	characterStatus: true,
	dialogue: true,
	chat: true,
	handoutPrompt: true,
};

const PLAY_DISPLAY_KEYS = Object.keys(
	PLAY_DISPLAY_DEFAULTS,
) as PlayDisplayKey[];

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
	return Number.isFinite(parsed)
		? normalizeLocalVolume(parsed)
		: LOCAL_VOLUME_DEFAULT;
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

export function readPlayDisplay(): PlayDisplaySettings {
	if (typeof localStorage === "undefined") {
		return { ...PLAY_DISPLAY_DEFAULTS };
	}
	const raw = localStorage.getItem(PLAY_DISPLAY_KEY);
	if (!raw) {
		return { ...PLAY_DISPLAY_DEFAULTS };
	}
	try {
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== "object" || parsed === null) {
			return { ...PLAY_DISPLAY_DEFAULTS };
		}
		const record = parsed as Record<string, unknown>;
		const settings = { ...PLAY_DISPLAY_DEFAULTS };
		for (const key of PLAY_DISPLAY_KEYS) {
			const value = record[key];
			if (typeof value === "boolean") {
				settings[key] = value;
			}
		}
		return settings;
	} catch {
		return { ...PLAY_DISPLAY_DEFAULTS };
	}
}

export function writePlayDisplay(settings: PlayDisplaySettings): void {
	if (typeof localStorage === "undefined") {
		return;
	}
	localStorage.setItem(PLAY_DISPLAY_KEY, JSON.stringify(settings));
}
