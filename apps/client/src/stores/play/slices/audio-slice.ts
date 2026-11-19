import type { BgmState, SePlayedEvent } from "@cogm/shared";
import { t } from "@/i18n";
import { LOCAL_VOLUME_DEFAULT, normalizeLocalVolume } from "@/lib/local-volume";
import {
	readLocalMuted,
	readLocalVolume,
	writeLocalMuted,
	writeLocalVolume,
} from "@/lib/storage";
import {
	isEventPayload,
	type PlaySliceCreator,
	type PlayState,
} from "../types";

export type AudioSlice = {
	bgm: BgmState | null;
	seCue: SePlayedEvent | null;
	bgmTransitionMs: number;
	audioPlaybackStatus: "idle" | "loading" | "ready" | "error";
	audioPlaybackError: string | null;
	audioRetryRevision: number;
	muted: boolean;
	localVolume: number;
	setMuted: (muted: boolean) => void;
	setLocalVolume: (localVolume: number) => void;
	clearSeCue: () => void;
	setAudioPlaybackStatus: (status: AudioSlice["audioPlaybackStatus"]) => void;
	retryAudioPlayback: () => void;
};

export const audioDefaults = {
	bgm: null as BgmState | null,
	seCue: null as SePlayedEvent | null,
	bgmTransitionMs: 400,
	audioPlaybackStatus: "idle" as AudioSlice["audioPlaybackStatus"],
	audioPlaybackError: null as string | null,
	audioRetryRevision: 0,
	muted: false,
	localVolume: LOCAL_VOLUME_DEFAULT,
};

export function readAudioPreferences(): Pick<
	AudioSlice,
	"localVolume" | "muted"
> {
	return { localVolume: readLocalVolume(), muted: readLocalMuted() };
}

export const createAudioSlice: PlaySliceCreator<AudioSlice> = (set) => ({
	...audioDefaults,
	...readAudioPreferences(),
	setMuted: (muted) => {
		writeLocalMuted(muted);
		set({ muted });
	},
	setLocalVolume: (localVolume) => {
		const next = normalizeLocalVolume(localVolume);
		writeLocalVolume(next);
		set({ localVolume: next });
	},
	clearSeCue: () => set({ seCue: null }),
	setAudioPlaybackStatus: (audioPlaybackStatus) =>
		set({
			audioPlaybackStatus,
			audioPlaybackError:
				audioPlaybackStatus === "error" ? t("stage.audioPlaybackFailed") : null,
		}),
	retryAudioPlayback: () =>
		set((state) => ({
			audioRetryRevision: state.audioRetryRevision + 1,
			audioPlaybackStatus: "loading",
			audioPlaybackError: null,
		})),
});

export function reduceBgm(
	_state: PlayState,
	payload: Record<string, unknown>,
): Partial<AudioSlice> {
	const bgm = (payload.bgm ?? payload) as BgmState;
	if (!bgm || typeof bgm !== "object") {
		return {};
	}
	const transitionMs =
		typeof payload.transitionMs === "number"
			? payload.transitionMs
			: audioDefaults.bgmTransitionMs;
	return { bgm, bgmTransitionMs: transitionMs };
}

export function reduceSeCue(payload: unknown): Partial<AudioSlice> {
	const cue = (isEventPayload(payload) ? payload : {}) as SePlayedEvent;
	return cue.trackId ? { seCue: cue } : {};
}
