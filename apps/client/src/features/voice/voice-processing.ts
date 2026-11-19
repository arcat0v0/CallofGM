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

	processFrame(frame: Float32Array): void {
		if (this.destroyed || frame.length !== RNNOISE_FRAME_SIZE) {
			throw new Error("Invalid RNNoise frame");
		}
		const heap = this.wasm.HEAPF32;
		for (let index = 0; index < RNNOISE_FRAME_SIZE; index += 1) {
			heap[this.inputIndex + index] = (frame[index] ?? 0) * 32_768;
		}
		this.wasm._rnnoise_process_frame(
			this.context,
			this.inputPointer,
			this.inputPointer,
		);
		const outputHeap = this.wasm.HEAPF32;
		for (let index = 0; index < RNNOISE_FRAME_SIZE; index += 1) {
			frame[index] = (outputHeap[this.inputIndex + index] ?? 0) / 32_768;
		}
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
};

export const DEFAULT_NOISE_GATE_SETTINGS: NoiseGateSettings = {
	enabled: true,
	thresholdDb: -48,
	attackMs: 4,
	releaseMs: 120,
	hangoverMs: 180,
};

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

	reset(): void {
		this.envelope = 0;
		this.gain = 0;
		this.holdRemaining = 0;
		this.open = false;
	}

	process(samples: Float32Array, sampleRate: number): void {
		if (!this.settings.enabled) return;
		for (let index = 0; index < samples.length; index += 1) {
			const sample = samples[index] ?? 0;
			const magnitude = Math.abs(sample);
			const envelopeCoefficient =
				magnitude > this.envelope
					? this.attackCoefficient
					: this.releaseCoefficient;
			this.envelope += (magnitude - this.envelope) * envelopeCoefficient;
			if (magnitude >= this.threshold || this.envelope >= this.threshold) {
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

export type VoicePcmProcessorOptions = {
	rnnoise?: RnnoiseProcessor | null;
	gate?: NoiseGateSettings;
	sampleRate?: number;
};

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
	private rnnoise: RnnoiseProcessor | null;
	private inputLength = 0;
	private processedLength = 0;
	private outputIndex = 0;
	private delayRemaining = RNNOISE_FRAME_SIZE;

	constructor(options: VoicePcmProcessorOptions = {}) {
		this.rnnoise = options.rnnoise ?? null;
		this.gate = new NoiseGate(
			options.gate ?? { ...DEFAULT_NOISE_GATE_SETTINGS, enabled: false },
			options.sampleRate ?? VOICE_SAMPLE_RATE,
		);
	}

	get hasRnnoise(): boolean {
		return this.rnnoise !== null;
	}

	setRnnoise(rnnoise: RnnoiseProcessor | null): void {
		if (this.rnnoise === rnnoise) return;
		this.rnnoise?.destroy();
		this.rnnoise = rnnoise;
		this.resetRing();
	}

	updateGate(settings: Partial<NoiseGateSettings>, sampleRate: number): void {
		this.gate.update(settings, sampleRate);
	}

	process(input: Float32Array, output: Float32Array, sampleRate: number): void {
		if (!this.rnnoise) {
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
			this.rnnoise.processFrame(frame);
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
		this.setRnnoise(null);
		this.gate.reset();
	}

	private resetRing(): void {
		this.inputLength = 0;
		this.processedLength = 0;
		this.outputIndex = 0;
		this.delayRemaining = RNNOISE_FRAME_SIZE;
	}
}
