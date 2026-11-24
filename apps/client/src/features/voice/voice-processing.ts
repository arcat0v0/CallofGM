export const VOICE_SAMPLE_RATE = 48_000;
export const VOICE_WORKLET_QUANTUM = 128;
export const RNNOISE_FRAME_SIZE = 480;
export const VOICE_RING_SIZE = 1_920;

export type RnnoiseWasmModule = {
	HEAPF32: Float32Array;
	_malloc: (size: number) => number;
	_free: (pointer: number) => void;
	_rnnoise_create: () => number;
	_rnnoise_destroy: (context: number) => void;
	_rnnoise_process_frame: (
		context: number,
		input: number,
		output: number,
	) => number;
};

export class RnnoiseProcessor {
	private readonly wasm: RnnoiseWasmModule;
	private readonly inputPointer: number;
	private readonly inputIndex: number;
	private context = 0;
	private destroyed = false;

	constructor(wasm: RnnoiseWasmModule) {
		this.wasm = wasm;
		this.inputPointer = wasm._malloc(
			RNNOISE_FRAME_SIZE * Float32Array.BYTES_PER_ELEMENT,
		);
		if (!this.inputPointer) throw new Error("RNNoise input allocation failed");
		this.inputIndex = this.inputPointer >> 2;
		try {
			this.context = wasm._rnnoise_create();
		} catch (error) {
			wasm._free(this.inputPointer);
			throw error;
		}
		if (!this.context) {
			wasm._free(this.inputPointer);
			throw new Error("RNNoise context allocation failed");
		}
	}

	/** Denoises `frame` in place; returns the voice activity probability. */
	processFrame(frame: Float32Array): number {
		const voice = this.run(frame);
		const outputHeap = this.wasm.HEAPF32;
		for (let index = 0; index < RNNOISE_FRAME_SIZE; index += 1) {
			frame[index] = (outputHeap[this.inputIndex + index] ?? 0) / 32_768;
		}
		return voice;
	}

	/** Runs the model for its voice activity probability; `frame` is untouched. */
	analyzeFrame(frame: Float32Array): number {
		return this.run(frame);
	}

	private run(frame: Float32Array): number {
		if (this.destroyed || frame.length !== RNNOISE_FRAME_SIZE) {
			throw new Error("Invalid RNNoise frame");
		}
		const heap = this.wasm.HEAPF32;
		for (let index = 0; index < RNNOISE_FRAME_SIZE; index += 1) {
			heap[this.inputIndex + index] = (frame[index] ?? 0) * 32_768;
		}
		const voice = this.wasm._rnnoise_process_frame(
			this.context,
			this.inputPointer,
			this.inputPointer,
		);
		return Number.isFinite(voice) ? voice : 0;
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		if (this.context) this.wasm._rnnoise_destroy(this.context);
		this.context = 0;
		this.wasm._free(this.inputPointer);
	}
}

export type NoiseGateSettings = {
	enabled: boolean;
	thresholdDb: number;
	attackMs: number;
	releaseMs: number;
	hangoverMs: number;
	/** Voice probability (0..1) at or above which speech is detected. */
	voiceOpen?: number;
	/** Voice probability below which speech ends (hysteresis with voiceOpen). */
	voiceClose?: number;
};

export const DEFAULT_NOISE_GATE_SETTINGS: NoiseGateSettings = {
	enabled: true,
	thresholdDb: -48,
	attackMs: 4,
	releaseMs: 120,
	hangoverMs: 180,
	voiceOpen: 0.6,
	voiceClose: 0.25,
};

/**
 * Level gate with an optional voice-activity condition. When a voice
 * probability is supplied per frame (RNNoise VAD), the gate only opens for
 * frames that are both loud enough and detected as speech, so breathing,
 * clicks and other non-speech sounds between phrases stay muted.
 */
export class NoiseGate {
	private settings: NoiseGateSettings;
	private threshold: number;
	private attackCoefficient: number;
	private releaseCoefficient: number;
	private hangoverSamples: number;
	private envelope = 0;
	private gain = 0;
	private holdRemaining = 0;
	private open = false;
	private voiceActive: boolean | null = null;

	constructor(settings: NoiseGateSettings, sampleRate: number) {
		this.settings = { ...settings };
		this.threshold = 0;
		this.attackCoefficient = 0;
		this.releaseCoefficient = 0;
		this.hangoverSamples = 0;
		this.update(settings, sampleRate);
	}

	get isOpen(): boolean {
		return this.open;
	}

	/** Speech state from the last voice probability; null when unknown. */
	get isVoiceActive(): boolean | null {
		return this.voiceActive;
	}

	update(settings: Partial<NoiseGateSettings>, sampleRate: number): void {
		const wasEnabled = this.settings.enabled;
		this.settings = { ...this.settings, ...settings };
		this.threshold = 10 ** (this.settings.thresholdDb / 20);
		this.attackCoefficient = this.coefficient(
			this.settings.attackMs,
			sampleRate,
		);
		this.releaseCoefficient = this.coefficient(
			this.settings.releaseMs,
			sampleRate,
		);
		this.hangoverSamples = Math.max(
			0,
			Math.round((this.settings.hangoverMs / 1_000) * sampleRate),
		);
		if (!this.settings.enabled || !wasEnabled) this.reset();
	}

	/** Feeds the voice probability (0..1) of the latest frame, or null. */
	setVoiceProbability(probability: number | null): void {
		if (probability === null || !Number.isFinite(probability)) {
			this.voiceActive = null;
			return;
		}
		const open = this.settings.voiceOpen ?? 0.6;
		const close = Math.min(this.settings.voiceClose ?? 0.25, open);
		if (probability >= open) {
			this.voiceActive = true;
		} else if (probability < close || this.voiceActive === null) {
			this.voiceActive = false;
		}
	}

	reset(): void {
		this.envelope = 0;
		this.gain = 0;
		this.holdRemaining = 0;
		this.open = false;
		this.voiceActive = null;
	}

	process(samples: Float32Array, sampleRate: number): void {
		if (!this.settings.enabled) return;
		const voiceBlocked = this.voiceActive === false;
		for (let index = 0; index < samples.length; index += 1) {
			const sample = samples[index] ?? 0;
			const magnitude = Math.abs(sample);
			const envelopeCoefficient =
				magnitude > this.envelope
					? this.attackCoefficient
					: this.releaseCoefficient;
			this.envelope += (magnitude - this.envelope) * envelopeCoefficient;
			const loud =
				magnitude >= this.threshold || this.envelope >= this.threshold;
			if (loud && !voiceBlocked) {
				this.holdRemaining = this.hangoverSamples;
				this.open = true;
			} else if (this.holdRemaining > 0) {
				this.holdRemaining -= 1;
			} else {
				this.open = false;
			}
			const target = this.open ? 1 : 0;
			const gainCoefficient =
				target > this.gain ? this.attackCoefficient : this.releaseCoefficient;
			this.gain += (target - this.gain) * gainCoefficient;
			samples[index] = sample * this.gain;
		}
		if (sampleRate <= 0) this.reset();
	}

	private coefficient(milliseconds: number, sampleRate: number): number {
		return milliseconds <= 0 || sampleRate <= 0
			? 1
			: 1 - Math.exp(-1 / ((milliseconds / 1_000) * sampleRate));
	}
}

/** Frame denoiser shared by RNNoise and DeepFilterNet3 (480-sample frames). */
export type VoiceFrameDenoiser = {
	processFrame: (frame: Float32Array) => number;
	destroy: () => void;
};

export type VoiceNoiseEngine = "deepfilter" | "rnnoise" | "none";

export type VoicePcmProcessorOptions = {
	rnnoise?: RnnoiseProcessor | null;
	deepFilter?: VoiceFrameDenoiser | null;
	gate?: NoiseGateSettings;
	sampleRate?: number;
	/** Called after an engine threw; the engine has been dropped. */
	onEngineError?: (engine: Exclude<VoiceNoiseEngine, "none">) => void;
};

/**
 * Worklet-side PCM chain: 128-sample render quanta are collected into
 * 480-sample frames for the active denoiser, played out with one frame of
 * delay, then passed through the gate.
 *
 * With DeepFilterNet3 active, RNNoise (when present) only analyzes the raw
 * frame for its voice probability, which drives the gate and is ready as an
 * immediate fallback if DeepFilterNet3 fails.
 */
export class VoicePcmProcessor {
	private readonly ring = new Float32Array(VOICE_RING_SIZE);
	private readonly frames = Array.from(
		{ length: VOICE_RING_SIZE / RNNOISE_FRAME_SIZE },
		(_, index) =>
			this.ring.subarray(
				index * RNNOISE_FRAME_SIZE,
				(index + 1) * RNNOISE_FRAME_SIZE,
			),
	);
	private readonly gate: NoiseGate;
	private readonly onEngineError: VoicePcmProcessorOptions["onEngineError"];
	private rnnoise: RnnoiseProcessor | null;
	private deepFilter: VoiceFrameDenoiser | null;
	private inputLength = 0;
	private processedLength = 0;
	private outputIndex = 0;
	private delayRemaining = RNNOISE_FRAME_SIZE;

	constructor(options: VoicePcmProcessorOptions = {}) {
		this.rnnoise = options.rnnoise ?? null;
		this.deepFilter = options.deepFilter ?? null;
		this.onEngineError = options.onEngineError;
		this.gate = new NoiseGate(
			options.gate ?? { ...DEFAULT_NOISE_GATE_SETTINGS, enabled: false },
			options.sampleRate ?? VOICE_SAMPLE_RATE,
		);
	}

	get hasRnnoise(): boolean {
		return this.rnnoise !== null;
	}

	get hasDeepFilter(): boolean {
		return this.deepFilter !== null;
	}

	/** The denoiser whose output is heard. */
	get engine(): VoiceNoiseEngine {
		return this.deepFilter ? "deepfilter" : this.rnnoise ? "rnnoise" : "none";
	}

	setRnnoise(rnnoise: RnnoiseProcessor | null): void {
		if (this.rnnoise === rnnoise) return;
		const hadEngine = this.engine !== "none";
		this.rnnoise?.destroy();
		this.rnnoise = rnnoise;
		this.afterEngineChange(hadEngine);
	}

	setDeepFilter(deepFilter: VoiceFrameDenoiser | null): void {
		if (this.deepFilter === deepFilter) return;
		const hadEngine = this.engine !== "none";
		safeDestroy(this.deepFilter);
		this.deepFilter = deepFilter;
		this.afterEngineChange(hadEngine);
	}

	updateGate(settings: Partial<NoiseGateSettings>, sampleRate: number): void {
		this.gate.update(settings, sampleRate);
	}

	process(input: Float32Array, output: Float32Array, sampleRate: number): void {
		if (this.engine === "none") {
			const length = Math.min(input.length, output.length);
			for (let index = 0; index < length; index += 1) {
				output[index] = input[index] ?? 0;
			}
			if (length < output.length) output.fill(0, length);
			this.gate.process(output, sampleRate);
			return;
		}
		if (
			input.length !== VOICE_WORKLET_QUANTUM ||
			output.length !== input.length
		) {
			throw new Error("Unexpected RNNoise render quantum");
		}
		this.ring.set(input, this.inputLength);
		this.inputLength += input.length;
		if (this.processedLength + RNNOISE_FRAME_SIZE <= this.inputLength) {
			const frame = this.frames[this.processedLength / RNNOISE_FRAME_SIZE];
			if (!frame) throw new Error("Invalid RNNoise ring state");
			this.processFrame(frame);
			this.processedLength += RNNOISE_FRAME_SIZE;
		}
		const silence = Math.min(this.delayRemaining, output.length);
		this.delayRemaining -= silence;
		if (silence) output.fill(0, 0, silence);
		for (let index = silence; index < output.length; index += 1) {
			output[index] = this.ring[this.outputIndex] ?? 0;
			this.outputIndex += 1;
			if (this.outputIndex === VOICE_RING_SIZE) this.outputIndex = 0;
		}
		if (this.inputLength === VOICE_RING_SIZE) {
			this.inputLength = 0;
			this.processedLength = 0;
		}
		this.gate.process(output, sampleRate);
	}

	destroy(): void {
		this.setDeepFilter(null);
		this.setRnnoise(null);
		this.gate.reset();
	}

	private processFrame(frame: Float32Array): void {
		let voice: number | null = null;
		const deepFilter = this.deepFilter;
		const rnnoise = this.rnnoise;
		if (deepFilter) {
			if (rnnoise) {
				try {
					voice = rnnoise.analyzeFrame(frame);
				} catch {
					this.dropRnnoise();
				}
			}
			try {
				deepFilter.processFrame(frame);
			} catch {
				this.deepFilter = null;
				safeDestroy(deepFilter);
				this.onEngineError?.("deepfilter");
			}
		} else if (rnnoise) {
			try {
				voice = rnnoise.processFrame(frame);
			} catch {
				this.dropRnnoise();
			}
		}
		this.gate.setVoiceProbability(voice);
	}

	private dropRnnoise(): void {
		const rnnoise = this.rnnoise;
		this.rnnoise = null;
		try {
			rnnoise?.destroy();
		} catch {}
		this.onEngineError?.("rnnoise");
	}

	private afterEngineChange(hadEngine: boolean): void {
		if (this.engine === "none") {
			this.gate.setVoiceProbability(null);
		} else if (!hadEngine) {
			this.resetRing();
		}
	}

	private resetRing(): void {
		this.inputLength = 0;
		this.processedLength = 0;
		this.outputIndex = 0;
		this.delayRemaining = RNNOISE_FRAME_SIZE;
	}
}

function safeDestroy(denoiser: VoiceFrameDenoiser | null): void {
	try {
		denoiser?.destroy();
	} catch {}
}
