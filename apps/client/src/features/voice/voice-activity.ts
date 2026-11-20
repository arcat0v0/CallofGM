const DEFAULT_THRESHOLD = 0.018;
const DEFAULT_HANGOVER_MS = 450;
const DEFAULT_POLL_MS = 100;
const FFT_SIZE = 256;

export function computeRms(samples: Uint8Array): number {
	if (samples.length === 0) return 0;
	let sumSq = 0;
	for (let index = 0; index < samples.length; index += 1) {
		const centered = ((samples[index] ?? 128) - 128) / 128;
		sumSq += centered * centered;
	}
	return Math.sqrt(sumSq / samples.length);
}

type TrackedSource = {
	source: MediaStreamAudioSourceNode;
	analyser: AnalyserNode;
	buffer: Uint8Array<ArrayBuffer>;
	lastSpokeAt: number;
};

type ActivityMonitorOptions = {
	threshold?: number;
	hangoverMs?: number;
	pollMs?: number;
	createContext?: () => AudioContext | null;
};

function defaultAudioContext(): AudioContext | null {
	if (typeof globalThis === "undefined") return null;
	const AudioCtx =
		(globalThis as { AudioContext?: typeof AudioContext }).AudioContext ??
		(globalThis as { webkitAudioContext?: typeof AudioContext })
			.webkitAudioContext;
	if (!AudioCtx) return null;
	try {
		return new AudioCtx();
	} catch {
		return null;
	}
}

export class VoiceActivityMonitor {
	private readonly onChange: (speakingIds: string[]) => void;
	private readonly threshold: number;
	private readonly hangoverMs: number;
	private readonly pollMs: number;
	private readonly createContext: () => AudioContext | null;
	private context: AudioContext | null = null;
	private readonly sources = new Map<string, TrackedSource>();
	private allowed = new Set<string>();
	private speakingIds: string[] = [];
	private timer: ReturnType<typeof setInterval> | null = null;
	private unlockAttached = false;
	private closed = false;

	constructor(
		onChange: (speakingIds: string[]) => void,
		options: ActivityMonitorOptions = {},
	) {
		this.onChange = onChange;
		this.threshold = options.threshold ?? DEFAULT_THRESHOLD;
		this.hangoverMs = options.hangoverMs ?? DEFAULT_HANGOVER_MS;
		this.pollMs = options.pollMs ?? DEFAULT_POLL_MS;
		this.createContext = options.createContext ?? defaultAudioContext;
	}

	private ensureContext(): AudioContext | null {
		if (this.closed) return null;
		if (!this.context) {
			this.context = this.createContext();
			if (this.context?.state === "suspended") {
				this.attachUnlock();
			}
		}
		return this.context;
	}

	private handleGesture = (): void => {
		this.resume();
	};

	private attachUnlock(): void {
		if (
			this.unlockAttached ||
			typeof window === "undefined" ||
			this.closed
		) {
			return;
		}
		this.unlockAttached = true;
		window.addEventListener("pointerdown", this.handleGesture, {
			passive: true,
		});
		window.addEventListener("keydown", this.handleGesture, { passive: true });
	}

	private detachUnlock(): void {
		if (!this.unlockAttached || typeof window === "undefined") return;
		this.unlockAttached = false;
		window.removeEventListener("pointerdown", this.handleGesture);
		window.removeEventListener("keydown", this.handleGesture);
	}

	resume(): void {
		if (this.closed) return;
		const ctx = this.context;
		if (!ctx) return;
		if (ctx.state === "running") {
			this.detachUnlock();
			return;
		}
		if (ctx.state === "suspended") {
			this.attachUnlock();
			void ctx
				.resume()
				.then(() => {
					if (this.context?.state === "running") {
						this.detachUnlock();
					}
				})
				.catch(() => {});
		}
	}

	setTrack(key: string, input: MediaStream | MediaStreamTrack | null): void {
		this.removeTrack(key);
		if (!input || this.closed) {
			this.syncTimer();
			this.emitIfChanged(this.computeSpeaking(Date.now()));
			return;
		}
		const ctx = this.ensureContext();
		if (!ctx) return;
		try {
			const stream =
				"getTracks" in input ? input : new MediaStream([input]);
			const source = ctx.createMediaStreamSource(stream);
			const analyser = ctx.createAnalyser();
			analyser.fftSize = FFT_SIZE;
			analyser.smoothingTimeConstant = 0.25;
			source.connect(analyser);
			this.sources.set(key, {
				source,
				analyser,
				buffer: new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount)),
				lastSpokeAt: 0,
			});
			this.resume();
			this.syncTimer();
		} catch {
			// Ignore unsupported MediaStream instances (e.g. partial test mocks).
		}
	}

	private removeTrack(key: string): void {
		const existing = this.sources.get(key);
		if (!existing) return;
		try {
			existing.source.disconnect();
			existing.analyser.disconnect();
		} catch {}
		this.sources.delete(key);
	}

	setAllowed(allowed: ReadonlySet<string>): void {
		this.allowed = new Set(allowed);
		for (const [key, entry] of this.sources) {
			if (!this.allowed.has(key)) {
				entry.lastSpokeAt = 0;
			}
		}
		this.emitIfChanged(this.computeSpeaking(Date.now()));
	}

	getRms(key: string): number | null {
		const entry = this.sources.get(key);
		if (!entry || this.context?.state !== "running") return null;
		try {
			entry.analyser.getByteTimeDomainData(entry.buffer);
			return computeRms(entry.buffer);
		} catch {
			return null;
		}
	}

	sampleNow(now = Date.now()): string[] {
		const next = this.computeSpeaking(now);
		this.emitIfChanged(next);
		return next;
	}

	private computeSpeaking(now: number): string[] {
		const ctx = this.context;
		const active: string[] = [];
		for (const [key, entry] of this.sources) {
			if (!this.allowed.has(key)) {
				entry.lastSpokeAt = 0;
				continue;
			}
			if (ctx && ctx.state === "running") {
				entry.analyser.getByteTimeDomainData(entry.buffer);
				if (computeRms(entry.buffer) >= this.threshold) {
					entry.lastSpokeAt = now;
				}
			}
			if (entry.lastSpokeAt > 0 && now - entry.lastSpokeAt <= this.hangoverMs) {
				active.push(key);
			}
		}
		active.sort();
		return active;
	}

	private emitIfChanged(next: string[]): void {
		if (
			next.length === this.speakingIds.length &&
			next.every((id, index) => id === this.speakingIds[index])
		) {
			return;
		}
		this.speakingIds = next;
		this.onChange(next);
	}

	private syncTimer(): void {
		if (this.sources.size > 0 && !this.timer && !this.closed) {
			this.timer = setInterval(() => {
				this.sampleNow();
			}, this.pollMs);
		} else if (this.sources.size === 0 && this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	clear(): void {
		for (const key of [...this.sources.keys()]) {
			this.removeTrack(key);
		}
		this.allowed.clear();
		this.syncTimer();
		this.emitIfChanged([]);
	}

	close(): void {
		if (this.closed) return;
		this.clear();
		this.closed = true;
		this.detachUnlock();
		const ctx = this.context;
		this.context = null;
		if (ctx && typeof ctx.close === "function" && ctx.state !== "closed") {
			void ctx.close().catch(() => {});
		}
	}
}

export function micTestLevelFromRms(rms: number): number {
	if (!Number.isFinite(rms) || rms < 0.004) return 0;
	return Math.min(100, Math.round(Math.sqrt(rms) * 165));
}

type MicTesterOptions = {
	threshold?: number;
	hangoverMs?: number;
	pollMs?: number;
	createContext?: () => AudioContext | null;
};

export class VoiceMicTester {
	private readonly onSample: (level: number, detected: boolean) => void;
	private readonly threshold: number;
	private readonly hangoverMs: number;
	private readonly pollMs: number;
	private readonly createContext: () => AudioContext | null;
	private context: AudioContext | null = null;
	private source: MediaStreamAudioSourceNode | null = null;
	private analyser: AnalyserNode | null = null;
	private gainNode: GainNode | null = null;
	private buffer: Uint8Array<ArrayBuffer> | null = null;
	private timer: ReturnType<typeof setInterval> | null = null;
	private lastDetectedAt = 0;
	private lastLevel = 0;
	private lastDetected = false;
	private loopback = false;

	constructor(
		onSample: (level: number, detected: boolean) => void,
		options: MicTesterOptions = {},
	) {
		this.onSample = onSample;
		this.threshold = options.threshold ?? DEFAULT_THRESHOLD;
		this.hangoverMs = options.hangoverMs ?? DEFAULT_HANGOVER_MS;
		this.pollMs = options.pollMs ?? 65;
		this.createContext = options.createContext ?? defaultAudioContext;
	}

	start(stream: MediaStream): void {
		this.stop();
		const ctx = this.createContext();
		if (!ctx) return;
		this.context = ctx;
		if (ctx.state === "suspended") {
			void ctx.resume().catch(() => {});
		}
		try {
			const source = ctx.createMediaStreamSource(stream);
			const analyser = ctx.createAnalyser();
			analyser.fftSize = FFT_SIZE;
			analyser.smoothingTimeConstant = 0.25;
			source.connect(analyser);
			this.source = source;
			this.analyser = analyser;
			this.buffer = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
			if (typeof ctx.createGain === "function") {
				const gain = ctx.createGain();
				gain.gain.value = this.loopback ? 0.85 : 0;
				source.connect(gain);
				if (this.loopback) {
					gain.connect(ctx.destination);
				}
				this.gainNode = gain;
			}
			this.timer = setInterval(() => {
				this.sampleNow();
			}, this.pollMs);
		} catch {
			this.stop();
		}
	}

	setLoopback(enabled: boolean): void {
		this.loopback = enabled;
		const ctx = this.context;
		const gain = this.gainNode;
		if (!ctx || !gain) return;
		if (enabled && ctx.state === "suspended") {
			void ctx.resume().catch(() => {});
		}
		try {
			gain.gain.value = enabled ? 0.85 : 0;
			if (enabled) {
				gain.connect(ctx.destination);
			} else {
				gain.disconnect();
			}
		} catch {}
	}

	sampleNow(now = Date.now()): { level: number; detected: boolean } {
		const ctx = this.context;
		const analyser = this.analyser;
		const buffer = this.buffer;
		if (!ctx || !analyser || !buffer) {
			return { level: 0, detected: false };
		}
		let level = 0;
		if (ctx.state === "running") {
			analyser.getByteTimeDomainData(buffer);
			const rms = computeRms(buffer);
			level = micTestLevelFromRms(rms);
			if (rms >= this.threshold) {
				this.lastDetectedAt = now;
			}
		}
		const detected =
			this.lastDetectedAt > 0 && now - this.lastDetectedAt <= this.hangoverMs;
		if (level !== this.lastLevel || detected !== this.lastDetected) {
			this.lastLevel = level;
			this.lastDetected = detected;
			this.onSample(level, detected);
		}
		return { level, detected };
	}

	stop(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
		this.lastDetectedAt = 0;
		this.loopback = false;
		try {
			this.gainNode?.disconnect();
		} catch {}
		try {
			this.source?.disconnect();
		} catch {}
		try {
			this.analyser?.disconnect();
		} catch {}
		this.gainNode = null;
		this.source = null;
		this.analyser = null;
		this.buffer = null;
		const ctx = this.context;
		this.context = null;
		if (ctx && typeof ctx.close === "function" && ctx.state !== "closed") {
			void ctx.close().catch(() => {});
		}
		if (this.lastLevel !== 0 || this.lastDetected) {
			this.lastLevel = 0;
			this.lastDetected = false;
			this.onSample(0, false);
		}
	}
}
