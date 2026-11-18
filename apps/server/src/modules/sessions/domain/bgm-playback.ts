import type { BgmPlaybackMode, BgmState } from "@cogm/shared";
import type { RandomSource } from "@/platform/ports";

type BgmTrack = {
	id: string;
	name: string;
	duration: number;
	source: NonNullable<BgmState["source"]>;
	audioAssetId: string | null;
};

export class BgmPlayback {
	readonly state: BgmState;

	constructor(
		state: BgmState,
		private readonly now: number,
	) {
		this.state = { ...state };
	}

	position(): number {
		const duration = this.state.durationMs ?? 0;
		const position =
			this.state.seekOffsetMs +
			(this.state.playing ? Math.max(0, this.now - this.state.startedAtMs) : 0);
		if (duration <= 0) return position;
		return this.state.mode === "single"
			? position % duration
			: Math.min(position, duration);
	}

	isDue(): boolean {
		const duration = this.state.durationMs ?? 0;
		return (
			this.state.playing &&
			this.state.trackId !== null &&
			this.state.mode !== "single" &&
			(duration <= 0 || this.position() >= duration - 1000)
		);
	}

	changeMode(mode: BgmPlaybackMode): void {
		this.state.seekOffsetMs = this.position();
		this.state.startedAtMs = this.now;
		this.state.mode = mode;
	}

	pause(): void {
		this.state.seekOffsetMs = this.position();
		this.state.startedAtMs = this.now;
		this.state.playing = false;
	}

	finish(): void {
		this.pause();
		const durationMs = this.state.durationMs ?? 0;
		if (durationMs > 0) this.state.seekOffsetMs = durationMs;
	}

	play(track: BgmTrack, restart = false, seekOffsetMs?: number): void {
		const sameTrack = this.state.trackId === track.id;
		const position = sameTrack ? this.position() : 0;
		const completed = track.duration > 0 && position >= track.duration;
		Object.assign(this.state, {
			trackId: track.id,
			playing: true,
			seekOffsetMs: seekOffsetMs ?? (restart || completed ? 0 : position),
			startedAtMs: this.now,
			durationMs: track.duration,
			name: track.name,
			source: track.source,
			audioAssetId: track.audioAssetId,
			audioMimeType: undefined,
			playbackUrl:
				track.source === "upload"
					? `/api/v1/media/${track.audioAssetId}`
					: `/api/v1/music/tracks/${track.id}/stream`,
		});
	}

	step(candidates: BgmTrack[], direction: -1 | 1, random: RandomSource): void {
		if (candidates.length === 0) {
			this.finish();
			return;
		}
		let chosen: BgmTrack | undefined;
		if (this.state.mode === "shuffle") {
			const alternatives = candidates.filter(
				(track) => track.id !== this.state.trackId,
			);
			chosen =
				alternatives.length > 0
					? alternatives[random.randomInt(0, alternatives.length - 1)]
					: candidates[0];
		} else {
			const index = candidates.findIndex(
				(track) => track.id === this.state.trackId,
			);
			const nextIndex =
				index < 0
					? direction === 1
						? 0
						: candidates.length - 1
					: (index + direction + candidates.length) % candidates.length;
			chosen = candidates[nextIndex];
		}
		if (chosen) this.play(chosen, true);
	}
}
