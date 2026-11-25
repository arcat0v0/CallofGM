import type { BgmState, SePlayedEvent } from "@cogm/shared";
import { Howl } from "howler";
import { useCallback, useEffect, useRef } from "react";
import { usePlayStore } from "@/stores/play-store";
import { mediaUrl } from "./api";
import { effectiveVolume } from "./local-volume";
import { sendSessionCommand } from "./session-socket";

function audioFormat(mimeType?: string): string {
	const formats: Record<string, string> = {
		"audio/mpeg": "mp3",
		"audio/wav": "wav",
		"audio/ogg": "ogg",
		"audio/flac": "flac",
		"audio/mp4": "m4a",
	};
	return formats[mimeType ?? ""] ?? "mp3";
}

export function currentBgmPosition(bgm: BgmState, now = Date.now()): number {
	let position = bgm.seekOffsetMs;
	if (bgm.playing) {
		position += Math.max(0, now - bgm.startedAtMs);
	}
	const duration = bgm.durationMs ?? 0;
	if (duration > 0) {
		return bgm.mode === "single"
			? position % duration
			: Math.min(position, duration);
	}
	return position;
}

export function useBgmPlayback(
	bgm: BgmState | null,
	playbackUrl: string | null | undefined,
	seCue?: SePlayedEvent | null,
	onSePlayed?: () => void,
	options?: {
		muted?: boolean;
		localVolume?: number;
		isGm?: boolean;
		connected?: boolean;
		transitionMs?: number;
		retryRevision?: number;
		onPlaybackStatus?: (status: "idle" | "loading" | "ready" | "error") => void;
	},
): void {
	const howlRef = useRef<Howl | null>(null);
	const assetRef = useRef<string | null>(null);
	const seRef = useRef<{ howl: Howl; broadcastVolume: number } | null>(null);
	const muted = options?.muted ?? false;
	const localVolume = options?.localVolume ?? 100;
	const isGm = options?.isGm ?? false;
	const connected = options?.connected ?? true;
	const playbackRef = useRef({ bgm, isGm, connected });
	playbackRef.current = { bgm, isGm, connected };
	const endedRef = useRef<{
		signature: string;
		reportedVersion: number | null;
	} | null>(null);
	const transitionMs = Math.max(0, options?.transitionMs ?? 400);
	const retryRevision = options?.retryRevision ?? 0;
	const onPlaybackStatus = options?.onPlaybackStatus;
	const seOptionsRef = useRef({ localVolume, muted, isGm });
	seOptionsRef.current = { localVolume, muted, isGm };

	const reportEnd = useCallback(() => {
		const latest = playbackRef.current;
		if (
			!latest.bgm?.playing ||
			latest.bgm.mode === "single" ||
			!latest.isGm ||
			!latest.connected ||
			!endedRef.current ||
			endedRef.current.reportedVersion === latest.bgm.version
		)
			return;
		const commandId = sendSessionCommand("audio:bgm", {
			action: "ended",
			expectedVersion: latest.bgm.version,
		});
		if (commandId) endedRef.current.reportedVersion = latest.bgm.version;
	}, []);

	useEffect(() => {
		const unlock = () => {
			const unlockHowl = new Howl({
				src: [
					"data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=",
				],
				volume: 0,
				format: ["wav"],
			});
			unlockHowl.play();
			unlockHowl.unload();
		};
		window.addEventListener("pointerdown", unlock, { once: true });
		return () => window.removeEventListener("pointerdown", unlock);
	}, []);

	useEffect(() => {
		if (!connected && endedRef.current) endedRef.current.reportedVersion = null;
		const src = playbackUrl ?? "";
		if (!src || !bgm) {
			howlRef.current?.unload();
			howlRef.current = null;
			assetRef.current = null;
			endedRef.current = null;
			onPlaybackStatus?.("idle");
			return;
		}

		const assetKey = `${src}:${retryRevision}`;
		const signature = `${bgm.trackId}:${bgm.startedAtMs}:${bgm.seekOffsetMs}`;
		if (endedRef.current?.signature !== signature || bgm.mode === "single")
			endedRef.current = null;
		if (assetRef.current !== assetKey) {
			howlRef.current?.unload();
			onPlaybackStatus?.("loading");
			const created = new Howl({
				src: [src],
				format: [audioFormat(bgm.audioMimeType)],
				html5: true,
				xhr: { withCredentials: true },
				loop: bgm.mode === "single",
				volume: 0,
				onload: () => {
					if (howlRef.current !== created) return;
					if (!playbackRef.current.bgm?.playing) {
						created.pause();
					}
					onPlaybackStatus?.("ready");
				},
				onplay: () => {
					if (howlRef.current !== created) return;
					if (!playbackRef.current.bgm?.playing) {
						created.pause();
						return;
					}
					onPlaybackStatus?.("ready");
				},
				onloaderror: () => onPlaybackStatus?.("error"),
				onplayerror: () => onPlaybackStatus?.("error"),
				onend: () => {
					const latest = playbackRef.current.bgm;
					if (
						howlRef.current !== created ||
						!latest?.playing ||
						latest.mode === "single"
					)
						return;
					const finished = `${latest.trackId}:${latest.startedAtMs}:${latest.seekOffsetMs}`;
					if (endedRef.current?.signature !== finished)
						endedRef.current = { signature: finished, reportedVersion: null };
					reportEnd();
				},
			});
			howlRef.current = created;
			assetRef.current = assetKey;
		}

		const howl = howlRef.current;
		if (!howl) {
			return;
		}

		howl.loop(bgm.mode === "single");
		const targetVolume = effectiveVolume({
			broadcastVolume: bgm.volume,
			localVolume,
			muted,
			isGm,
		});
		if (Math.abs(howl.volume() - targetVolume) > 0.01) {
			if (bgm.playing && transitionMs > 0 && howl.state() === "loaded") {
				howl.fade(howl.volume(), targetVolume, transitionMs);
			} else {
				howl.volume(targetVolume);
			}
		}
		const position = currentBgmPosition(bgm);
		const durationMs = bgm.durationMs ?? 0;
		if (
			bgm.playing &&
			bgm.mode !== "single" &&
			durationMs > 0 &&
			position >= durationMs
		) {
			endedRef.current ??= { signature, reportedVersion: null };
		}
		if (bgm.playing && endedRef.current?.signature === signature) {
			howl.pause();
			reportEnd();
			return;
		}
		const seekSec = position / 1000;
		const currentSeek =
			typeof howl.seek() === "number" ? Number(howl.seek()) : 0;
		if (!bgm.playing) {
			// Pause before seeking: Howler's html5 seek() pauses synchronously and
			// reschedules play() on a macrotask if playing() was true when called.
			howl.pause();
			if (Math.abs(currentSeek - seekSec) > 0.75) {
				howl.seek(seekSec);
			}
			return;
		}
		if (Math.abs(currentSeek - seekSec) > 0.75) {
			howl.seek(seekSec);
		}
		if (!howl.playing()) {
			try {
				howl.play();
			} catch {
				onPlaybackStatus?.("error");
			}
		}
	}, [
		bgm,
		connected,
		isGm,
		localVolume,
		muted,
		onPlaybackStatus,
		playbackUrl,
		retryRevision,
		reportEnd,
		transitionMs,
	]);

	useEffect(() => {
		if (!seCue) {
			return;
		}
		const src = seCue.playbackUrl ?? mediaUrl(seCue.audioAssetId) ?? "";
		if (!src) {
			onSePlayed?.();
			return;
		}
		const broadcastVolume = seCue.volume ?? 100;
		const seOptions = seOptionsRef.current;
		const se = new Howl({
			src: [src],
			format: [audioFormat(seCue.audioMimeType)],
			html5: true,
			xhr: { withCredentials: true },
			volume: effectiveVolume({ broadcastVolume, ...seOptions }),
		});
		seRef.current = { howl: se, broadcastVolume };
		se.once("end", () => {
			se.unload();
			if (seRef.current?.howl === se) {
				seRef.current = null;
			}
		});
		se.play();
		onSePlayed?.();
	}, [onSePlayed, seCue]);

	useEffect(() => {
		const active = seRef.current;
		if (!active) {
			return;
		}
		active.howl.volume(
			effectiveVolume({
				broadcastVolume: active.broadcastVolume,
				localVolume,
				muted,
				isGm,
			}),
		);
	}, [isGm, localVolume, muted]);

	useEffect(() => {
		return () => {
			howlRef.current?.unload();
			howlRef.current = null;
			seRef.current?.howl.unload();
			seRef.current = null;
		};
	}, []);
}

export function usePlayAudio(): void {
	const bgm = usePlayStore((state) => state.bgm);
	const seCue = usePlayStore((state) => state.seCue);
	const clearSeCue = usePlayStore((state) => state.clearSeCue);
	const tracks = usePlayStore((state) => state.catalogTracks);
	const muted = usePlayStore((state) => state.muted);
	const localVolume = usePlayStore((state) => state.localVolume);
	const isGm = usePlayStore((state) => state.viewer.isGm);
	const connected = usePlayStore((state) => state.connected);
	const transitionMs = usePlayStore((state) => state.bgmTransitionMs);
	const retryRevision = usePlayStore((state) => state.audioRetryRevision);
	const setPlaybackStatus = usePlayStore(
		(state) => state.setAudioPlaybackStatus,
	);
	const track = tracks.find((item) => item.id === bgm?.trackId);
	const externalStream =
		(bgm?.source && bgm.source !== "upload") ||
		(track && track.source !== "upload")
			? `/api/v1/music/tracks/${encodeURIComponent(bgm?.trackId ?? track?.id ?? "")}/stream`
			: null;
	const playbackUrl =
		bgm?.playbackUrl ??
		externalStream ??
		mediaUrl(bgm?.audioAssetId ?? track?.audioAssetId);
	useBgmPlayback(bgm, playbackUrl, seCue, clearSeCue, {
		muted,
		localVolume,
		isGm,
		connected,
		transitionMs,
		retryRevision,
		onPlaybackStatus: setPlaybackStatus,
	});
}
