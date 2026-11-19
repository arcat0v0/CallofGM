import createRNNWasmModuleSync from "@jitsi/rnnoise-wasm/dist/rnnoise-sync.js";
import {
	DEFAULT_NOISE_GATE_SETTINGS,
	type NoiseGateSettings,
	RnnoiseProcessor,
	VoicePcmProcessor,
} from "./voice-processing";

export type VoiceWorkletSettings = {
	rnnoise: boolean;
	gate: NoiseGateSettings;
};

export type VoiceWorkletMessage =
	| { type: "settings"; settings: VoiceWorkletSettings }
	| { type: "dispose" };

function createRnnoise(): RnnoiseProcessor {
	return new RnnoiseProcessor(createRNNWasmModuleSync());
}

class VoiceProcessingWorklet extends AudioWorkletProcessor {
	private readonly processor: VoicePcmProcessor;
	private disposed = false;

	constructor(options?: AudioWorkletNodeOptions) {
		super();
		const settings = options?.processorOptions as
			| VoiceWorkletSettings
			| undefined;
		let rnnoise: RnnoiseProcessor | null = null;
		if (settings?.rnnoise) {
			try {
				rnnoise = createRnnoise();
			} catch {
				this.port.postMessage({ type: "rnnoise-error" });
			}
		}
		this.processor = new VoicePcmProcessor({
			sampleRate,
			rnnoise,
			gate: settings?.gate ?? {
				...DEFAULT_NOISE_GATE_SETTINGS,
				enabled: false,
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
			if (!message.settings.rnnoise) {
				this.processor.setRnnoise(null);
			} else if (!this.processor.hasRnnoise) {
				try {
					this.processor.setRnnoise(createRnnoise());
				} catch {
					this.port.postMessage({ type: "rnnoise-error" });
				}
			}
			this.processor.updateGate(message.settings.gate, sampleRate);
		};
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
			this.processor.setRnnoise(null);
			this.processor.process(input, output, sampleRate);
			this.port.postMessage({ type: "rnnoise-error" });
		}
		return !this.disposed;
	}
}

registerProcessor("cogm-voice-processing", VoiceProcessingWorklet);
