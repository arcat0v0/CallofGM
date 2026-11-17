import { useEffect, useState } from "react";
import { t } from "@/i18n";
import { sendSessionCommand } from "@/lib/session-socket";
import { usePlayStore } from "@/stores/play-store";

function useBgmPlayback() {
	const bgm = usePlayStore((state) => state.bgm);
	const tracks = usePlayStore((state) => state.catalogTracks);
	const catalogStatus = usePlayStore((state) => state.catalogStatus);
	const connected = usePlayStore((state) => state.connected);
	const snapshotReady = usePlayStore((state) => state.snapshotReady);
	const lastRejection = usePlayStore((state) => state.lastRejection);
	const bgmTracks = tracks.filter((track) => track.type === "bgm");
	const soundEffects = tracks.filter((track) => track.type === "se");
	const current = bgmTracks.find((track) => track.id === bgm?.trackId);
	const durationMs = bgm?.durationMs ?? 0;
	const version = bgm?.version ?? 0;
	const [now, setNow] = useState(() => Date.now());
	const [pendingCommand, setPendingCommand] = useState<{
		version: number;
		id: string;
	} | null>(null);
	const pendingCommandId =
		pendingCommand?.version === version ? pendingCommand.id : null;
	const [commandErrorState, setCommandErrorState] = useState<{
		version: number;
		message: string;
	} | null>(null);
	const commandError =
		commandErrorState?.version === version ? commandErrorState.message : null;
	const signature = `${version}:${bgm?.seekOffsetMs ?? -1}`;
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
	const volumeSignature = `${version}:${bgm?.volume ?? 100}`;
	const [volumeDraftState, setVolumeDraftState] = useState<{
		signature: string;
		value: number | null;
	}>({
		signature: volumeSignature,
		value: null,
	});
	const volumeDraft =
		volumeDraftState.signature === volumeSignature
			? volumeDraftState.value
			: null;
	const setVolumeDraft = (value: number | null) =>
		setVolumeDraftState({ signature: volumeSignature, value });

	useEffect(() => {
		setNow(Date.now());
		if (!bgm?.playing || durationMs <= 0) {
			return;
		}
		const id = window.setInterval(() => setNow(Date.now()), 250);
		return () => window.clearInterval(id);
	}, [bgm, durationMs]);

	useEffect(() => {
		if (pendingCommandId && lastRejection?.commandId === pendingCommandId) {
			setPendingCommand(null);
			setCommandErrorState({ version, message: lastRejection.message });
		}
	}, [lastRejection, pendingCommandId, version]);

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
	const displayVolume = volumeDraft ?? Math.round(bgm?.volume ?? 100);

	function sendBgm(
		action: "play" | "pause" | "volume" | "loop" | "seek",
		extra: Record<string, unknown> = {},
	) {
		if (!connected || pendingCommandId) {
			return null;
		}
		setCommandErrorState(null);
		const commandId = sendSessionCommand("audio:bgm", {
			action,
			expectedVersion: version,
			...extra,
		});
		if (commandId) {
			setPendingCommand({ version, id: commandId });
		} else {
			setCommandErrorState({ version, message: t("play.notConnected") });
		}
		return commandId;
	}

	function playTrack(trackId: string, restart = false) {
		sendBgm("play", { trackId, ...(restart ? { restart: true } : {}) });
	}

	function togglePlay() {
		if (bgm?.playing) {
			sendBgm("pause");
			return;
		}
		const trackId = bgm?.trackId ?? bgmTracks[0]?.id;
		if (trackId) {
			sendBgm("play", { trackId });
		}
	}

	function step(direction: -1 | 1) {
		if (bgmTracks.length === 0) {
			return;
		}
		const index = bgmTracks.findIndex((track) => track.id === bgm?.trackId);
		const nextIndex =
			index < 0
				? direction === 1
					? 0
					: bgmTracks.length - 1
				: (index + direction + bgmTracks.length) % bgmTracks.length;
		const next = bgmTracks[nextIndex];
		if (next) {
			playTrack(next.id);
		}
	}

	function seek(positionMs: number) {
		const seekOffsetMs = Math.round(positionMs);
		setSeekDraft(seekOffsetMs);
		if (!sendBgm("seek", { seekOffsetMs })) {
			setSeekDraft(null);
		}
	}

	function commitVolume(volume: number) {
		const nextVolume = Math.round(volume);
		setVolumeDraft(nextVolume);
		if (!sendBgm("volume", { volume: nextVolume })) {
			setVolumeDraft(null);
		}
	}

	return {
		bgm,
		catalogTracks: tracks,
		bgmTracks,
		soundEffects,
		catalogStatus,
		connected,
		snapshotReady,
		current,
		durationMs,
		displayPosition,
		displayVolume,
		seekDraft,
		setSeekDraft,
		setVolumeDraft,
		commitVolume,
		sendBgm,
		playTrack,
		togglePlay,
		previous: () => step(-1),
		next: () => step(1),
		seek,
		commandPending: pendingCommandId !== null,
		commandError,
	};
}

export { useBgmPlayback };
