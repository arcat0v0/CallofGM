import { Howl } from "howler";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { t } from "@/i18n";
import { type LibraryTrack, trackPlaybackPath } from "./music-library-model";

const POSITION_POLL_MS = 250;
const DEFAULT_VOLUME = 0.8;

export type Audition = {
	/** 正在试听的曲目；切换模组、筛选后依然保留，试听条不跟着列表消失。 */
	track: LibraryTrack | null;
	positionMs: number;
	volume: number;
	toggle: (track: LibraryTrack) => void;
	stop: () => void;
	/** 0–1，按曲目总时长跳转。 */
	seek: (ratio: number) => void;
	setVolume: (volume: number) => void;
};

/**
 * GM 的曲库试听：同一时间只放一首，BGM 循环、SE 播一次。
 * 只在本机播放，不会广播给任何团。
 */
export function useAudition(): Audition {
	const howlRef = useRef<Howl | null>(null);
	const [track, setTrack] = useState<LibraryTrack | null>(null);
	const [positionMs, setPositionMs] = useState(0);
	const [volume, setVolumeState] = useState(DEFAULT_VOLUME);
	const volumeRef = useRef(DEFAULT_VOLUME);

	const unload = useCallback(() => {
		howlRef.current?.unload();
		howlRef.current = null;
	}, []);

	const stop = useCallback(() => {
		unload();
		setTrack(null);
		setPositionMs(0);
	}, [unload]);

	const start = useCallback(
		(next: LibraryTrack) => {
			unload();
			const src = trackPlaybackPath(next);
			if (!src) {
				toast.error(t("gm.music.audioUnavailable"));
				setTrack(null);
				return;
			}
			const howl = new Howl({
				src: [src],
				html5: true,
				xhr: { withCredentials: true },
				loop: next.type === "bgm",
				volume: volumeRef.current,
			});
			const fail = () => {
				if (howlRef.current === howl) {
					howlRef.current = null;
					setTrack(null);
					setPositionMs(0);
				}
				howl.unload();
				toast.error(t("gm.music.audioUnavailable"));
			};
			howl.once("loaderror", fail);
			howl.once("playerror", fail);
			howl.on("end", () => {
				if (next.type === "bgm" || howlRef.current !== howl) {
					return;
				}
				howlRef.current = null;
				setTrack(null);
				setPositionMs(0);
				howl.unload();
			});
			howlRef.current = howl;
			setTrack(next);
			setPositionMs(0);
			howl.play();
		},
		[unload],
	);

	const toggle = useCallback(
		(next: LibraryTrack) => {
			if (howlRef.current && track?.id === next.id) {
				stop();
				return;
			}
			start(next);
		},
		[start, stop, track?.id],
	);

	const seek = useCallback(
		(ratio: number) => {
			const howl = howlRef.current;
			if (!howl || !track) {
				return;
			}
			const total = howl.duration() || track.duration / 1000;
			const clamped = Math.min(1, Math.max(0, ratio));
			howl.seek(clamped * total);
			setPositionMs(clamped * total * 1000);
		},
		[track],
	);

	const setVolume = useCallback((next: number) => {
		const clamped = Math.min(1, Math.max(0, next));
		volumeRef.current = clamped;
		setVolumeState(clamped);
		howlRef.current?.volume(clamped);
	}, []);

	useEffect(() => {
		if (!track) {
			return;
		}
		const timer = window.setInterval(() => {
			const howl = howlRef.current;
			if (!howl) {
				return;
			}
			const seconds = howl.seek();
			if (typeof seconds === "number") {
				setPositionMs(seconds * 1000);
			}
		}, POSITION_POLL_MS);
		return () => window.clearInterval(timer);
	}, [track]);

	useEffect(() => unload, [unload]);

	return { track, positionMs, volume, toggle, stop, seek, setVolume };
}
