declare module "@jitsi/rnnoise-wasm/dist/rnnoise-sync.js" {
	import type { RnnoiseWasmModule } from "./voice-processing";

	export default function createRNNWasmModuleSync(): RnnoiseWasmModule;
}

declare const sampleRate: number;

declare class AudioWorkletProcessor {
	readonly port: MessagePort;
	constructor();
}

declare function registerProcessor(
	name: string,
	processor: new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor,
): void;
