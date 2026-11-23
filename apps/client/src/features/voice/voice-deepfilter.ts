import { RNNOISE_FRAME_SIZE } from "./voice-processing";

/** Raw exports of `deepfilternet3-runtime.bin` (see native/deepfilter-wasm). */
export type DeepFilterWasmExports = {
	memory: WebAssembly.Memory;
	cogm_df_alloc: (length: number) => number;
	cogm_df_free: (pointer: number, length: number) => void;
	cogm_df_create: (
		model: number,
		length: number,
		attenuationLimitDb: number,
		postFilterBeta: number,
	) => number;
	cogm_df_frame_length: (state: number) => number;
	cogm_df_input: (state: number) => number;
	cogm_df_output: (state: number) => number;
	cogm_df_process: (state: number) => number;
	cogm_df_set_atten_lim: (state: number, attenuationLimitDb: number) => void;
	cogm_df_set_post_filter_beta: (state: number, beta: number) => void;
	cogm_df_destroy: (state: number) => void;
};

/** Uncompressed WebAssembly bytes plus the `.tar.gz` ONNX model. */
export type DeepFilterAssets = {
	wasm: ArrayBuffer;
	model: ArrayBuffer;
};

/** 100 dB or more means no limit: noise-only frames become silent. */
export const DEEP_FILTER_ATTENUATION_LIMIT_DB = 100;

export function instantiateDeepFilterWasm(
	wasm: ArrayBuffer | WebAssembly.Module,
): DeepFilterWasmExports {
	const module =
		wasm instanceof WebAssembly.Module ? wasm : new WebAssembly.Module(wasm);
	const instance = new WebAssembly.Instance(module, {});
	return instance.exports as unknown as DeepFilterWasmExports;
}

/**
 * DeepFilterNet3 running inside the AudioWorklet. Processes the same
 * 480-sample (10 ms at 48 kHz) frames as RNNoise, in place.
 */
export class DeepFilterProcessor {
	private readonly wasm: DeepFilterWasmExports;
	private state: number;
	private readonly inputPointer: number;
	private readonly outputPointer: number;
	private buffer: ArrayBuffer | null = null;
	private input: Float32Array = new Float32Array(0);
	private output: Float32Array = new Float32Array(0);

	constructor(
		wasm: DeepFilterWasmExports,
		model: ArrayBuffer,
		attenuationLimitDb = DEEP_FILTER_ATTENUATION_LIMIT_DB,
	) {
		this.wasm = wasm;
		const bytes = new Uint8Array(model);
		const modelPointer = wasm.cogm_df_alloc(bytes.length);
		if (!modelPointer) throw new Error("DeepFilterNet model allocation failed");
		try {
			new Uint8Array(wasm.memory.buffer, modelPointer, bytes.length).set(bytes);
			this.state = wasm.cogm_df_create(
				modelPointer,
				bytes.length,
				attenuationLimitDb,
				0,
			);
		} finally {
			wasm.cogm_df_free(modelPointer, bytes.length);
		}
		if (!this.state) throw new Error("DeepFilterNet model could not be loaded");
		if (wasm.cogm_df_frame_length(this.state) !== RNNOISE_FRAME_SIZE) {
			wasm.cogm_df_destroy(this.state);
			this.state = 0;
			throw new Error("Unexpected DeepFilterNet frame length");
		}
		this.inputPointer = wasm.cogm_df_input(this.state);
		this.outputPointer = wasm.cogm_df_output(this.state);
	}

	static create(
		assets: DeepFilterAssets,
		attenuationLimitDb?: number,
	): DeepFilterProcessor {
		return new DeepFilterProcessor(
			instantiateDeepFilterWasm(assets.wasm),
			assets.model,
			attenuationLimitDb,
		);
	}

	/** Denoises `frame` in place; returns the local SNR estimate in dB. */
	processFrame(frame: Float32Array): number {
		if (!this.state || frame.length !== RNNOISE_FRAME_SIZE) {
			throw new Error("Invalid DeepFilterNet frame");
		}
		this.views().input.set(frame);
		const snr = this.wasm.cogm_df_process(this.state);
		if (Number.isNaN(snr)) throw new Error("DeepFilterNet frame failed");
		// Processing may grow memory, which detaches the previous views.
		frame.set(this.views().output);
		return snr;
	}

	setAttenuationLimit(attenuationLimitDb: number): void {
		if (this.state) {
			this.wasm.cogm_df_set_atten_lim(this.state, attenuationLimitDb);
		}
	}

	destroy(): void {
		if (!this.state) return;
		const state = this.state;
		this.state = 0;
		this.buffer = null;
		this.wasm.cogm_df_destroy(state);
	}

	private views(): { input: Float32Array; output: Float32Array } {
		const buffer = this.wasm.memory.buffer;
		if (buffer !== this.buffer) {
			this.buffer = buffer;
			this.input = new Float32Array(
				buffer,
				this.inputPointer,
				RNNOISE_FRAME_SIZE,
			);
			this.output = new Float32Array(
				buffer,
				this.outputPointer,
				RNNOISE_FRAME_SIZE,
			);
		}
		return { input: this.input, output: this.output };
	}
}
