import {
	DEFAULT_VOICE_AUDIO_SETTINGS,
	normalizeVoiceAudioSettings,
	type VoiceAudioSettings,
} from "./voice-audio-settings";
import {
	DEFAULT_NOISE_GATE_SETTINGS,
	VOICE_SAMPLE_RATE,
} from "./voice-processing";
import type { VoiceWorkletMessage } from "./voice-processing-worklet";
import processingWorkletUrl from "./voice-processing-worklet.ts?worker&url";

export type VoiceAudioProcessing =
	| "idle"
	| "starting"
	| "native"
	| "rnnoise"
	| "fallback";

export type AppliedAudioConstraints = {
	echoCancellation: boolean | null;
	noiseSuppression: boolean | null;
	autoGainControl: boolean | null;
};

export type VoiceAudioWorkletNodeLike = {
	port: {
		postMessage: (message: VoiceWorkletMessage) => void;
		close: () => void;
		onmessage: ((event: MessageEvent<{ type: string }>) => void) | null;
	};
	connect: (destination: AudioNode) => void;
	disconnect: () => void;
	onprocessorerror: ((event: ErrorEvent) => void) | null;
};

export type VoiceCapturePipelineEvents = {
	onChanged?: () => void;
	onEnded?: () => void;
};

export type VoiceCapturePipelineOptions = VoiceCapturePipelineEvents & {
	capture?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
	createContext?: () => AudioContext | null;
	createWorkletNode?: (
		context: AudioContext,
		name: string,
		options: AudioWorkletNodeOptions,
	) => VoiceAudioWorkletNodeLike;
	workletUrl?: string;
};

export interface VoiceCapturePipelineLike {
	readonly stream: MediaStream | null;
	readonly deviceId: string | null;
	readonly processing: VoiceAudioProcessing;
	readonly appliedAudioConstraints: AppliedAudioConstraints;
	start: (settings: VoiceAudioSettings) => Promise<MediaStream>;
	update: (settings: VoiceAudioSettings) => Promise<void>;
	close: () => void;
}

function defaultContext(): AudioContext | null {
	const audioGlobal = globalThis as typeof globalThis & {
		webkitAudioContext?: typeof AudioContext;
	};
	const AudioContextConstructor =
		audioGlobal.AudioContext ?? audioGlobal.webkitAudioContext;
	if (!AudioContextConstructor) return null;
	try {
		return new AudioContextConstructor({
			sampleRate: VOICE_SAMPLE_RATE,
			latencyHint: "interactive",
		});
	} catch {
		try {
			return new AudioContextConstructor();
		} catch {
			return null;
		}
	}
}

function stopTracks(stream: MediaStream | null): void {
	if (!stream) return;
	for (const track of stream.getTracks()) track.stop();
}

function supportedConstraint(name: string): boolean {
	if (typeof navigator === "undefined") return true;
	const supported = navigator.mediaDevices?.getSupportedConstraints?.() as
		| Record<string, boolean>
		| undefined;
	return supported?.[name] !== false;
}

export function buildVoiceCaptureConstraints(
	settings: VoiceAudioSettings,
	rnnoise = settings.deepNoiseSuppression,
): { audio: MediaTrackConstraints; video: false } {
	const audio: MediaTrackConstraints = {
		echoCancellation: supportedConstraint("echoCancellation")
			? { ideal: settings.echoCancellation }
			: undefined,
		noiseSuppression: supportedConstraint("noiseSuppression")
			? {
					ideal: settings.noiseSuppression && !rnnoise,
				}
			: undefined,
		autoGainControl: supportedConstraint("autoGainControl")
			? { ideal: settings.autoGainControl }
			: undefined,
		channelCount: supportedConstraint("channelCount")
			? { ideal: 1 }
			: undefined,
		sampleRate: supportedConstraint("sampleRate")
			? { ideal: VOICE_SAMPLE_RATE }
			: undefined,
	};
	if (settings.deviceId !== "default" && supportedConstraint("deviceId")) {
		audio.deviceId = { ideal: settings.deviceId };
	}
	return { audio, video: false };
}

export class VoiceCapturePipeline implements VoiceCapturePipelineLike {
	private readonly options: VoiceCapturePipelineOptions;
	private context: AudioContext | null = null;
	private settings = DEFAULT_VOICE_AUDIO_SETTINGS;
	private rawStream: MediaStream | null = null;
	private rawTrack: MediaStreamTrack | null = null;
	private outputStream: MediaStream | null = null;
	private source: MediaStreamAudioSourceNode | null = null;
	private destination: MediaStreamAudioDestinationNode | null = null;
	private compressor: DynamicsCompressorNode | null = null;
	private worklet: VoiceAudioWorkletNodeLike | null = null;
	private workletFailed = false;
	private rnnoiseFailed = false;
	private starting = false;
	private closed = false;
	private generation = 0;
	private revision = 0;
	private queue: Promise<void> = Promise.resolve();
	private state: VoiceAudioProcessing = "idle";
	private applied: AppliedAudioConstraints = {
		echoCancellation: null,
		noiseSuppression: null,
		autoGainControl: null,
	};
	private rawEnded: (() => void) | null = null;

	constructor(options: VoiceCapturePipelineOptions = {}) {
		this.options = options;
	}

	get stream(): MediaStream | null {
		return this.outputStream;
	}

	get deviceId(): string | null {
		return this.rawTrack?.getSettings?.().deviceId || null;
	}

	get processing(): VoiceAudioProcessing {
		return this.state;
	}

	get appliedAudioConstraints(): AppliedAudioConstraints {
		return { ...this.applied };
	}

	async start(settings: VoiceAudioSettings): Promise<MediaStream> {
		if (this.closed || this.starting || this.outputStream) {
			throw new Error("Voice capture pipeline cannot be restarted");
		}
		this.starting = true;
		this.settings = normalizeVoiceAudioSettings(settings);
		this.setProcessing("starting");
		const generation = this.generation;
		try {
			const createContext = this.options.createContext ?? defaultContext;
			const context = createContext();
			this.context = context;
			if (context?.state === "suspended") void context.resume().catch(() => {});
			const raw = await this.capture(this.settings);
			if (this.closed || generation !== this.generation) {
				stopTracks(raw);
				throw new DOMException("Voice capture was cancelled", "AbortError");
			}
			const track = raw.getAudioTracks()[0];
			if (!track) {
				stopTracks(raw);
				throw new Error("No audio capture track");
			}
			this.rawStream = raw;
			this.rawTrack = track;
			this.outputStream = raw;
			this.attachRawEnded(track);
			this.readAppliedConstraints();
			if (!this.createGraph()) {
				this.updateProcessing();
				if (this.settings.deepNoiseSuppression) {
					await this.applyNativeConstraints();
				}
				this.options.onChanged?.();
				return raw;
			}
			await this.ensureProcessingNodes();
			if (this.closed || generation !== this.generation) {
				this.close();
				throw new DOMException("Voice capture was cancelled", "AbortError");
			}
			this.updateCompressor();
			this.connectGraph();
			this.updateProcessing();
			if (this.settings.deepNoiseSuppression && this.state !== "rnnoise") {
				await this.applyNativeConstraints();
			}
			this.readAppliedConstraints();
			this.options.onChanged?.();
			const output = this.outputStream;
			if (!output) throw new Error("Voice processing output is unavailable");
			return output;
		} catch (error) {
			this.close();
			throw error;
		} finally {
			this.starting = false;
		}
	}

	update(settings: VoiceAudioSettings): Promise<void> {
		const next = normalizeVoiceAudioSettings(settings, this.settings);
		const revision = ++this.revision;
		const task = this.queue.then(async () => {
			if (this.closed)
				throw new DOMException("Pipeline is closed", "AbortError");
			if (revision !== this.revision) return;
			await this.performUpdate(next, revision);
		});
		this.queue = task.catch(() => {});
		return task;
	}

	close(): void {
		if (this.closed && !this.outputStream) return;
		this.closed = true;
		this.starting = false;
		this.generation += 1;
		this.revision += 1;
		const rawTrack = this.rawTrack;
		if (
			rawTrack &&
			this.rawEnded &&
			typeof rawTrack.removeEventListener === "function"
		) {
			rawTrack.removeEventListener("ended", this.rawEnded);
		}
		this.rawEnded = null;
		this.disposeWorklet();
		try {
			this.source?.disconnect();
			this.compressor?.disconnect();
			this.destination?.disconnect();
		} catch {}
		const tracks = new Set<MediaStreamTrack>();
		for (const stream of [this.rawStream, this.outputStream]) {
			if (!stream) continue;
			for (const track of stream.getTracks()) tracks.add(track);
		}
		for (const track of tracks) track.stop();
		const context = this.context;
		this.context = null;
		if (context && context.state !== "closed")
			void context.close().catch(() => {});
		this.rawStream = null;
		this.rawTrack = null;
		this.outputStream = null;
		this.source = null;
		this.destination = null;
		this.compressor = null;
		this.applied = {
			echoCancellation: null,
			noiseSuppression: null,
			autoGainControl: null,
		};
		this.setProcessing("idle");
		this.options.onChanged?.();
	}

	private async performUpdate(
		next: VoiceAudioSettings,
		revision: number,
	): Promise<void> {
		const deviceChanged = next.deviceId !== this.settings.deviceId;
		if (deviceChanged) {
			const raw = await this.capture(next);
			if (this.closed) {
				stopTracks(raw);
				throw new DOMException("Voice capture was cancelled", "AbortError");
			}
			if (revision !== this.revision) {
				stopTracks(raw);
				return;
			}
			const track = raw.getAudioTracks()[0];
			if (!track) {
				stopTracks(raw);
				throw new Error("No audio capture track");
			}
			this.replaceRawStream(raw, track);
		}
		this.settings = next;
		if (!next.deepNoiseSuppression) this.rnnoiseFailed = false;
		if (this.closed || revision !== this.revision) return;
		await this.ensureProcessingNodes();
		if (this.closed || revision !== this.revision) return;
		this.connectGraph();
		this.updateCompressor();
		this.postWorkletSettings();
		this.updateProcessing();
		await this.applyNativeConstraints();
	}

	private async applyNativeConstraints(): Promise<void> {
		const track = this.rawTrack;
		if (!track || this.closed) return;
		if (typeof track.applyConstraints === "function") {
			const { audio } = buildVoiceCaptureConstraints(
				this.settings,
				this.state === "rnnoise",
			);
			delete audio.deviceId;
			try {
				await track.applyConstraints(audio);
			} catch {}
		}
		if (this.closed || this.rawTrack !== track) return;
		this.readAppliedConstraints();
		this.options.onChanged?.();
	}

	private async capture(settings: VoiceAudioSettings): Promise<MediaStream> {
		const constraints = buildVoiceCaptureConstraints(settings);
		if (this.options.capture) return this.options.capture(constraints);
		if (typeof navigator === "undefined") {
			throw new DOMException(
				"Audio capture is unavailable",
				"NotSupportedError",
			);
		}
		return navigator.mediaDevices.getUserMedia(constraints);
	}

	private createGraph(): boolean {
		const raw = this.rawStream;
		const context = this.context;
		if (!raw || !context) return false;
		try {
			this.source = context.createMediaStreamSource(raw);
			this.destination = context.createMediaStreamDestination();
			this.destination.channelCount = 1;
			this.outputStream = this.destination.stream;
			return true;
		} catch {
			try {
				this.source?.disconnect();
				this.destination?.disconnect();
			} catch {}
			this.source = null;
			this.destination = null;
			this.outputStream = raw;
			this.context = null;
			if (context.state !== "closed") void context.close().catch(() => {});
			return false;
		}
	}

	private replaceRawStream(raw: MediaStream, track: MediaStreamTrack): void {
		const previousRaw = this.rawStream;
		const previousTrack = this.rawTrack;
		let nextSource = this.source;
		if (this.context) {
			try {
				nextSource = this.context.createMediaStreamSource(raw);
			} catch {
				stopTracks(raw);
				throw new Error("Unable to switch audio source");
			}
		}
		if (
			previousTrack &&
			this.rawEnded &&
			typeof previousTrack.removeEventListener === "function"
		) {
			previousTrack.removeEventListener("ended", this.rawEnded);
		}
		this.rawEnded = null;
		try {
			this.source?.disconnect();
		} catch {}
		this.source = nextSource;
		this.outputStream = this.context
			? (this.destination?.stream ?? this.outputStream)
			: raw;
		this.rawStream = raw;
		this.rawTrack = track;
		this.attachRawEnded(track);
		stopTracks(previousRaw);
		this.workletFailed = false;
		this.rnnoiseFailed = false;
	}

	private async ensureProcessingNodes(): Promise<void> {
		const context = this.context;
		if (!context) return;
		const needsWorklet =
			(this.settings.deepNoiseSuppression || this.settings.noiseGate) &&
			!this.workletFailed;
		if (needsWorklet && !this.worklet) {
			try {
				if (
					this.settings.deepNoiseSuppression &&
					context.sampleRate !== VOICE_SAMPLE_RATE
				) {
					this.rnnoiseFailed = true;
				}
				const url = this.options.workletUrl ?? processingWorkletUrl;
				await context.audioWorklet.addModule(url);
				if (this.closed) return;
				const options: AudioWorkletNodeOptions = {
					numberOfInputs: 1,
					numberOfOutputs: 1,
					outputChannelCount: [1],
					channelCount: 1,
					channelCountMode: "explicit",
					channelInterpretation: "speakers",
					processorOptions: this.workletSettings(),
				};
				const name = "cogm-voice-processing";
				this.worklet = this.options.createWorkletNode
					? this.options.createWorkletNode(context, name, options)
					: new AudioWorkletNode(context, name, options);
				this.worklet.port.onmessage = (event) => {
					if (event.data.type !== "rnnoise-error" || this.closed) return;
					this.rnnoiseFailed = true;
					this.updateProcessing();
					this.queue = this.queue.then(() => this.applyNativeConstraints());
					this.options.onChanged?.();
				};
				this.worklet.onprocessorerror = () => {
					if (this.closed) return;
					this.workletFailed = true;
					this.rnnoiseFailed = true;
					this.disposeWorklet();
					this.connectGraph();
					this.updateProcessing();
					this.queue = this.queue.then(() => this.applyNativeConstraints());
					this.options.onChanged?.();
				};
			} catch {
				this.workletFailed = true;
				this.rnnoiseFailed = true;
				this.disposeWorklet();
			}
		}
		if (!this.settings.deepNoiseSuppression && !this.settings.noiseGate) {
			this.disposeWorklet();
			this.workletFailed = false;
			this.rnnoiseFailed = false;
		}
		if (this.settings.compressor && !this.compressor) {
			try {
				this.compressor = context.createDynamicsCompressor();
			} catch {
				this.compressor = null;
			}
		}
	}

	private workletSettings() {
		return {
			rnnoise:
				this.settings.deepNoiseSuppression &&
				!this.rnnoiseFailed &&
				this.context?.sampleRate === VOICE_SAMPLE_RATE,
			gate: {
				...DEFAULT_NOISE_GATE_SETTINGS,
				enabled: this.settings.noiseGate,
			},
		};
	}

	private postWorkletSettings(): void {
		if (!this.worklet) return;
		const message: VoiceWorkletMessage = {
			type: "settings",
			settings: this.workletSettings(),
		};
		try {
			this.worklet.port.postMessage(message);
		} catch {
			this.rnnoiseFailed = true;
		}
	}

	private connectGraph(): void {
		if (!this.source || !this.destination) return;
		try {
			this.source.disconnect();
			this.worklet?.disconnect();
			this.compressor?.disconnect();
			this.destination.disconnect();
		} catch {}
		let tail: AudioNode | VoiceAudioWorkletNodeLike = this.source;
		if (this.worklet) {
			this.source.connect(this.worklet as unknown as AudioNode);
			tail = this.worklet;
		}
		if (this.settings.compressor && this.compressor) {
			tail.connect(this.compressor);
			this.compressor.connect(this.destination);
		} else {
			tail.connect(this.destination);
		}
	}

	private updateCompressor(): void {
		if (!this.compressor) return;
		this.compressor.threshold.value = -24;
		this.compressor.knee.value = 18;
		this.compressor.ratio.value = 3;
		this.compressor.attack.value = 0.006;
		this.compressor.release.value = 0.18;
	}

	private updateProcessing(): void {
		const workletFallback =
			(this.settings.deepNoiseSuppression || this.settings.noiseGate) &&
			(!this.context || this.workletFailed);
		const compressorFallback =
			this.settings.compressor && (!this.context || !this.compressor);
		const rnnoise =
			this.settings.deepNoiseSuppression &&
			Boolean(this.worklet) &&
			!this.rnnoiseFailed &&
			!this.workletFailed &&
			this.context?.sampleRate === VOICE_SAMPLE_RATE;
		const rnnoiseFallback =
			this.settings.deepNoiseSuppression && this.rnnoiseFailed;
		this.setProcessing(
			rnnoise
				? "rnnoise"
				: workletFallback || compressorFallback || rnnoiseFallback
					? "fallback"
					: "native",
		);
	}

	private readAppliedConstraints(): void {
		try {
			const settings = this.rawTrack?.getSettings();
			this.applied = {
				echoCancellation:
					typeof settings?.echoCancellation === "boolean"
						? settings.echoCancellation
						: null,
				noiseSuppression:
					typeof settings?.noiseSuppression === "boolean"
						? settings.noiseSuppression
						: null,
				autoGainControl:
					typeof settings?.autoGainControl === "boolean"
						? settings.autoGainControl
						: null,
			};
		} catch {
			this.applied = {
				echoCancellation: null,
				noiseSuppression: null,
				autoGainControl: null,
			};
		}
	}

	private attachRawEnded(track: MediaStreamTrack): void {
		this.rawEnded = () => {
			if (!this.closed && this.rawTrack === track) this.options.onEnded?.();
		};
		track.addEventListener("ended", this.rawEnded, { once: true });
	}

	private disposeWorklet(): void {
		const worklet = this.worklet;
		if (!worklet) return;
		this.worklet = null;
		worklet.onprocessorerror = null;
		worklet.port.onmessage = null;
		try {
			worklet.port.postMessage({ type: "dispose" });
			worklet.disconnect();
			worklet.port.close();
		} catch {}
	}

	private setProcessing(processing: VoiceAudioProcessing): void {
		if (this.state === processing) return;
		this.state = processing;
	}
}
