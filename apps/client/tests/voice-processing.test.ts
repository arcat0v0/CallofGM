import { describe, expect, mock, test } from "bun:test";
import createRNNWasmModuleSync from "@jitsi/rnnoise-wasm/dist/rnnoise-sync.js";
import {
	NoiseGate,
	RnnoiseProcessor,
	VoicePcmProcessor,
} from "@/features/voice/voice-processing";

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
});
