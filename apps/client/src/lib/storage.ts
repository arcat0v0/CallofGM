import { LOCAL_VOLUME_DEFAULT, normalizeLocalVolume } from "./local-volume";

export const PLAYER_ID_KEY = "cogm.playerId";
export const ROTATE_SUGGESTION_KEY = "cogm.rotateSuggestionDismissed";
export const LOCAL_VOLUME_KEY = "cogm.localVolume";
export const LOCAL_MUTED_KEY = "cogm.localMuted";
export const PLAY_DISPLAY_KEY = "cogm.playDisplay";
export const GM_LIBRARY_RULE_KEY = "cogm.gmLibraryRule";
export const GM_MUSIC_MODULE_KEY = "cogm.gmMusicModule";
export const VOICE_MEMBER_VOLUMES_PREFIX = "cogm.voiceMemberVolumes.";

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

export function readVoiceMemberVolumes(
	sessionId: string,
): Record<string, number> {
	if (typeof localStorage === "undefined" || !sessionId) {
		return {};
	}
	const raw = localStorage.getItem(`${VOICE_MEMBER_VOLUMES_PREFIX}${sessionId}`);
	if (!raw) {
		return {};
	}
	try {
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== "object" || parsed === null) {
			return {};
		}
		const result: Record<string, number> = {};
		for (const [key, value] of Object.entries(parsed)) {
			if (typeof value === "number" && Number.isFinite(value)) {
				result[key] = normalizeLocalVolume(value);
			}
		}
		return result;
	} catch {
		return {};
	}
}

export function writeVoiceMemberVolumes(
	sessionId: string,
	volumes: Record<string, number>,
): void {
	if (typeof localStorage === "undefined" || !sessionId) {
		return;
	}
	try {
		localStorage.setItem(
			`${VOICE_MEMBER_VOLUMES_PREFIX}${sessionId}`,
			JSON.stringify(volumes),
		);
	} catch {
		// Ignore quota errors on local preference persistence.
	}
}

export function readGmLibraryRule(): string | null {
	if (typeof localStorage === "undefined") {
		return null;
	}
	return localStorage.getItem(GM_LIBRARY_RULE_KEY);
}

export function writeGmLibraryRule(ruleId: string): void {
	if (typeof localStorage === "undefined") {
		return;
	}
	localStorage.setItem(GM_LIBRARY_RULE_KEY, ruleId);
}

/** 音乐页上次使用的模组（模组 id 或 "all"）。 */
export function readGmMusicModule(): string | null {
	if (typeof localStorage === "undefined") {
		return null;
	}
	return localStorage.getItem(GM_MUSIC_MODULE_KEY);
}

export function writeGmMusicModule(moduleId: string): void {
	if (typeof localStorage === "undefined") {
		return;
	}
	localStorage.setItem(GM_MUSIC_MODULE_KEY, moduleId);
}
