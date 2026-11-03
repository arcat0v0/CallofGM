import { useEffect, useState } from "react";
import { sendSessionCommand } from "@/lib/session-socket";
import { usePlayStore } from "@/stores/play-store";

function useBgmPlayback() {
	const bgm = usePlayStore((state) => state.bgm);
	const tracks = usePlayStore((state) => state.catalogTracks);
	const bgmTracks = tracks.filter((track) => track.type === "bgm");
	const soundEffects = tracks.filter((track) => track.type === "se");
	const current = bgmTracks.find((track) => track.id === bgm?.trackId);
	const durationMs = bgm?.durationMs ?? 0;
	const [now, setNow] = useState(() => Date.now());
	const signature = `${bgm?.version ?? -1}:${bgm?.seekOffsetMs ?? -1}`;
	const [seekDraftState, setSeekDraftState] = useState<{
		signature: string;
		value: number | null;
	}>({
		signature,
		value: null,
	});
	const seekDraft =
		seekDraftState.signature === signature ? seekDraftState.value : null;
	const setSeekDraft = (value: number | null) =>
		setSeekDraftState({ signature, value });

	useEffect(() => {
		setNow(Date.now());
		if (!bgm?.playing || durationMs <= 0) {
			return;
		}
		const id = window.setInterval(() => setNow(Date.now()), 250);
		return () => window.clearInterval(id);
	}, [bgm?.playing, durationMs]);

	let livePosition = 0;
	if (bgm) {
		livePosition = bgm.seekOffsetMs;
		if (bgm.playing) {
			livePosition += Math.max(0, now - bgm.startedAtMs);
		}
		if (durationMs > 0) {
			livePosition = bgm.loop
				? livePosition % durationMs
				: Math.min(livePosition, durationMs);
		}
	}
	const displayPosition = seekDraft ?? livePosition;

	function sendBgm(
		action: "play" | "pause" | "volume" | "loop" | "seek",
		extra: Record<string, unknown> = {},
	) {
		sendSessionCommand("audio:bgm", {
			action,
			expectedVersion: bgm?.version ?? 0,
			...extra,
		});
	}

	function playTrack(trackId: string, restart = false) {
		sendBgm("play", { trackId, ...(restart ? { restart: true } : {}) });
	}

	function togglePlay() {
		if (bgm?.playing) {
			sendBgm("pause");
			return;
		}
		sendBgm("play", { trackId: bgm?.trackId ?? bgmTracks[0]?.id });
	}

	function step(direction: -1 | 1) {
		if (bgmTracks.length === 0) {
			return;
		}
		const index = bgmTracks.findIndex((track) => track.id === bgm?.trackId);
		const next =
			bgmTracks[(index + direction + bgmTracks.length) % bgmTracks.length];
		if (next) {
			playTrack(next.id);
		}
	}

	function seek(positionMs: number) {
		const seekOffsetMs = Math.round(positionMs);
		setSeekDraft(seekOffsetMs);
		sendBgm("seek", { seekOffsetMs });
	}

	return {
		bgm,
		bgmTracks,
		soundEffects,
		current,
		durationMs,
		displayPosition,
		seekDraft,
		setSeekDraft,
		sendBgm,
		playTrack,
		togglePlay,
		previous: () => step(-1),
		next: () => step(1),
		seek,
	};
}

export { useBgmPlayback };
