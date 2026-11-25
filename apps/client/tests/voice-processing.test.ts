import { describe, expect, mock, test } from "bun:test";
import createRNNWasmModuleSync from "@jitsi/rnnoise-wasm/dist/rnnoise-sync.js";
import { DeepFilterProcessor } from "@/features/voice/voice-deepfilter";
import { decodeDeepFilterRuntime } from "@/features/voice/voice-deepfilter-assets";
import {
	NoiseGate,
	RnnoiseProcessor,
	VoicePcmProcessor,
} from "@/features/voice/voice-processing";

const vendor = (name: string) =>
	new URL(`../src/features/voice/vendor/deepfilternet3/${name}`, import.meta.url)
		.pathname;

function fakeWasm() {
	const heap = new Float32Array(2048);
	const process = mock((_context: number, input: number, output: number) => {
		for (let index = 0; index < 480; index += 1) {
			heap[(output >> 2) + index] = (heap[(input >> 2) + index] ?? 0) * 0.5;
		}
		return 0.8;
	});
	let destroyed = 0;
	let freed = 0;
	return {
		HEAPF32: heap,
		process,
		get destroyed() {
			return destroyed;
		},
		get freed() {
			return freed;
		},
		_malloc: (_size: number) => 16,
		_free: (_pointer: number) => {
			freed += 1;
		},
		_rnnoise_create: () => 7,
		_rnnoise_destroy: (_context: number) => {
			destroyed += 1;
		},
		_rnnoise_process_frame: process,
	};
}

function channel(value: number): Float32Array<ArrayBuffer> {
	return new Float32Array(128).fill(value);
}

describe("voice PCM processing", () => {
	test("runs real RNNoise frames through the preallocated 128/480 ring", () => {
		const wasm = fakeWasm();
		const rnnoise = new RnnoiseProcessor(wasm);
		const processor = new VoicePcmProcessor({ rnnoise });
		const output = channel(0);
		const input = channel(1);
		for (let quantum = 0; quantum < 32; quantum += 1) {
			processor.process(input, output, 48_000);
			for (let index = 0; index < output.length; index += 1) {
				const sample = quantum * output.length + index;
				expect(output[index]).toBe(sample < 480 ? 0 : 0.5);
			}
		}
		expect(wasm.process).toHaveBeenCalledTimes(8);
		processor.destroy();
		expect(wasm.destroyed).toBe(1);
		expect(wasm.freed).toBe(1);
		processor.destroy();
		expect(wasm.destroyed).toBe(1);
	});

	test("executes the bundled RNNoise WASM on a 480-sample frame", () => {
		const processor = new RnnoiseProcessor(createRNNWasmModuleSync());
		const frame = new Float32Array(480);
		for (let index = 0; index < frame.length; index += 1) {
			frame[index] = Math.sin(index / 10) * 0.1 + (index % 2 ? 0.02 : -0.02);
		}
		const original = frame.slice();
		processor.processFrame(frame);
		expect(frame).not.toEqual(original);
		expect(frame.every((sample) => Number.isFinite(sample))).toBe(true);
		processor.destroy();
	});

	test("bypasses RNNoise without adding ring latency", () => {
		const processor = new VoicePcmProcessor();
		const output = channel(0);
		processor.process(channel(0.25), output, 48_000);
		expect(output[0]).toBeCloseTo(0.25, 5);
		expect(output[127]).toBeCloseTo(0.25, 5);
	});

	test("gate opens quickly, holds short pauses, and releases smoothly", () => {
		const gate = new NoiseGate(
			{
				enabled: true,
				thresholdDb: -45,
				attackMs: 4,
				releaseMs: 80,
				hangoverMs: 150,
			},
			48_000,
		);
		const loud = channel(0.2);
		for (let index = 0; index < 4; index += 1) {
			loud.fill(0.2);
			gate.process(loud, 48_000);
		}
		expect(loud[127]).toBeGreaterThan(0.16);
		const shortPause = channel(0);
		gate.process(shortPause, 48_000);
		expect(shortPause[127]).toBe(0);
		expect(gate.isOpen).toBe(true);
		for (let index = 0; index < 200; index += 1) {
			gate.process(channel(0), 48_000);
		}
		expect(gate.isOpen).toBe(false);
		const disabled = channel(0.1);
		gate.update({ enabled: false }, 48_000);
		gate.process(disabled, 48_000);
		expect(disabled[0]).toBeCloseTo(0.1, 5);
	});

	test("voice probability keeps loud non-speech muted and lets speech through", () => {
		const gate = new NoiseGate(
			{
				enabled: true,
				thresholdDb: -45,
				attackMs: 4,
				releaseMs: 80,
				hangoverMs: 150,
				voiceOpen: 0.6,
				voiceClose: 0.25,
			},
			48_000,
		);
		gate.setVoiceProbability(0.05);
		const breath = channel(0.2);
		for (let index = 0; index < 8; index += 1) {
			breath.fill(0.2);
			gate.process(breath, 48_000);
		}
		expect(gate.isOpen).toBe(false);
		expect(breath[127]).toBe(0);
		gate.setVoiceProbability(0.9);
		const speech = channel(0.2);
		for (let index = 0; index < 4; index += 1) {
			speech.fill(0.2);
			gate.process(speech, 48_000);
		}
		expect(gate.isOpen).toBe(true);
		expect(speech[127]).toBeGreaterThan(0.16);
		// Between the two thresholds the speech state holds.
		gate.setVoiceProbability(0.4);
		expect(gate.isVoiceActive).toBe(true);
		gate.setVoiceProbability(0.1);
		expect(gate.isVoiceActive).toBe(false);
		// Without a detector the gate is a plain level gate again.
		gate.setVoiceProbability(null);
		const loud = channel(0.2);
		gate.process(loud, 48_000);
		expect(gate.isOpen).toBe(true);
	});

	test("DeepFilterNet3 denoises while RNNoise only analyzes, and RNNoise takes over on failure", () => {
		const wasm = fakeWasm();
		wasm.process.mockImplementation(() => 0.9);
		const rnnoise = new RnnoiseProcessor(wasm);
		let failing = false;
		const deepFilter = {
			processFrame: mock((frame: Float32Array) => {
				if (failing) throw new Error("trap");
				frame.fill(0.25);
				return 12;
			}),
			destroy: mock(() => {}),
		};
		const onEngineError = mock((_engine: string) => {});
		const processor = new VoicePcmProcessor({
			rnnoise,
			deepFilter,
			onEngineError,
		});
		expect(processor.engine).toBe("deepfilter");
		const output = channel(0);
		for (let quantum = 0; quantum < 8; quantum += 1) {
			processor.process(channel(1), output, 48_000);
		}
		expect(wasm.process).toHaveBeenCalledTimes(2);
		expect(deepFilter.processFrame).toHaveBeenCalledTimes(2);
		expect(output[127]).toBe(0.25);
		failing = true;
		for (let quantum = 0; quantum < 8; quantum += 1) {
			processor.process(channel(1), output, 48_000);
		}
		expect(onEngineError).toHaveBeenCalledWith("deepfilter");
		expect(deepFilter.destroy).toHaveBeenCalledTimes(1);
		expect(processor.engine).toBe("rnnoise");
		processor.destroy();
	});

	test("decodes the shipped runtime whether or not a host already removed the gzip", async () => {
		const shipped = await Bun.file(vendor("deepfilternet3-runtime.bin")).arrayBuffer();
		const wasm = await decodeDeepFilterRuntime(shipped);
		expect(new Uint8Array(wasm, 0, 4)).toEqual(
			new Uint8Array([0x00, 0x61, 0x73, 0x6d]),
		);
		expect(await decodeDeepFilterRuntime(wasm)).toBe(wasm);
		await expect(
			decodeDeepFilterRuntime(new Uint8Array([1, 2, 3, 4]).buffer),
		).rejects.toThrow();
	});

	test("executes the shipped DeepFilterNet3 model and silences pure noise", async () => {
		const wasm = await decodeDeepFilterRuntime(
			await Bun.file(vendor("deepfilternet3-runtime.bin")).arrayBuffer(),
		);
		const model = await Bun.file(vendor("deepfilternet3-model.bin")).arrayBuffer();
		const processor = DeepFilterProcessor.create({ wasm, model });
		let seed = 7;
		const noise = () => {
			seed = (seed * 1_103_515_245 + 12_345) & 0x7fffffff;
			return (seed / 0x7fffffff - 0.5) * 0.1;
		};
		const frame = new Float32Array(480);
		let snr = 0;
		for (let index = 0; index < 60; index += 1) {
			for (let sample = 0; sample < frame.length; sample += 1) {
				frame[sample] = noise();
			}
			snr = processor.processFrame(frame);
			expect(frame.every((sample) => Number.isFinite(sample))).toBe(true);
		}
		expect(snr).toBeLessThan(0);
		expect(Math.max(...frame.map(Math.abs))).toBeLessThan(0.001);
		processor.destroy();
		expect(() => processor.processFrame(frame)).toThrow();
	}, 20_000);
});
