import type { BgmPlaybackMode, BgmState } from "@cogm/shared";
import type { RandomSource } from "@/platform/ports";

type BgmTrack = {
	id: string;
	name: string;
	duration: number;
	source: string;
	audioAssetId: string | null;
};

export class BgmPlayback {
	readonly #state: BgmState;

	constructor(
		state: BgmState,
		private readonly now: number,
	) {
		this.#state = { ...state };
	}

	get trackId() {
		return this.#state.trackId;
	}
	get playing() {
		return this.#state.playing;
	}
	get volume() {
		return this.#state.volume;
	}
	get mode() {
		return this.#state.mode;
	}
	get version() {
		return this.#state.version;
	}

	toSnapshot(): BgmState {
		return { ...this.#state };
	}

	setVolume(volume: number): void {
		this.#state.volume = volume;
	}

	seek(offsetMs: number): void {
		this.#state.seekOffsetMs = offsetMs;
		this.#state.startedAtMs = this.now;
	}

	advanceVersion(): void {
		this.#state.version += 1;
	}

	position(): number {
		const duration = this.#state.durationMs ?? 0;
		const position =
			this.#state.seekOffsetMs +
			(this.#state.playing
				? Math.max(0, this.now - this.#state.startedAtMs)
				: 0);
		if (duration <= 0) return position;
		return this.#state.mode === "single"
			? position % duration
			: Math.min(position, duration);
	}

	isDue(): boolean {
		const duration = this.#state.durationMs ?? 0;
		return (
			this.#state.playing &&
			this.#state.trackId !== null &&
			this.#state.mode !== "single" &&
			(duration <= 0 || this.position() >= duration - 1000)
		);
	}

	changeMode(mode: BgmPlaybackMode): void {
		this.#state.seekOffsetMs = this.position();
		this.#state.startedAtMs = this.now;
		this.#state.mode = mode;
	}

	pause(): void {
		this.#state.seekOffsetMs = this.position();
		this.#state.startedAtMs = this.now;
		this.#state.playing = false;
	}

	finish(): void {
		this.pause();
		const durationMs = this.#state.durationMs ?? 0;
		if (durationMs > 0) this.#state.seekOffsetMs = durationMs;
	}

	play(track: BgmTrack, restart = false, seekOffsetMs?: number): void {
		const state = this.#state;
		const position =
			!restart && seekOffsetMs === undefined && state.trackId === track.id
				? this.position()
				: 0;
		const completed = track.duration > 0 && position >= track.duration;
		state.trackId = track.id;
		state.playing = true;
		state.seekOffsetMs = seekOffsetMs ?? (completed ? 0 : position);
		state.startedAtMs = this.now;
		state.durationMs = track.duration;
		state.name = track.name;
		state.source = track.source as NonNullable<BgmState["source"]>;
		state.audioAssetId = track.audioAssetId;
		state.audioMimeType = undefined;
		state.playbackUrl =
			track.source === "upload"
				? `/api/v1/media/${track.audioAssetId}`
				: `/api/v1/music/tracks/${track.id}/stream`;
	}

	step(
		candidates: readonly BgmTrack[],
		direction: -1 | 1,
		random: RandomSource,
	): void {
		if (candidates.length === 0) {
			this.finish();
			return;
		}
		let chosen: BgmTrack | undefined;
		if (this.mode === "shuffle") {
			let alternatives = 0;
			for (const track of candidates) {
				if (track.id !== this.trackId) alternatives += 1;
			}
			if (alternatives === 0) {
				chosen = candidates[0];
			} else {
				let pick = random.randomInt(0, alternatives - 1);
				for (const track of candidates) {
					if (track.id !== this.trackId && pick-- === 0) {
						chosen = track;
						break;
					}
				}
			}
		} else {
			const index = candidates.findIndex((track) => track.id === this.trackId);
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
