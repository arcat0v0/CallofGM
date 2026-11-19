import { afterEach, describe, expect, mock, test } from "bun:test";
import {
	DEFAULT_VOICE_AUDIO_SETTINGS,
	readVoiceAudioSettings,
	writeVoiceAudioSettings,
} from "@/features/voice/voice-audio-settings";
import {
	buildVoiceCaptureConstraints,
	type VoiceAudioWorkletNodeLike,
	VoiceCapturePipeline,
} from "@/features/voice/voice-capture";

function constraintBoolean(value: unknown, fallback: boolean): boolean {
	if (
		typeof value === "object" &&
		value !== null &&
		"ideal" in value &&
		typeof value.ideal === "boolean"
	) {
		return value.ideal;
	}
	return fallback;
}

function fakeTrack(deviceId = "mic-a") {
	let settings = {
		deviceId,
		echoCancellation: true,
		noiseSuppression: true,
		autoGainControl: true,
		sampleRate: 48_000,
		channelCount: 1,
	};
	const track = {
		kind: "audio",
		enabled: true,
		stop: mock(() => {}),
		addEventListener: mock(() => {}),
		removeEventListener: mock(() => {}),
		getSettings: mock(() => settings),
		applyConstraints: mock(async (constraints: MediaTrackConstraints) => {
			settings = {
				...settings,
				echoCancellation: constraintBoolean(
					constraints.echoCancellation,
					settings.echoCancellation,
				),
				noiseSuppression: constraintBoolean(
					constraints.noiseSuppression,
					settings.noiseSuppression,
				),
				autoGainControl: constraintBoolean(
					constraints.autoGainControl,
					settings.autoGainControl,
				),
			};
		}),
	};
	return track;
}

function fakeStream(track: unknown): MediaStream {
	return {
		getTracks: () => [track],
		getAudioTracks: () => [track],
	} as unknown as MediaStream;
}

function fakeContext(workletError?: Error) {
	const destinationTrack = fakeTrack("processed");
	const destinationStream = fakeStream(destinationTrack);
	const source = { connect: mock(() => {}), disconnect: mock(() => {}) };
	const destination = {
		stream: destinationStream,
		connect: mock(() => {}),
		disconnect: mock(() => {}),
	};
	const compressor = {
		threshold: { value: 0 },
		knee: { value: 0 },
		ratio: { value: 1 },
		attack: { value: 0.003 },
		release: { value: 0.25 },
		connect: mock(() => {}),
		disconnect: mock(() => {}),
	};
	const workletNode: VoiceAudioWorkletNodeLike = {
		port: {
			postMessage: mock(() => {}),
			close: mock(() => {}),
			onmessage: null,
		},
		connect: mock(() => {}),
		disconnect: mock(() => {}),
		onprocessorerror: null,
	};
	const createWorkletNode = mock(
		(
			_context: AudioContext,
			_name: string,
			_options: AudioWorkletNodeOptions,
		) => workletNode,
	);
	const context = {
		state: "running",
		sampleRate: 48_000,
		audioWorklet: {
			addModule: mock(async (_url: string) => {
				if (workletError) throw workletError;
			}),
		},
		createMediaStreamSource: mock(() => source),
		createMediaStreamDestination: mock(() => destination),
		createDynamicsCompressor: mock(() => compressor),
		resume: mock(async () => {}),
		close: mock(async () => {}),
	} as unknown as AudioContext;
	return {
		context,
		source,
		destination,
		destinationTrack,
		compressor,
		workletNode,
		createWorkletNode,
	};
}

afterEach(() => {
	localStorage.clear();
});

describe("voice audio settings", () => {
	test("persists valid settings and ignores malformed stored values", () => {
		writeVoiceAudioSettings({
			...DEFAULT_VOICE_AUDIO_SETTINGS,
			deviceId: "mic-b",
			deepNoiseSuppression: true,
			pushToTalk: true,
			pushToTalkKey: "KeyV",
		});
		expect(readVoiceAudioSettings()).toEqual({
			...DEFAULT_VOICE_AUDIO_SETTINGS,
			deviceId: "mic-b",
			deepNoiseSuppression: true,
			pushToTalk: true,
			pushToTalkKey: "KeyV",
		});
		localStorage.setItem(
			"cogm.voiceAudioSettings",
			JSON.stringify({ echoCancellation: "yes", pushToTalkKey: 4 }),
		);
		expect(readVoiceAudioSettings()).toEqual(DEFAULT_VOICE_AUDIO_SETTINGS);
		localStorage.setItem(
			"cogm.voiceAudioSettings",
			JSON.stringify({ deviceId: "" }),
		);
		expect(readVoiceAudioSettings().deviceId).toBe("default");
	});
});

describe("voice capture pipeline", () => {
	test("uses ideal mono 48k constraints and shares one processed destination", async () => {
		const rawTrack = fakeTrack();
		const capture = mock(async (_constraints: MediaStreamConstraints) =>
			fakeStream(rawTrack),
		);
		const graph = fakeContext();
		const pipeline = new VoiceCapturePipeline({
			capture,
			createContext: () => graph.context,
			createWorkletNode: graph.createWorkletNode,
		});
		const stream = await pipeline.start({
			...DEFAULT_VOICE_AUDIO_SETTINGS,
			deviceId: "mic-a",
			deepNoiseSuppression: true,
		});
		expect(stream).toBe(graph.destination.stream);
		expect(pipeline.processing).toBe("rnnoise");
		const constraints = capture.mock.calls[0]?.[0];
		expect(constraints?.audio).toMatchObject({
			deviceId: { ideal: "mic-a" },
			channelCount: { ideal: 1 },
			sampleRate: { ideal: 48_000 },
			noiseSuppression: { ideal: false },
		});
		expect(graph.createWorkletNode).toHaveBeenCalledTimes(1);
		await pipeline.update({
			...DEFAULT_VOICE_AUDIO_SETTINGS,
			deviceId: "mic-a",
			deepNoiseSuppression: true,
			echoCancellation: false,
		});
		expect(rawTrack.applyConstraints).toHaveBeenCalled();
		expect(pipeline.appliedAudioConstraints.echoCancellation).toBe(false);
		pipeline.close();
		expect(rawTrack.stop).toHaveBeenCalledTimes(1);
		expect(graph.destinationTrack.stop).toHaveBeenCalledTimes(1);
		expect(graph.context.close).toHaveBeenCalledTimes(1);
		expect(graph.workletNode.port.postMessage).toHaveBeenCalledWith({
			type: "dispose",
		});
	});

	test("reapplies browser noise suppression when a running worklet fails", async () => {
		const rawTrack = fakeTrack();
		const graph = fakeContext();
		const restored = Promise.withResolvers<void>();
		const pipeline = new VoiceCapturePipeline({
			capture: async () => fakeStream(rawTrack),
			createContext: () => graph.context,
			createWorkletNode: graph.createWorkletNode,
			onChanged: () => {
				if (
					pipeline.processing === "fallback" &&
					rawTrack.applyConstraints.mock.calls.length
				) {
					restored.resolve();
				}
			},
		});
		const stream = await pipeline.start({
			...DEFAULT_VOICE_AUDIO_SETTINGS,
			deepNoiseSuppression: true,
		});
		graph.workletNode.port.onmessage?.(
			new MessageEvent("message", {
				data: { type: "rnnoise-error" },
			}),
		);
		await restored.promise;
		expect(rawTrack.applyConstraints).toHaveBeenCalledWith(
			expect.objectContaining({ noiseSuppression: { ideal: true } }),
		);
		expect(pipeline.stream).toBe(stream);
		pipeline.close();
	});

	test("falls back to a native chain when RNNoise worklet loading fails", async () => {
		const rawTrack = fakeTrack();
		const graph = fakeContext(new Error("worklet unavailable"));
		const pipeline = new VoiceCapturePipeline({
			capture: async () => fakeStream(rawTrack),
			createContext: () => graph.context,
		});
		const stream = await pipeline.start({
			...DEFAULT_VOICE_AUDIO_SETTINGS,
			deviceId: "mic-a",
			deepNoiseSuppression: true,
			noiseGate: true,
		});
		expect(stream.getAudioTracks()).toHaveLength(1);
		expect(pipeline.processing).toBe("fallback");
		expect(rawTrack.applyConstraints).toHaveBeenCalledWith(
			expect.objectContaining({ noiseSuppression: { ideal: true } }),
		);
		expect(rawTrack.stop).not.toHaveBeenCalled();
		expect(graph.source.connect).toHaveBeenCalled();
		await pipeline.update({
			...DEFAULT_VOICE_AUDIO_SETTINGS,
			deviceId: "mic-a",
		});
		expect(pipeline.processing).toBe("native");
		pipeline.close();
	});

	test("switches devices without replacing the shared output and cleans late captures", async () => {
		const firstTrack = fakeTrack("mic-a");
		const secondTrack = fakeTrack("mic-b");
		const captures = [
			Promise.resolve(fakeStream(firstTrack)),
			Promise.resolve(fakeStream(secondTrack)),
		];
		const graph = fakeContext();
		const pipeline = new VoiceCapturePipeline({
			capture: async () =>
				captures.shift() ?? Promise.reject(new Error("missing")),
			createContext: () => graph.context,
		});
		const output = await pipeline.start(DEFAULT_VOICE_AUDIO_SETTINGS);
		await pipeline.update({
			...DEFAULT_VOICE_AUDIO_SETTINGS,
			deviceId: "mic-b",
		});
		expect(pipeline.stream).toBe(output);
		expect(firstTrack.stop).toHaveBeenCalledTimes(1);
		const late = Promise.withResolvers<MediaStream>();
		const latePipeline = new VoiceCapturePipeline({
			capture: () => late.promise,
			createContext: () => null,
		});
		const starting = latePipeline.start(DEFAULT_VOICE_AUDIO_SETTINGS);
		latePipeline.close();
		const lateTrack = fakeTrack("late");
		late.resolve(fakeStream(lateTrack));
		await expect(starting).rejects.toThrow();
		expect(lateTrack.stop).toHaveBeenCalledTimes(1);
	});
});

describe("runtime voice processing nodes", () => {
	test("maps the default device to browser default and toggles gate and compressor live", async () => {
		expect(
			buildVoiceCaptureConstraints(DEFAULT_VOICE_AUDIO_SETTINGS).audio,
		).not.toHaveProperty("deviceId");
		const rawTrack = fakeTrack();
		const graph = fakeContext();
		const pipeline = new VoiceCapturePipeline({
			capture: async () => fakeStream(rawTrack),
			createContext: () => graph.context,
			createWorkletNode: graph.createWorkletNode,
		});
		await pipeline.start({
			...DEFAULT_VOICE_AUDIO_SETTINGS,
			deviceId: "mic-a",
			noiseGate: true,
			compressor: true,
		});
		expect(pipeline.processing).toBe("native");
		expect(graph.createWorkletNode.mock.calls[0]?.[2]).toMatchObject({
			processorOptions: {
				rnnoise: false,
				gate: { enabled: true },
			},
		});
		expect(graph.compressor.ratio.value).toBe(3);
		expect(graph.compressor.threshold.value).toBe(-24);
		await pipeline.update({
			...DEFAULT_VOICE_AUDIO_SETTINGS,
			deviceId: "mic-a",
		});
		expect(graph.workletNode.port.postMessage).toHaveBeenCalledWith({
			type: "dispose",
		});
		expect(graph.compressor.disconnect).toHaveBeenCalled();
		expect(pipeline.processing).toBe("native");
		pipeline.close();
	});
});
