import createRNNWasmModuleSync from "@jitsi/rnnoise-wasm/dist/rnnoise-sync.js";
import {
	type DeepFilterAssets,
	DeepFilterProcessor,
	instantiateDeepFilterWasm,
} from "./voice-deepfilter";
import {
	DEFAULT_NOISE_GATE_SETTINGS,
	type NoiseGateSettings,
	RnnoiseProcessor,
	type VoiceNoiseEngine,
	VoicePcmProcessor,
} from "./voice-processing";

export type VoiceWorkletSettings = {
	/** Requested denoiser. DeepFilterNet3 waits for its assets and falls back to RNNoise. */
	engine: VoiceNoiseEngine;
	gate: NoiseGateSettings;
};

export type VoiceWorkletOptions = {
	settings: VoiceWorkletSettings;
	deepFilterAssets?: DeepFilterAssets | null;
};

export type VoiceWorkletMessage =
	| {
			type: "settings";
			settings: VoiceWorkletSettings;
			deepFilterAssets?: DeepFilterAssets | null;
	  }
	| { type: "dispose" };

/** Messages posted by the worklet. `engine` reports the denoiser now heard. */
export type VoiceWorkletEvent =
	| { type: "engine"; engine: VoiceNoiseEngine }
	| { type: "rnnoise-error" }
	| { type: "deepfilter-error" };

function createRnnoise(): RnnoiseProcessor {
	return new RnnoiseProcessor(createRNNWasmModuleSync());
}

class VoiceProcessingWorklet extends AudioWorkletProcessor {
	private readonly processor: VoicePcmProcessor;
	private disposed = false;
	private deepFilterModule: WebAssembly.Module | null = null;
	private deepFilterModel: ArrayBuffer | null = null;
	private deepFilterFailed = false;
	private rnnoiseFailed = false;
	private reportedEngine: VoiceNoiseEngine | null = null;

	constructor(options?: AudioWorkletNodeOptions) {
		super();
		const initial = options?.processorOptions as VoiceWorkletOptions | undefined;
		const settings = initial?.settings ?? {
			engine: "none",
			gate: { ...DEFAULT_NOISE_GATE_SETTINGS, enabled: false },
		};
		this.processor = new VoicePcmProcessor({
			sampleRate,
			gate: settings.gate,
			onEngineError: (engine) => {
				if (engine === "deepfilter") this.deepFilterFailed = true;
				else this.rnnoiseFailed = true;
				this.post(
					engine === "deepfilter"
						? { type: "deepfilter-error" }
						: { type: "rnnoise-error" },
				);
				this.reportEngine();
			},
		});
		this.port.onmessage = (event: MessageEvent<VoiceWorkletMessage>) => {
			const message = event.data;
			if (message.type === "dispose") {
				this.disposed = true;
				this.processor.destroy();
				this.port.close();
				return;
			}
			if (message.type !== "settings") return;
			this.applySettings(message.settings, message.deepFilterAssets);
		};
		this.applySettings(settings, initial?.deepFilterAssets);
	}

	process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
		if (this.disposed) return false;
		const input = inputs[0]?.[0];
		const output = outputs[0]?.[0];
		if (!output) return !this.disposed;
		if (!input) {
			output.fill(0);
			return true;
		}
		try {
			this.processor.process(input, output, sampleRate);
		} catch {
			this.rnnoiseFailed = true;
			this.deepFilterFailed = true;
			this.processor.setDeepFilter(null);
			this.processor.setRnnoise(null);
			this.processor.process(input, output, sampleRate);
			this.post({ type: "rnnoise-error" });
			this.reportEngine();
		}
		return !this.disposed;
	}

	private applySettings(
		settings: VoiceWorkletSettings,
		assets: DeepFilterAssets | null | undefined,
	): void {
		if (assets && !this.deepFilterModule && !this.deepFilterFailed) {
			try {
				this.deepFilterModule = new WebAssembly.Module(assets.wasm);
				this.deepFilterModel = assets.model;
			} catch {
				this.deepFilterFailed = true;
				this.post({ type: "deepfilter-error" });
			}
		}
		const wantsDeepFilter = settings.engine === "deepfilter";
		const wantsRnnoise = settings.engine !== "none";
		// RNNoise first: it is the fallback and, next to DeepFilterNet3, the
		// voice detector for the gate.
		if (!wantsRnnoise) {
			this.processor.setRnnoise(null);
		} else if (!this.processor.hasRnnoise && !this.rnnoiseFailed) {
			try {
				this.processor.setRnnoise(createRnnoise());
			} catch {
				this.rnnoiseFailed = true;
				this.post({ type: "rnnoise-error" });
			}
		}
		if (!wantsDeepFilter) {
			this.processor.setDeepFilter(null);
		} else if (
			!this.processor.hasDeepFilter &&
			!this.deepFilterFailed &&
			this.deepFilterModule &&
			this.deepFilterModel
		) {
			try {
				this.processor.setDeepFilter(
					new DeepFilterProcessor(
						instantiateDeepFilterWasm(this.deepFilterModule),
						this.deepFilterModel,
					),
				);
			} catch {
				this.deepFilterFailed = true;
				this.post({ type: "deepfilter-error" });
			}
		}
		this.processor.updateGate(settings.gate, sampleRate);
		this.reportEngine();
	}

	private reportEngine(): void {
		const engine = this.processor.engine;
		if (engine === this.reportedEngine) return;
		this.reportedEngine = engine;
		this.post({ type: "engine", engine });
	}

	private post(message: VoiceWorkletEvent): void {
		try {
			this.port.postMessage(message);
		} catch {}
	}
}

registerProcessor("cogm-voice-processing", VoiceProcessingWorklet);
