export type VoiceNoiseSuppressionEngine = "deepfilter" | "rnnoise";

export type VoiceAudioSettings = {
	deviceId: string;
	echoCancellation: boolean;
	noiseSuppression: boolean;
	autoGainControl: boolean;
	deepNoiseSuppression: boolean;
	/** Model used by deep noise suppression; DeepFilterNet3 falls back to RNNoise. */
	noiseSuppressionEngine: VoiceNoiseSuppressionEngine;
	noiseGate: boolean;
	compressor: boolean;
	pushToTalk: boolean;
	pushToTalkKey: string;
};

export const VOICE_AUDIO_SETTINGS_KEY = "cogm.voiceAudioSettings";

/**
 * Stored settings version. Version 2 turned deep noise suppression, the gate
 * and the compressor on by default; older stores drop those three choices
 * once so existing users get the new defaults.
 */
export const VOICE_AUDIO_SETTINGS_VERSION = 2;

const RESET_BEFORE_V2 = [
	"deepNoiseSuppression",
	"noiseGate",
	"compressor",
] as const;

export const DEFAULT_VOICE_AUDIO_SETTINGS: VoiceAudioSettings = {
	deviceId: "default",
	echoCancellation: true,
	noiseSuppression: true,
	autoGainControl: true,
	deepNoiseSuppression: true,
	noiseSuppressionEngine: "deepfilter",
	noiseGate: true,
	compressor: true,
	pushToTalk: false,
	pushToTalkKey: "Space",
};

const booleanKeys = [
	"echoCancellation",
	"noiseSuppression",
	"autoGainControl",
	"deepNoiseSuppression",
	"noiseGate",
	"compressor",
	"pushToTalk",
] as const;

export function normalizeVoiceAudioSettings(
	value: unknown,
	base: VoiceAudioSettings = DEFAULT_VOICE_AUDIO_SETTINGS,
): VoiceAudioSettings {
	if (typeof value !== "object" || value === null) return { ...base };
	const record = value as Record<string, unknown>;
	const next = { ...base };
	for (const key of booleanKeys) {
		const setting = record[key];
		if (typeof setting === "boolean") next[key] = setting;
	}
	if (
		record.noiseSuppressionEngine === "deepfilter" ||
		record.noiseSuppressionEngine === "rnnoise"
	) {
		next.noiseSuppressionEngine = record.noiseSuppressionEngine;
	}
	if (
		typeof record.deviceId === "string" &&
		record.deviceId.length > 0 &&
		record.deviceId.length <= 512
	) {
		next.deviceId = record.deviceId;
	} else if (record.deviceId !== undefined) {
		next.deviceId = "default";
	}
	if (
		typeof record.pushToTalkKey === "string" &&
		record.pushToTalkKey.length > 0 &&
		record.pushToTalkKey.length <= 64
	) {
		next.pushToTalkKey = record.pushToTalkKey;
	}
	return next;
}

export function readVoiceAudioSettings(): VoiceAudioSettings {
	if (typeof localStorage === "undefined") {
		return { ...DEFAULT_VOICE_AUDIO_SETTINGS };
	}
	try {
		const raw = localStorage.getItem(VOICE_AUDIO_SETTINGS_KEY);
		return raw
			? normalizeVoiceAudioSettings(migrateStoredSettings(JSON.parse(raw)))
			: { ...DEFAULT_VOICE_AUDIO_SETTINGS };
	} catch {
		return { ...DEFAULT_VOICE_AUDIO_SETTINGS };
	}
}

export function writeVoiceAudioSettings(settings: VoiceAudioSettings): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(
			VOICE_AUDIO_SETTINGS_KEY,
			JSON.stringify({
				...normalizeVoiceAudioSettings(settings),
				version: VOICE_AUDIO_SETTINGS_VERSION,
			}),
		);
	} catch {}
}

function migrateStoredSettings(value: unknown): unknown {
	if (typeof value !== "object" || value === null) return value;
	const record = { ...(value as Record<string, unknown>) };
	const version = typeof record.version === "number" ? record.version : 1;
	if (version < 2) {
		for (const key of RESET_BEFORE_V2) delete record[key];
	}
	return record;
}
