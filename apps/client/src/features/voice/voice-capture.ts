import {
	DEFAULT_VOICE_AUDIO_SETTINGS,
	normalizeVoiceAudioSettings,
	type VoiceAudioSettings,
} from "./voice-audio-settings";
import type { DeepFilterAssets } from "./voice-deepfilter";
import {
	type DeepFilterAssetLoader,
	loadDeepFilterAssets,
} from "./voice-deepfilter-assets";
import {
	DEFAULT_NOISE_GATE_SETTINGS,
	VOICE_SAMPLE_RATE,
	type VoiceNoiseEngine,
} from "./voice-processing";
import type {
	VoiceWorkletEvent,
	VoiceWorkletMessage,
	VoiceWorkletOptions,
	VoiceWorkletSettings,
} from "./voice-processing-worklet";
import processingWorkletUrl from "./voice-processing-worklet.ts?worker&url";

export type VoiceAudioProcessing =
	| "idle"
	| "starting"
	| "native"
	| "rnnoise"
	| "deepfilter"
	| "fallback";

export type AppliedAudioConstraints = {
	echoCancellation: boolean | null;
	noiseSuppression: boolean | null;
	autoGainControl: boolean | null;
};

export type VoiceAudioWorkletNodeLike = {
	port: {
		postMessage: (
			message: VoiceWorkletMessage,
			options?: StructuredSerializeOptions,
		) => void;
		close: () => void;
		onmessage: ((event: MessageEvent<VoiceWorkletEvent>) => void) | null;
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
	/** Fetches the DeepFilterNet3 runtime and model (tests inject a fake). */
	loadDeepFilterAssets?: DeepFilterAssetLoader;
};

export interface VoiceCapturePipelineLike {
	readonly stream: MediaStream | null;
	readonly deviceId: string | null;
	readonly processing: VoiceAudioProcessing;
	readonly appliedAudioConstraints: AppliedAudioConstraints;
	start: (settings: VoiceAudioSettings) => Promise<MediaStream>;
	update: (settings: VoiceAudioSettings) => Promise<void>;
	resume?: () => void;
	getAudioTap?: () => { context: AudioContext; node: AudioNode } | null;
	getMonitorStream?: () => MediaStream | null;
	close: () => void;
}

type AudioSessionNavigator = Navigator & {
	audioSession?: { type: string };
};

function isContextRunning(context: AudioContext): boolean {
	return (context.state as string) === "running";
}

function isContextClosed(context: AudioContext): boolean {
	return (context.state as string) === "closed";
}

function defaultContext(preferVoiceRate: boolean): AudioContext | null {
	const audioGlobal = globalThis as typeof globalThis & {
		webkitAudioContext?: typeof AudioContext;
	};
	const AudioContextConstructor =
		audioGlobal.AudioContext ?? audioGlobal.webkitAudioContext;
	if (!AudioContextConstructor) return null;
	try {
		return new AudioContextConstructor(
			preferVoiceRate
				? { sampleRate: VOICE_SAMPLE_RATE, latencyHint: "interactive" }
				: { latencyHint: "interactive" },
		);
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
	private outputNode: GainNode | null = null;
	private keepaliveGain: GainNode | null = null;
	private destination: MediaStreamAudioDestinationNode | null = null;
	private compressor: DynamicsCompressorNode | null = null;
	private worklet: VoiceAudioWorkletNodeLike | null = null;
	private unlockAttached = false;
	private stateListenerAttached: AudioContext | null = null;
	private previousAudioSessionType: string | null = null;
	private workletFailed = false;
	private rnnoiseFailed = false;
	private deepFilterFailed = false;
	/** Assets were handed to the current worklet, or are on their way. */
	private deepFilterRequested = false;
	/** Denoiser the current worklet reports as heard. */
	private workletEngine: VoiceNoiseEngine | null = null;
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

	getAudioTap(): { context: AudioContext; node: AudioNode } | null {
		if (!this.context || !this.outputNode || this.closed) return null;
		return { context: this.context, node: this.outputNode };
	}

	getMonitorStream(): MediaStream | null {
		if (this.closed) return null;
		const hasDspNodes = Boolean(
			this.worklet || (this.settings.compressor && this.compressor),
		);
		if (!hasDspNodes && this.rawStream) {
			return this.rawStream;
		}
		return this.outputStream;
	}

	resume(): void {
		const context = this.context;
		if (!context || this.closed || isContextClosed(context)) return;
		if (isContextRunning(context)) {
			this.detachUnlock();
			return;
		}
		this.attachUnlock(context);
		try {
			void context
				.resume()
				.then(() => {
					if (this.context === context && isContextRunning(context)) {
						this.detachUnlock();
					}
				})
				.catch(() => {});
		} catch {}
	}

	private readonly handleContextUnlock = (): void => {
		this.resume();
	};

	private readonly handleContextStateChange = (): void => {
		const context = this.context;
		if (!context || this.closed) return;
		if (isContextRunning(context)) {
			this.detachUnlock();
			return;
		}
		if (!isContextClosed(context)) {
			this.resume();
		}
	};

	private attachUnlock(context: AudioContext): void {
		if (
			this.stateListenerAttached !== context &&
			typeof context.addEventListener === "function"
		) {
			this.detachStateListener();
			this.stateListenerAttached = context;
			context.addEventListener("statechange", this.handleContextStateChange);
		}
		if (this.unlockAttached || typeof window === "undefined" || this.closed) {
			return;
		}
		this.unlockAttached = true;
		window.addEventListener("pointerdown", this.handleContextUnlock, {
			passive: true,
		});
		window.addEventListener("touchend", this.handleContextUnlock, {
			passive: true,
		});
		window.addEventListener("click", this.handleContextUnlock, {
			passive: true,
		});
		window.addEventListener("keydown", this.handleContextUnlock, {
			passive: true,
		});
	}

	private detachStateListener(): void {
		const attached = this.stateListenerAttached;
		if (attached && typeof attached.removeEventListener === "function") {
			attached.removeEventListener(
				"statechange",
				this.handleContextStateChange,
			);
		}
		this.stateListenerAttached = null;
	}

	private detachUnlock(): void {
		if (!this.unlockAttached || typeof window === "undefined") return;
		this.unlockAttached = false;
		window.removeEventListener("pointerdown", this.handleContextUnlock);
		window.removeEventListener("touchend", this.handleContextUnlock);
		window.removeEventListener("click", this.handleContextUnlock);
		window.removeEventListener("keydown", this.handleContextUnlock);
	}

	private claimAudioSession(): void {
		if (typeof navigator === "undefined") return;
		const session = (navigator as AudioSessionNavigator).audioSession;
		if (!session || typeof session.type !== "string") return;
		if (this.previousAudioSessionType === null) {
			this.previousAudioSessionType = session.type;
		}
		try {
			session.type = "play-and-record";
		} catch {}
	}

	private restoreAudioSession(): void {
		if (
			this.previousAudioSessionType === null ||
			typeof navigator === "undefined"
		) {
			this.previousAudioSessionType = null;
			return;
		}
		const previous = this.previousAudioSessionType;
		this.previousAudioSessionType = null;
		const session = (navigator as AudioSessionNavigator).audioSession;
		if (!session) return;
		try {
			session.type = previous;
		} catch {}
	}

	async start(settings: VoiceAudioSettings): Promise<MediaStream> {
		if (this.closed || this.starting || this.outputStream) {
			throw new Error("Voice capture pipeline cannot be restarted");
		}
		this.starting = true;
		this.settings = normalizeVoiceAudioSettings(settings);
		this.setProcessing("starting");
		this.claimAudioSession();
		const generation = this.generation;
		try {
			const createContext =
				this.options.createContext ??
				(() => defaultContext(this.settings.deepNoiseSuppression));
			let context = createContext();
			this.context = context;
			if (context) {
				this.attachUnlock(context);
				this.resume();
			}
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
			const trackSampleRate = track.getSettings?.().sampleRate;
			if (
				!this.options.createContext &&
				!this.settings.deepNoiseSuppression &&
				context &&
				typeof trackSampleRate === "number" &&
				trackSampleRate > 0 &&
				context.sampleRate !== trackSampleRate
			) {
				this.detachStateListener();
				if (!isContextClosed(context)) void context.close().catch(() => {});
				context = defaultContext(false);
				this.context = context;
			}
			if (context) {
				this.attachUnlock(context);
				this.resume();
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
			this.resume();
			this.updateProcessing();
			if (this.settings.deepNoiseSuppression && !this.ownsNoiseSuppression()) {
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
		this.detachUnlock();
		this.detachStateListener();
		this.restoreAudioSession();
		try {
			this.source?.disconnect();
			this.compressor?.disconnect();
			this.outputNode?.disconnect();
			this.keepaliveGain?.disconnect();
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
		if (context && !isContextClosed(context))
			void context.close().catch(() => {});
		this.rawStream = null;
		this.rawTrack = null;
		this.outputStream = null;
		this.source = null;
		this.outputNode = null;
		this.keepaliveGain = null;
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
		if (!next.deepNoiseSuppression) {
			this.rnnoiseFailed = false;
			this.deepFilterFailed = false;
		}
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
				this.ownsNoiseSuppression(),
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
			if (typeof context.createGain === "function") {
				const outputNode = context.createGain();
				outputNode.gain.value = 1;
				const keepaliveGain = context.createGain();
				keepaliveGain.gain.value = 0;
				outputNode.connect(this.destination);
				outputNode.connect(keepaliveGain);
				keepaliveGain.connect(context.destination);
				this.outputNode = outputNode;
				this.keepaliveGain = keepaliveGain;
			}
			this.outputStream = this.destination.stream;
			return true;
		} catch {
			try {
				this.source?.disconnect();
				this.outputNode?.disconnect();
				this.keepaliveGain?.disconnect();
				this.destination?.disconnect();
			} catch {}
			this.source = null;
			this.outputNode = null;
			this.keepaliveGain = null;
			this.destination = null;
			this.outputStream = raw;
			this.detachStateListener();
			this.context = null;
			if (!isContextClosed(context)) void context.close().catch(() => {});
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
					processorOptions: {
						settings: this.workletSettings(),
					} satisfies VoiceWorkletOptions,
				};
				const name = "cogm-voice-processing";
				this.worklet = this.options.createWorkletNode
					? this.options.createWorkletNode(context, name, options)
					: new AudioWorkletNode(context, name, options);
				this.worklet.port.onmessage = (event) => {
					this.handleWorkletEvent(event.data);
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
			this.deepFilterFailed = false;
		}
		this.requestDeepFilterAssets();
		if (this.settings.compressor && !this.compressor) {
			try {
				this.compressor = context.createDynamicsCompressor();
			} catch {
				this.compressor = null;
			}
		}
	}

	private requestedEngine(): VoiceNoiseEngine {
		if (
			!this.settings.deepNoiseSuppression ||
			this.context?.sampleRate !== VOICE_SAMPLE_RATE
		) {
			return "none";
		}
		if (
			this.settings.noiseSuppressionEngine === "deepfilter" &&
			!this.deepFilterFailed
		) {
			return "deepfilter";
		}
		return this.rnnoiseFailed ? "none" : "rnnoise";
	}

	private workletSettings(): VoiceWorkletSettings {
		return {
			engine: this.requestedEngine(),
			gate: {
				...DEFAULT_NOISE_GATE_SETTINGS,
				enabled: this.settings.noiseGate,
			},
		};
	}

	private postWorkletSettings(assets?: DeepFilterAssets): void {
		if (!this.worklet) return;
		const message: VoiceWorkletMessage = {
			type: "settings",
			settings: this.workletSettings(),
			...(assets ? { deepFilterAssets: assets } : {}),
		};
		try {
			if (assets) {
				this.worklet.port.postMessage(message, {
					transfer: [assets.wasm, assets.model],
				});
			} else {
				this.worklet.port.postMessage(message);
			}
		} catch {
			if (assets) this.deepFilterFailed = true;
			else this.rnnoiseFailed = true;
		}
	}

	/**
	 * DeepFilterNet3 assets load in the background: RNNoise is heard from the
	 * start and the worklet switches over once the model is ready.
	 */
	private requestDeepFilterAssets(): void {
		const worklet = this.worklet;
		if (
			!worklet ||
			this.deepFilterRequested ||
			this.requestedEngine() !== "deepfilter"
		) {
			return;
		}
		this.deepFilterRequested = true;
		const load = this.options.loadDeepFilterAssets ?? loadDeepFilterAssets;
		let pending: Promise<DeepFilterAssets>;
		try {
			pending = load();
		} catch (error) {
			pending = Promise.reject(error);
		}
		void pending.then(
			(assets) => {
				if (this.closed || this.worklet !== worklet) return;
				if (this.requestedEngine() !== "deepfilter") {
					// Switched away meanwhile; load again if switched back.
					this.deepFilterRequested = false;
					return;
				}
				this.postWorkletSettings(assets);
			},
			() => {
				if (this.closed || this.worklet !== worklet) return;
				this.deepFilterFailed = true;
				this.postWorkletSettings();
				this.updateProcessing();
				this.options.onChanged?.();
			},
		);
	}

	private handleWorkletEvent(event: VoiceWorkletEvent): void {
		if (this.closed) return;
		const owned = this.ownsNoiseSuppression();
		if (event.type === "engine") {
			this.workletEngine = event.engine;
		} else if (event.type === "deepfilter-error") {
			this.deepFilterFailed = true;
		} else if (event.type === "rnnoise-error") {
			this.rnnoiseFailed = true;
		} else {
			return;
		}
		this.updateProcessing();
		if (event.type === "rnnoise-error" || owned !== this.ownsNoiseSuppression()) {
			this.queue = this.queue.then(() => this.applyNativeConstraints());
		}
		this.options.onChanged?.();
	}

	/** Our worklet suppresses noise, so the browser's own suppression stays off. */
	private ownsNoiseSuppression(): boolean {
		return this.state === "rnnoise" || this.state === "deepfilter";
	}

	private connectGraph(): void {
		if (!this.source || !this.destination) return;
		try {
			this.source.disconnect();
			this.worklet?.disconnect();
			this.compressor?.disconnect();
		} catch {}
		let tail: AudioNode | VoiceAudioWorkletNodeLike = this.source;
		if (this.worklet) {
			this.source.connect(this.worklet as unknown as AudioNode);
			tail = this.worklet;
		}
		const sink: AudioNode = this.outputNode ?? this.destination;
		if (this.settings.compressor && this.compressor) {
			tail.connect(this.compressor);
			this.compressor.connect(sink);
		} else {
			tail.connect(sink);
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
		const workletUsable =
			this.settings.deepNoiseSuppression &&
			Boolean(this.worklet) &&
			!this.workletFailed &&
			this.context?.sampleRate === VOICE_SAMPLE_RATE;
		const deepFilter =
			workletUsable &&
			this.settings.noiseSuppressionEngine === "deepfilter" &&
			!this.deepFilterFailed &&
			this.workletEngine === "deepfilter";
		const rnnoise = workletUsable && !this.rnnoiseFailed;
		const rnnoiseFallback =
			this.settings.deepNoiseSuppression && this.rnnoiseFailed;
		this.setProcessing(
			deepFilter
				? "deepfilter"
				: rnnoise
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
		this.workletEngine = null;
		this.deepFilterRequested = false;
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
