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

function isAudioContextRunning(context: AudioContext): boolean {
	return (context.state as string) === "running";
}

function isAudioContextClosed(context: AudioContext): boolean {
	return (context.state as string) === "closed";
}

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
	private keepaliveGain: GainNode | null = null;
	private readonly sources = new Map<string, TrackedSource>();
	private allowed = new Set<string>();
	private speakingIds: string[] = [];
	private timer: ReturnType<typeof setInterval> | null = null;
	private unlockAttached = false;
	private stateListenerContext: AudioContext | null = null;
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
			const ctx = this.createContext();
			this.context = ctx;
			if (ctx && typeof ctx.createGain === "function") {
				try {
					const keepalive = ctx.createGain();
					keepalive.gain.value = 0;
					keepalive.connect(ctx.destination);
					this.keepaliveGain = keepalive;
				} catch {
					this.keepaliveGain = null;
				}
			}
			if (ctx && !isAudioContextRunning(ctx) && !isAudioContextClosed(ctx)) {
				this.attachUnlock(ctx);
			}
		}
		return this.context;
	}

	private handleGesture = (): void => {
		this.resume();
	};

	private handleStateChange = (): void => {
		const ctx = this.context;
		if (!ctx || this.closed) return;
		if (isAudioContextRunning(ctx)) {
			this.detachUnlock();
			return;
		}
		if (!isAudioContextClosed(ctx)) {
			this.resume();
		}
	};

	private attachUnlock(ctx?: AudioContext): void {
		const target = ctx ?? this.context;
		if (
			target &&
			this.stateListenerContext !== target &&
			typeof target.addEventListener === "function"
		) {
			this.detachStateListener();
			this.stateListenerContext = target;
			target.addEventListener("statechange", this.handleStateChange);
		}
		if (this.unlockAttached || typeof window === "undefined" || this.closed) {
			return;
		}
		this.unlockAttached = true;
		window.addEventListener("pointerdown", this.handleGesture, {
			passive: true,
		});
		window.addEventListener("touchend", this.handleGesture, { passive: true });
		window.addEventListener("click", this.handleGesture, { passive: true });
		window.addEventListener("keydown", this.handleGesture, { passive: true });
	}

	private detachStateListener(): void {
		const target = this.stateListenerContext;
		if (target && typeof target.removeEventListener === "function") {
			target.removeEventListener("statechange", this.handleStateChange);
		}
		this.stateListenerContext = null;
	}

	private detachUnlock(): void {
		if (!this.unlockAttached || typeof window === "undefined") return;
		this.unlockAttached = false;
		window.removeEventListener("pointerdown", this.handleGesture);
		window.removeEventListener("touchend", this.handleGesture);
		window.removeEventListener("click", this.handleGesture);
		window.removeEventListener("keydown", this.handleGesture);
	}

	resume(): void {
		if (this.closed) return;
		const ctx = this.ensureContext();
		if (!ctx || isAudioContextClosed(ctx)) return;
		if (isAudioContextRunning(ctx)) {
			this.detachUnlock();
			return;
		}
		this.attachUnlock(ctx);
		try {
			void ctx
				.resume()
				.then(() => {
					if (this.context === ctx && isAudioContextRunning(ctx)) {
						this.detachUnlock();
					}
				})
				.catch(() => {});
		} catch {}
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
			const stream = "getTracks" in input ? input : new MediaStream([input]);
			const source = ctx.createMediaStreamSource(stream);
			const analyser = ctx.createAnalyser();
			analyser.fftSize = FFT_SIZE;
			analyser.smoothingTimeConstant = 0.25;
			source.connect(analyser);
			if (this.keepaliveGain) {
				analyser.connect(this.keepaliveGain);
			}
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
		this.detachStateListener();
		try {
			this.keepaliveGain?.disconnect();
		} catch {}
		this.keepaliveGain = null;
		const ctx = this.context;
		this.context = null;
		if (ctx && typeof ctx.close === "function" && !isAudioContextClosed(ctx)) {
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
	private ownsContext = true;
	private source: MediaStreamAudioSourceNode | null = null;
	private tapNode: AudioNode | null = null;
	private analyser: AnalyserNode | null = null;
	private gainNode: GainNode | null = null;
	private buffer: Uint8Array<ArrayBuffer> | null = null;
	private timer: ReturnType<typeof setInterval> | null = null;
	private lastDetectedAt = 0;
	private lastLevel = 0;
	private lastDetected = false;
	private loopback = false;
	private outputDeviceId = "default";
	private unlockAttached = false;
	private stateListenerContext: AudioContext | null = null;

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

	private readonly handleGesture = (): void => {
		this.resumeContext();
	};

	private readonly handleStateChange = (): void => {
		const ctx = this.context;
		if (!ctx) return;
		if (isAudioContextRunning(ctx)) {
			this.detachUnlock();
			this.sampleNow();
			return;
		}
		if (!isAudioContextClosed(ctx)) {
			this.resumeContext();
		}
	};

	private attachUnlock(ctx: AudioContext): void {
		if (
			this.stateListenerContext !== ctx &&
			typeof ctx.addEventListener === "function"
		) {
			this.detachStateListener();
			this.stateListenerContext = ctx;
			ctx.addEventListener("statechange", this.handleStateChange);
		}
		if (this.unlockAttached || typeof window === "undefined") return;
		this.unlockAttached = true;
		window.addEventListener("pointerdown", this.handleGesture, {
			passive: true,
		});
		window.addEventListener("touchend", this.handleGesture, { passive: true });
		window.addEventListener("click", this.handleGesture, { passive: true });
		window.addEventListener("keydown", this.handleGesture, { passive: true });
	}

	private detachStateListener(): void {
		const ctx = this.stateListenerContext;
		if (ctx && typeof ctx.removeEventListener === "function") {
			ctx.removeEventListener("statechange", this.handleStateChange);
		}
		this.stateListenerContext = null;
	}

	private detachUnlock(): void {
		if (!this.unlockAttached || typeof window === "undefined") return;
		this.unlockAttached = false;
		window.removeEventListener("pointerdown", this.handleGesture);
		window.removeEventListener("touchend", this.handleGesture);
		window.removeEventListener("click", this.handleGesture);
		window.removeEventListener("keydown", this.handleGesture);
	}

	private resumeContext(): void {
		const ctx = this.context;
		if (!ctx || isAudioContextClosed(ctx)) return;
		if (isAudioContextRunning(ctx)) {
			this.detachUnlock();
			return;
		}
		this.attachUnlock(ctx);
		try {
			void ctx
				.resume()
				.then(() => {
					if (this.context === ctx && isAudioContextRunning(ctx)) {
						this.detachUnlock();
						this.sampleNow();
					}
				})
				.catch(() => {});
		} catch {}
	}

	private attachMonitorGraph(ctx: AudioContext, upstream: AudioNode): void {
		const analyser = ctx.createAnalyser();
		analyser.fftSize = FFT_SIZE;
		analyser.smoothingTimeConstant = 0.25;
		upstream.connect(analyser);
		this.analyser = analyser;
		this.buffer = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
		if (typeof ctx.createGain === "function") {
			const gain = ctx.createGain();
			gain.gain.value = this.loopback ? 0.85 : 0;
			upstream.connect(gain);
			if (this.loopback) {
				gain.connect(ctx.destination);
			}
			this.gainNode = gain;
		}
		this.timer = setInterval(() => {
			this.sampleNow();
		}, this.pollMs);
	}

	start(stream: MediaStream): void {
		this.stop();
		const ctx = this.createContext();
		if (!ctx) return;
		this.context = ctx;
		this.ownsContext = true;
		this.applyOutputSink(ctx);
		this.resumeContext();
		try {
			const source = ctx.createMediaStreamSource(stream);
			this.source = source;
			this.attachMonitorGraph(ctx, source);
		} catch {
			this.stop();
		}
	}

	startTap(context: AudioContext, node: AudioNode): void {
		this.stop();
		this.context = context;
		this.ownsContext = false;
		this.tapNode = node;
		this.applyOutputSink(context);
		this.resumeContext();
		try {
			this.attachMonitorGraph(context, node);
		} catch {
			this.stop();
		}
	}

	setOutputDevice(deviceId: string): void {
		const next = deviceId || "default";
		if (this.outputDeviceId === next) return;
		this.outputDeviceId = next;
		if (this.context) {
			this.applyOutputSink(this.context);
		}
	}

	private applyOutputSink(ctx: AudioContext): void {
		const sinkable = ctx as AudioContext & {
			setSinkId?: (sinkId: string) => Promise<void>;
		};
		if (typeof sinkable.setSinkId !== "function" || isAudioContextClosed(ctx)) {
			return;
		}
		const target = this.outputDeviceId === "default" ? "" : this.outputDeviceId;
		try {
			void sinkable.setSinkId(target).catch(() => {});
		} catch {}
	}

	setLoopback(enabled: boolean): void {
		this.loopback = enabled;
		const ctx = this.context;
		const gain = this.gainNode;
		if (!ctx || !gain) return;
		if (enabled) {
			this.applyOutputSink(ctx);
		}
		if (enabled && !isAudioContextRunning(ctx) && !isAudioContextClosed(ctx)) {
			this.resumeContext();
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
		if (isAudioContextRunning(ctx)) {
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
		this.detachUnlock();
		this.detachStateListener();
		if (this.tapNode) {
			try {
				if (this.analyser) this.tapNode.disconnect(this.analyser);
			} catch {}
			try {
				if (this.gainNode) this.tapNode.disconnect(this.gainNode);
			} catch {}
		}
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
		this.tapNode = null;
		this.analyser = null;
		this.buffer = null;
		const ctx = this.context;
		const shouldClose = this.ownsContext;
		this.context = null;
		this.ownsContext = true;
		if (
			shouldClose &&
			ctx &&
			typeof ctx.close === "function" &&
			!isAudioContextClosed(ctx)
		) {
			void ctx.close().catch(() => {});
		}
		if (this.lastLevel !== 0 || this.lastDetected) {
			this.lastLevel = 0;
			this.lastDetected = false;
			this.onSample(0, false);
		}
	}
}
