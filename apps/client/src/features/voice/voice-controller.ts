import {
	type VoiceClientMessage,
	type VoiceMember,
	type VoiceServerMessage,
	type VoiceState,
	voiceProtocolVersion,
} from "@cogm/shared";
import { normalizeLocalVolume } from "@/lib/local-volume";
import {
	clearVoiceDiagnosticsConsent,
	readVoiceDiagnosticsConsent,
	readVoiceMemberVolumes,
	writeVoiceDiagnosticsConsent,
	writeVoiceMemberVolumes,
} from "@/lib/storage";
import { randomUuid } from "@/lib/uuid";
import {
	DEFAULT_VOICE_AUDIO_SETTINGS,
	normalizeVoiceAudioSettings,
	readVoiceAudioSettings,
	type VoiceAudioSettings,
	writeVoiceAudioSettings,
} from "./voice-audio-settings";
import {
	type AppliedAudioConstraints,
	VoiceCapturePipeline,
	type VoiceCapturePipelineLike,
} from "./voice-capture";

export type { VoiceAudioSettings } from "./voice-audio-settings";

import { VoiceActivityMonitor, VoiceMicTester } from "./voice-activity";
import { VoicePeer } from "./voice-peer";
import {
	VoiceDiagnostics,
	type VoiceDiagnosticsStatus,
} from "./voice-diagnostics";

type VoiceCommand = {
	[Kind in VoiceClientMessage["type"]]: Pick<
		Extract<VoiceClientMessage, { type: Kind }>,
		"type" | "payload"
	>;
}[VoiceClientMessage["type"]];
type VoiceTransport = (message: VoiceClientMessage) => boolean;
type VoiceLink = "connecting" | "reconnecting" | "ready" | "offline";
type MicState = "off" | "requesting" | "on" | "denied" | "unavailable";
export type MicTestState =
	| "idle"
	| "requesting"
	| "active"
	| "denied"
	| "unavailable";
type PendingCommand = {
	message: VoiceClientMessage;
	timer: ReturnType<typeof setTimeout>;
};
export type VoiceSnapshot = {
	link: VoiceLink;
	state: VoiceState | null;
	member: VoiceMember | null;
	pending: VoiceClientMessage["type"] | null;
	mic: MicState;
	micTest: MicTestState;
	micTestLevel: number;
	micTestDetected: boolean;
	micTestLoopback: boolean;
	audioSettings: VoiceAudioSettings;
	audioDevices: Array<{ deviceId: string; label: string }>;
	appliedAudioConstraints: AppliedAudioConstraints;
	audioProcessing: "idle" | "starting" | "native" | "rnnoise" | "fallback";
	pushToTalkActive: boolean;
	playbackMuted: boolean;
	playbackBlocked: boolean;
	peerConnecting: number;
	peerFailed: number;
	speakingIds: string[];
	memberVolumes: Record<string, number>;
	speakerPopupOpen: boolean;
	error: string | null;
	diagnosticsConsent: boolean;
	diagnosticsStatus: VoiceDiagnosticsStatus;
};
export type VoiceActivityMonitorLike = {
	setTrack: (key: string, input: MediaStream | MediaStreamTrack | null) => void;
	getRms?: (key: string) => number | null;
	setAllowed: (allowed: ReadonlySet<string>) => void;
	resume: () => void;
	clear: () => void;
	close: () => void;
};
export type VoiceMicTesterLike = {
	start: (stream: MediaStream) => void;
	setLoopback: (enabled: boolean) => void;
	stop: () => void;
};
type VoiceOptions = {
	sessionId?: string;
	capture?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
	createPeer?: (...args: ConstructorParameters<typeof VoicePeer>) => VoicePeer;
	createMonitor?: (
		onChange: (speakingIds: string[]) => void,
	) => VoiceActivityMonitorLike;
	createMicTester?: (
		onSample: (level: number, detected: boolean) => void,
	) => VoiceMicTesterLike;
};

const REQUEST_TIMEOUT = 6_000;
const INITIAL: VoiceSnapshot = {
	link: "connecting",
	state: null,
	member: null,
	pending: null,
	mic: "off",
	micTest: "idle",
	micTestLevel: 0,
	micTestDetected: false,
	micTestLoopback: false,
	audioSettings: DEFAULT_VOICE_AUDIO_SETTINGS,
	audioDevices: [{ deviceId: "default", label: "" }],
	appliedAudioConstraints: {
		echoCancellation: null,
		noiseSuppression: null,
		autoGainControl: null,
	},
	audioProcessing: "idle",
	pushToTalkActive: false,
	playbackMuted: false,
	playbackBlocked: false,
	peerConnecting: 0,
	peerFailed: 0,
	speakingIds: [],
	memberVolumes: {},
	speakerPopupOpen: true,
	error: null,
	diagnosticsConsent: false,
	diagnosticsStatus: "disabled",
};

function speakerKey(member: Pick<VoiceMember, "role" | "name">): string {
	return `${member.role}:${member.name}`;
}

function shallowEqualRecord(
	a: Record<string, number>,
	b: Record<string, number>,
): boolean {
	const aKeys = Object.keys(a);
	const bKeys = Object.keys(b);
	if (aKeys.length !== bKeys.length) return false;
	return aKeys.every((key) => a[key] === b[key]);
}

export function isVoiceMemberSpeaking(
	snapshot: Pick<
		VoiceSnapshot,
		| "member"
		| "mic"
		| "playbackMuted"
		| "speakingIds"
		| "audioSettings"
		| "pushToTalkActive"
	>,
	item: Pick<VoiceMember, "id" | "canSpeak">,
): boolean {
	if (!item.canSpeak) return false;
	if (!snapshot.speakingIds.includes(item.id)) return false;
	if (item.id === snapshot.member?.id) {
		return (
			snapshot.mic === "on" &&
			(!snapshot.audioSettings.pushToTalk || snapshot.pushToTalkActive)
		);
	}
	return !snapshot.playbackMuted;
}

function classifyCaptureError(error: unknown): "denied" | "unavailable" {
	return error instanceof DOMException &&
		(error.name === "NotAllowedError" || error.name === "SecurityError")
		? "denied"
		: "unavailable";
}

export class VoiceController {
	private readonly options: VoiceOptions;
	private readonly listeners = new Set<() => void>();
	private readonly peers = new Map<string, VoicePeer>();
	private readonly lastAudibleVolumes = new Map<string, number>();
	private readonly monitor: VoiceActivityMonitorLike;
	private readonly micTester: VoiceMicTesterLike;
	private sessionId: string | null;
	private savedVolumes: Record<string, number>;
	private snapshot: VoiceSnapshot = {
		...INITIAL,
		audioSettings: readVoiceAudioSettings(),
	};
	private transport: VoiceTransport | null = null;
	private pending: PendingCommand | null = null;
	private rejoinRoom: string | null = null;
	private unwantedMember: string | null = null;
	private stream: MediaStream | null = null;
	private testStream: MediaStream | null = null;
	private pipeline: VoiceCapturePipelineLike | null = null;
	private capturePurpose: "mic" | "test" | null = null;
	private deviceGeneration = 0;
	private browserHandlersAttached = false;
	private micGeneration = 0;
	private micTestGeneration = 0;
	private failedPeers = 0;
	private readonly diagnostics: VoiceDiagnostics;
	private wsOpen = false;
	private wsOpenEventRecorded = false;

	constructor(options: VoiceOptions = {}) {
		this.options = options;
		this.sessionId = options.sessionId ?? null;
		this.savedVolumes = this.sessionId
			? readVoiceMemberVolumes(this.sessionId)
			: {};
		const onSpeakingChange = (speakingIds: string[]) => {
			if (
				speakingIds.length === this.snapshot.speakingIds.length &&
				speakingIds.every(
					(id, index) => id === this.snapshot.speakingIds[index],
				)
			) {
				return;
			}
			this.patch({ speakingIds });
		};
		this.monitor = options.createMonitor
			? options.createMonitor(onSpeakingChange)
			: new VoiceActivityMonitor(onSpeakingChange);
		const onMicSample = (level: number, detected: boolean) => {
			if (this.snapshot.micTest !== "active" && (level !== 0 || detected)) {
				return;
			}
			if (
				level === this.snapshot.micTestLevel &&
				detected === this.snapshot.micTestDetected
			) {
				return;
			}
			this.patch({ micTestLevel: level, micTestDetected: detected });
		};
		this.micTester = options.createMicTester
			? options.createMicTester(onMicSample)
			: new VoiceMicTester(onMicSample);
		const diagnosticsConsent = readVoiceDiagnosticsConsent();
		this.diagnostics = new VoiceDiagnostics({
			sessionId: this.sessionId,
			consent: diagnosticsConsent,
			getRemoteRms: (peerMemberId) => this.monitor.getRms?.(peerMemberId) ?? null,
			getLocalState: () => ({
				localMicState: this.snapshot.mic,
				audioProcessing: this.snapshot.audioProcessing,
			}),
			onStatus: (diagnosticsStatus) => this.patch({ diagnosticsStatus }),
		});
		if (diagnosticsConsent) {
			this.snapshot = {
				...this.snapshot,
				diagnosticsConsent: true,
				diagnosticsStatus: "pending",
			};
		}
		this.attachBrowserHandlers();
	}

	setSessionId(sessionId: string): void {
		if (this.sessionId === sessionId) return;
		this.sessionId = sessionId;
		this.savedVolumes = readVoiceMemberVolumes(sessionId);
		this.diagnostics.setSessionId(sessionId);
	}

	getSnapshot = (): VoiceSnapshot => this.snapshot;

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	private patch(patch: Partial<VoiceSnapshot>): void {
		const previous = this.snapshot;
		this.snapshot = { ...this.snapshot, ...patch };
		if (this.diagnostics) {
			if (previous.mic !== this.snapshot.mic) {
				this.diagnostics.recordEvent("mic-state", this.snapshot.mic, previous.mic);
			}
			if (
				previous.audioProcessing !== this.snapshot.audioProcessing &&
				this.snapshot.audioProcessing === "fallback"
			) {
				this.diagnostics.recordEvent(
					"processing-fallback",
					"fallback",
					previous.audioProcessing,
				);
			}
			if (previous.audioSettings.deviceId !== this.snapshot.audioSettings.deviceId) {
				this.diagnostics.recordEvent("device-changed", "changed");
			}
		}
		for (const listener of this.listeners) listener();
	}

	private syncDiagnosticsWsOpen(): void {
		if (
			!this.wsOpen ||
			this.wsOpenEventRecorded ||
			!this.snapshot.member ||
			!this.snapshot.diagnosticsConsent
		) {
			return;
		}
		this.diagnostics.recordEvent("ws-open", "open");
		this.wsOpenEventRecorded = true;
	}

	connect(transport: VoiceTransport): void {
		this.transport = transport;
		this.attachBrowserHandlers();
		if (this.snapshot.link === "offline") this.patch({ link: "connecting" });
		if (!this.wsOpen) {
			this.wsOpen = true;
			this.wsOpenEventRecorded = false;
		}
		this.syncDiagnosticsWsOpen();
		void this.refreshAudioDevices();
	}

	disconnect(retry: boolean, closeCode?: number): void {
		this.rejoinRoom = retry
			? (this.snapshot.member && this.snapshot.state?.roomId) || this.rejoinRoom
			: null;
		this.transport = null;
		this.diagnostics.recordEvent(
			"ws-close",
			closeCode === undefined ? "closed" : String(closeCode),
		);
		this.wsOpen = false;
		this.wsOpenEventRecorded = false;
		void this.diagnostics.flush(true);
		void this.diagnostics.setMembership(null, null);
		this.unwantedMember = null;
		this.clearPending();
		this.stopMicTest();
		this.clearMedia();
		if (!retry) {
			this.monitor.close();
			this.detachBrowserHandlers();
			this.diagnostics.close();
		}
		this.patch({
			link: retry ? "reconnecting" : "offline",
			state: null,
			member: null,
			pending: null,
			peerConnecting: 0,
			peerFailed: 0,
			playbackBlocked: false,
			speakingIds: [],
			pushToTalkActive: false,
			memberVolumes: {},
			...(retry ? {} : { speakerPopupOpen: true }),
			error: null,
		});
	}

	receive(message: VoiceServerMessage): void {
		if (!this.transport) return;
		if (message.type === "voice:state") {
			this.applyState(message.payload);
		} else if (message.type === "voice:signal") {
			void this.peers
				.get(message.payload.fromMemberId)
				?.accept(message.payload.signal);
		} else {
			const { payload } = message;
			const pending = this.pending?.message;
			if (payload.requestId !== pending?.requestId) return;
			if (!payload.ok) {
				this.clearPending();
				this.patch({ pending: null, error: payload.code });
			} else if (pending.type !== "voice:join") {
				this.clearPending();
				this.patch({ pending: null });
			}
		}
	}

	private applyState(state: VoiceState): void {
		const previous = this.snapshot;
		const expectedJoin = this.pending?.message;
		const requestedMembership =
			expectedJoin?.type === "voice:join" &&
			expectedJoin.payload.roomId === state.roomId;
		const continuous =
			previous.state?.roomId === state.roomId &&
			previous.member?.id === state.selfId;
		const member =
			state.enabled &&
			state.available &&
			state.roomId &&
			(requestedMembership || continuous)
				? (state.members.find((item) => item.id === state.selfId) ?? null)
				: null;
		if (!member && previous.member) this.clearMedia();
		if (!member) void this.diagnostics.setMembership(null, null);
		if (previous.member?.canSpeak && !member?.canSpeak) this.stopMic();
		if (member && requestedMembership) this.clearPending();
		if (!state.selfId) this.unwantedMember = null;
		if (state.selfId && !member && state.selfId !== this.unwantedMember) {
			this.unwantedMember = state.selfId;
			this.send({ type: "voice:leave", payload: {} });
		}
		this.patch({
			link: "ready",
			state,
			member,
			pending: this.pending?.message.type ?? null,
			...(member ? {} : { speakingIds: [], memberVolumes: {} }),
		});
		if (member) {
			void this.diagnostics.setMembership(
				state.roomId,
				member.id,
				previous.link === "reconnecting" || this.rejoinRoom === state.roomId
					? "voice-rejoin"
					: "voice-join",
			);
			this.syncDiagnosticsWsOpen();
			this.syncPeers(state, member.id);
		}
		this.applyTrackState();
		this.syncActivityAllowed();
		const rejoinRoom = this.rejoinRoom;
		this.rejoinRoom = null;
		if (rejoinRoom && state.roomId === rejoinRoom && !state.selfId) this.join();
	}

	private syncPeers(state: VoiceState, ownId: string): void {
		const active = new Set(state.members.map((item) => item.id));
		for (const [id, peer] of this.peers) {
			if (!active.has(id)) {
				this.monitor.setTrack(id, null);
				this.lastAudibleVolumes.delete(id);
				peer.close();
				this.peers.delete(id);
			}
		}
		this.failedPeers = 0;
		const nextVolumes: Record<string, number> = {};
		for (const item of state.members) {
			if (item.id === ownId) continue;
			const volume =
				this.snapshot.memberVolumes[item.id] ??
				this.savedVolumes[speakerKey(item)] ??
				100;
			nextVolumes[item.id] = volume;
			let peer = this.peers.get(item.id);
			if (!peer) {
				try {
					const options: ConstructorParameters<typeof VoicePeer>[0] = {
						initiator: ownId < item.id,
						iceServers: state.iceServers,
						send: (signal) => {
							if (
								this.peers.get(item.id) === peer &&
								this.snapshot.member?.id === ownId
							) {
								this.send({
									type: "voice:signal",
									payload: { toMemberId: item.id, signal },
								});
							}
						},
						changed: () => this.publishPeerStatus(),
						onRemoteTrack: (track) => {
							this.monitor.setTrack(item.id, track);
							this.syncActivityAllowed();
						},
					diagnostics: {
						setConnection: (connection) =>
							this.diagnostics.setPeerConnection(item.id, connection),
						setRemoteTrack: (track) =>
							this.diagnostics.setPeerRemoteTrack(item.id, track),
						recordEvent: (kind, state, previousState) =>
							this.diagnostics.recordEvent(kind, state, previousState, item.id),
					},
					};
					peer = this.options.createPeer
						? this.options.createPeer(options)
						: new VoicePeer(options);
					this.peers.set(item.id, peer);
					if (this.stream)
						peer.setTrack(this.stream.getAudioTracks()[0] ?? null);
				} catch {
					this.failedPeers += 1;
					continue;
				}
			}
			peer.setVolume?.(volume);
			peer.setAudible(item.canSpeak && !this.snapshot.playbackMuted);
		}
		if (!shallowEqualRecord(this.snapshot.memberVolumes, nextVolumes)) {
			this.patch({ memberVolumes: nextVolumes });
		}
		this.publishPeerStatus();
	}

	private syncActivityAllowed(): void {
		const {
			state,
			member,
			mic,
			playbackMuted,
			audioSettings,
			pushToTalkActive,
		} = this.snapshot;
		const allowed = new Set<string>();
		if (state && member) {
			if (
				member.canSpeak &&
				mic === "on" &&
				this.stream &&
				(!audioSettings.pushToTalk || pushToTalkActive)
			) {
				allowed.add(member.id);
			}
			if (!playbackMuted) {
				for (const item of state.members) {
					if (item.id !== member.id && item.canSpeak) {
						allowed.add(item.id);
					}
				}
			}
		}
		this.monitor.setAllowed(allowed);
		const pruned = this.snapshot.speakingIds.filter((id) => allowed.has(id));
		if (pruned.length !== this.snapshot.speakingIds.length) {
			this.patch({ speakingIds: pruned });
		}
	}

	private publishPeerStatus(): void {
		let peerConnecting = 0;
		let peerFailed = this.failedPeers;
		let playbackBlocked = false;
		for (const peer of this.peers.values()) {
			if (peer.health === "connecting") peerConnecting += 1;
			if (peer.health === "failed") peerFailed += 1;
			playbackBlocked ||= peer.playbackBlocked;
		}
		if (
			peerConnecting !== this.snapshot.peerConnecting ||
			peerFailed !== this.snapshot.peerFailed ||
			playbackBlocked !== this.snapshot.playbackBlocked
		) {
			this.patch({ peerConnecting, peerFailed, playbackBlocked });
		}
	}

	private send(command: VoiceCommand): VoiceClientMessage | null {
		if (!this.transport) return null;
		const message: VoiceClientMessage = {
			...command,
			requestId: randomUuid(),
			protocolVersion: voiceProtocolVersion,
		};
		return this.transport(message) ? message : null;
	}

	private request(command: VoiceCommand): void {
		if (this.pending) return;
		const message = this.send(command);
		if (!message) {
			this.patch({ error: "DISCONNECTED" });
			return;
		}
		const timer = setTimeout(() => {
			this.clearPending();
			this.patch({ pending: null, error: "TIMEOUT" });
		}, REQUEST_TIMEOUT);
		this.pending = { timer, message };
		this.patch({ pending: command.type, error: null });
	}

	private clearPending(): void {
		if (!this.pending) return;
		clearTimeout(this.pending.timer);
		this.pending = null;
	}

	join(): void {
		const { state, member } = this.snapshot;
		if (!state?.available || !state.enabled || !state.roomId || member) return;
		if (!this.options.createPeer && typeof RTCPeerConnection === "undefined") {
			this.patch({ error: "UNSUPPORTED" });
			return;
		}
		this.stopMicTest();
		this.monitor.resume();
		this.request({ type: "voice:join", payload: { roomId: state.roomId } });
	}

	leave(): void {
		const { member } = this.snapshot;
		if (!member) return;
		this.rejoinRoom = null;
		this.unwantedMember = member.id;
		this.clearPending();
		this.stopMicTest();
		this.clearMedia();
		this.patch({
			member: null,
			pending: null,
			peerConnecting: 0,
			peerFailed: 0,
			playbackBlocked: false,
			speakingIds: [],
			memberVolumes: {},
		});
		this.request({ type: "voice:leave", payload: {} });
		void this.diagnostics.setMembership(null, null);
	}

	configure(
		payload: Extract<
			VoiceClientMessage,
			{ type: "voice:configure" }
		>["payload"],
	): void {
		if (this.snapshot.state?.canManage)
			this.request({ type: "voice:configure", payload });
	}

	moderate(
		payload: Extract<VoiceClientMessage, { type: "voice:moderate" }>["payload"],
	): void {
		if (this.snapshot.state?.canManage)
			this.request({ type: "voice:moderate", payload });
	}

	private canCapture(): boolean {
		return Boolean(
			this.options.capture ||
				(typeof navigator !== "undefined" &&
					typeof navigator.mediaDevices?.getUserMedia === "function"),
		);
	}

	async toggleMic(): Promise<void> {
		if (!this.snapshot.member?.canSpeak) {
			this.setPushToTalkActive(false);
			return;
		}
		this.monitor.resume();
		if (this.snapshot.audioSettings.pushToTalk) {
			if (this.snapshot.mic === "on" || this.snapshot.mic === "requesting") {
				this.stopMic();
				return;
			}
			this.setPushToTalkActive(false);
			await this.startMic();
			return;
		}
		if (this.snapshot.mic === "on" || this.snapshot.mic === "requesting") {
			this.stopMic();
			return;
		}
		await this.startMic();
	}

	setPushToTalkActive(active: boolean): void {
		const next = Boolean(
			active &&
				this.snapshot.audioSettings.pushToTalk &&
				this.snapshot.member?.canSpeak,
		);
		if (this.snapshot.pushToTalkActive !== next) {
			this.patch({ pushToTalkActive: next });
		}
		if (!next) {
			this.applyTrackState();
			this.syncActivityAllowed();
			return;
		}
		this.monitor.resume();
		if (
			this.snapshot.mic === "off" ||
			this.snapshot.mic === "denied" ||
			this.snapshot.mic === "unavailable"
		) {
			void this.startMic();
			return;
		}
		this.applyTrackState();
		this.syncActivityAllowed();
	}

	async updateAudioSettings(patch: Partial<VoiceAudioSettings>): Promise<void> {
		const previous = this.snapshot.audioSettings;
		const next = normalizeVoiceAudioSettings(patch, previous);
		const releasePtt =
			next.pushToTalk !== previous.pushToTalk ||
			next.pushToTalkKey !== previous.pushToTalkKey;
		writeVoiceAudioSettings(next);
		this.patch({
			audioSettings: next,
			...(releasePtt ? { pushToTalkActive: false } : {}),
		});
		this.applyTrackState();
		this.syncActivityAllowed();
		const pipeline = this.pipeline;
		const activeCapture =
			this.snapshot.mic === "on" || this.snapshot.micTest === "active";
		if (pipeline && activeCapture) {
			try {
				await pipeline.update(next);
			} catch {
				if (
					this.pipeline === pipeline &&
					this.snapshot.audioSettings === next
				) {
					writeVoiceAudioSettings(previous);
					this.patch({ audioSettings: previous });
					this.applyTrackState();
					this.syncActivityAllowed();
				}
				return;
			}
			if (this.pipeline !== pipeline) return;
			const stream = pipeline.stream;
			const track = stream?.getAudioTracks()[0];
			if (stream && track && this.stream && stream !== this.stream) {
				this.stream = stream;
				this.applyTrackState();
				const ownId = this.snapshot.member?.id;
				if (ownId) this.monitor.setTrack(ownId, stream);
				for (const peer of this.peers.values()) peer.setTrack(track);
			} else if (
				stream &&
				track &&
				this.testStream &&
				stream !== this.testStream
			) {
				this.testStream = stream;
				this.micTester.start(stream);
				this.micTester.setLoopback(this.snapshot.micTestLoopback);
			}
			this.syncPipelineSnapshot(pipeline);
		}
		this.applyTrackState();
		this.syncActivityAllowed();
	}

	async refreshAudioDevices(): Promise<void> {
		const generation = ++this.deviceGeneration;
		if (
			typeof navigator === "undefined" ||
			typeof navigator.mediaDevices?.enumerateDevices !== "function"
		) {
			return;
		}
		try {
			const devices = await navigator.mediaDevices.enumerateDevices();
			if (generation !== this.deviceGeneration) return;
			const inputs = devices.filter((device) => device.kind === "audioinput");
			const defaultLabel =
				inputs.find((device) => device.deviceId === "default")?.label ?? "";
			const audioDevices = [{ deviceId: "default", label: defaultLabel }];
			for (const device of inputs) {
				if (device.deviceId && device.deviceId !== "default") {
					audioDevices.push({
						deviceId: device.deviceId,
						label: device.label,
					});
				}
			}
			this.patch({ audioDevices });
			const selected = this.snapshot.audioSettings.deviceId;
			const active = this.pipeline?.deviceId ?? selected;
			if (
				active !== "default" &&
				(this.snapshot.mic === "on" || this.snapshot.micTest === "active") &&
				!inputs.some((device) => device.deviceId === active)
			) {
				this.handleCaptureEnded();
			}
		} catch {}
	}

	private async startMic(): Promise<void> {
		if (!this.snapshot.member?.canSpeak) {
			this.setPushToTalkActive(false);
			return;
		}
		if (this.snapshot.mic === "on") {
			this.applyTrackState();
			return;
		}
		if (this.snapshot.mic === "requesting") return;
		if (!this.canCapture()) {
			this.patch({ mic: "unavailable", pushToTalkActive: false });
			return;
		}
		const reusablePipeline =
			this.capturePurpose === "test" ? this.pipeline : null;
		const reusableStream = reusablePipeline ? this.testStream : null;
		this.stopMicTest("idle", Boolean(reusablePipeline && reusableStream));
		const generation = ++this.micGeneration;
		let pipeline = reusablePipeline;
		this.patch({
			mic: "requesting",
			...(pipeline ? {} : { audioProcessing: "starting" }),
		});
		try {
			if (!pipeline) {
				pipeline = this.createPipeline();
				this.pipeline = pipeline;
			}
			this.capturePurpose = "mic";
			const settings = this.snapshot.audioSettings;
			if (!reusableStream) await pipeline.start(settings);
			if (generation !== this.micGeneration || this.pipeline !== pipeline) {
				pipeline.close();
				return;
			}
			if (!reusableStream && settings !== this.snapshot.audioSettings) {
				await pipeline.update(this.snapshot.audioSettings);
			}
			if (generation !== this.micGeneration || this.pipeline !== pipeline) {
				pipeline.close();
				return;
			}
			const stream = pipeline.stream;
			const track = stream?.getAudioTracks()[0];
			if (!stream || !track) throw new Error("No processed audio track");
			this.stream = stream;
			this.capturePurpose = "mic";
			this.patch({ mic: "on" });
			this.applyTrackState();
			const ownId = this.snapshot.member?.id;
			if (ownId) this.monitor.setTrack(ownId, stream);
			for (const peer of this.peers.values()) peer.setTrack(track);
			this.syncPipelineSnapshot(pipeline);
			this.syncActivityAllowed();
			void this.refreshAudioDevices();
		} catch (error) {
			if (generation !== this.micGeneration) return;
			if (this.pipeline === pipeline) this.closePipeline();
			else pipeline?.close();
			this.stream = null;
			for (const peer of this.peers.values()) peer.setTrack(null);
			this.patch({
				mic: classifyCaptureError(error),
				pushToTalkActive: false,
			});
			this.syncActivityAllowed();
		}
	}

	async startMicTest(): Promise<void> {
		if (
			this.snapshot.mic === "on" ||
			this.snapshot.mic === "requesting" ||
			this.snapshot.micTest === "active" ||
			this.snapshot.micTest === "requesting"
		) {
			return;
		}
		if (!this.canCapture()) {
			this.patch({
				micTest: "unavailable",
				micTestLevel: 0,
				micTestDetected: false,
			});
			return;
		}
		const generation = ++this.micTestGeneration;
		const pipeline = this.createPipeline();
		this.pipeline = pipeline;
		this.capturePurpose = "test";
		this.patch({
			micTest: "requesting",
			micTestLevel: 0,
			micTestDetected: false,
			audioProcessing: "starting",
		});
		try {
			const settings = this.snapshot.audioSettings;
			await pipeline.start(settings);
			if (generation !== this.micTestGeneration || this.pipeline !== pipeline) {
				pipeline.close();
				return;
			}
			if (settings !== this.snapshot.audioSettings) {
				await pipeline.update(this.snapshot.audioSettings);
			}
			if (generation !== this.micTestGeneration || this.pipeline !== pipeline) {
				pipeline.close();
				return;
			}
			const stream = pipeline.stream;
			const track = stream?.getAudioTracks()[0];
			if (!stream || !track)
				throw new Error("No processed microphone test track");
			track.enabled = true;
			this.testStream = stream;
			this.capturePurpose = "test";
			this.patch({
				micTest: "active",
				micTestLevel: 0,
				micTestDetected: false,
			});
			this.micTester.start(stream);
			this.micTester.setLoopback(this.snapshot.micTestLoopback);
			this.syncPipelineSnapshot(pipeline);
			void this.refreshAudioDevices();
		} catch (error) {
			if (generation !== this.micTestGeneration) return;
			if (this.pipeline === pipeline) this.closePipeline();
			else pipeline.close();
			this.testStream = null;
			this.patch({
				micTest: classifyCaptureError(error),
				micTestLevel: 0,
				micTestDetected: false,
			});
		}
	}

	stopMicTest(
		nextState: "idle" | "unavailable" = "idle",
		preservePipeline = false,
	): void {
		this.micTestGeneration += 1;
		this.micTester.stop();
		this.testStream = null;
		if (!preservePipeline && this.capturePurpose === "test") {
			this.closePipeline();
		}
		if (
			this.snapshot.micTest !== nextState ||
			this.snapshot.micTestLevel !== 0 ||
			this.snapshot.micTestDetected ||
			this.snapshot.micTestLoopback
		) {
			this.patch({
				micTest: nextState,
				micTestLevel: 0,
				micTestDetected: false,
				micTestLoopback: false,
			});
		}
	}

	toggleMicTestLoopback(): void {
		if (this.snapshot.micTest !== "active") return;
		const next = !this.snapshot.micTestLoopback;
		this.micTester.setLoopback(next);
		this.patch({ micTestLoopback: next });
	}

	private stopMic(): void {
		this.micGeneration += 1;
		const ownId = this.snapshot.member?.id;
		if (ownId) this.monitor.setTrack(ownId, null);
		const track = this.stream?.getAudioTracks()[0];
		if (track) track.enabled = false;
		if (this.snapshot.mic !== "off" || this.stream) {
			for (const peer of this.peers.values()) peer.setTrack(null);
		}
		this.stream = null;
		if (this.capturePurpose === "mic") this.closePipeline();
		if (this.snapshot.mic !== "off" || this.snapshot.pushToTalkActive) {
			this.patch({ mic: "off", pushToTalkActive: false });
		}
		this.syncActivityAllowed();
	}

	private createPipeline(): VoiceCapturePipelineLike {
		let pipeline: VoiceCapturePipelineLike;
		pipeline = new VoiceCapturePipeline({
			capture: this.options.capture,
			onChanged: () => {
				if (this.pipeline === pipeline) this.syncPipelineSnapshot(pipeline);
			},
			onEnded: () => {
				if (this.pipeline === pipeline) this.handleCaptureEnded();
			},
		});
		return pipeline;
	}

	private syncPipelineSnapshot(pipeline: VoiceCapturePipelineLike): void {
		if (this.pipeline !== pipeline) return;
		const applied = pipeline.appliedAudioConstraints;
		if (
			this.snapshot.audioProcessing === pipeline.processing &&
			this.snapshot.appliedAudioConstraints.echoCancellation ===
				applied.echoCancellation &&
			this.snapshot.appliedAudioConstraints.noiseSuppression ===
				applied.noiseSuppression &&
			this.snapshot.appliedAudioConstraints.autoGainControl ===
				applied.autoGainControl
		) {
			return;
		}
		this.patch({
			audioProcessing: pipeline.processing,
			appliedAudioConstraints: applied,
		});
	}

	private closePipeline(): void {
		const pipeline = this.pipeline;
		this.pipeline = null;
		this.capturePurpose = null;
		pipeline?.close();
		this.patch({
			audioProcessing: "idle",
			appliedAudioConstraints: {
				echoCancellation: null,
				noiseSuppression: null,
				autoGainControl: null,
			},
		});
	}

	private handleCaptureEnded(): void {
		const purpose = this.capturePurpose;
		if (!purpose) return;
		const track = this.stream?.getAudioTracks()[0];
		if (track) track.enabled = false;
		for (const peer of this.peers.values()) peer.setTrack(null);
		if (purpose === "test") {
			this.stopMicTest("unavailable");
		} else {
			this.stopMic();
			this.patch({ mic: "unavailable", pushToTalkActive: false });
		}
	}

	private applyTrackState(): void {
		const track = this.stream?.getAudioTracks()[0];
		if (!track) return;
		track.enabled = Boolean(
			this.snapshot.mic === "on" &&
				this.snapshot.member?.canSpeak &&
				(!this.snapshot.audioSettings.pushToTalk ||
					this.snapshot.pushToTalkActive),
		);
	}

	private readonly onKeyDown = (event: KeyboardEvent): void => {
		if (
			!this.snapshot.audioSettings.pushToTalk ||
			event.defaultPrevented ||
			event.isComposing ||
			event.repeat ||
			event.ctrlKey ||
			event.metaKey ||
			event.altKey ||
			event.shiftKey ||
			!this.snapshot.member?.canSpeak
		) {
			return;
		}
		const target = event.target;
		if (
			target instanceof Element &&
			target.closest(
				'input, textarea, select, button, a[href], [contenteditable]:not([contenteditable="false"]), [role="combobox"], [role="option"], [role="listbox"], [role="button"], [role="switch"], [role="radio"], [role="slider"], [role="menuitem"]',
			)
		) {
			return;
		}
		const key = this.snapshot.audioSettings.pushToTalkKey;
		if (event.code !== key && event.key !== key) return;
		event.preventDefault();
		this.setPushToTalkActive(true);
	};

	private readonly onKeyUp = (event: KeyboardEvent): void => {
		const key = this.snapshot.audioSettings.pushToTalkKey;
		if (event.code !== key && event.key !== key) return;
		if (this.snapshot.pushToTalkActive) event.preventDefault();
		this.setPushToTalkActive(false);
	};

	private readonly onWindowBlur = (): void => {
		this.setPushToTalkActive(false);
	};

	private readonly onVisibilityChange = (): void => {
		if (document.hidden) this.setPushToTalkActive(false);
	};

	private readonly onDeviceChange = (): void => {
		void this.refreshAudioDevices();
	};

	private attachBrowserHandlers(): void {
		if (this.browserHandlersAttached || typeof window === "undefined") return;
		this.browserHandlersAttached = true;
		window.addEventListener("keydown", this.onKeyDown);
		window.addEventListener("keyup", this.onKeyUp);
		window.addEventListener("blur", this.onWindowBlur);
		document.addEventListener("visibilitychange", this.onVisibilityChange);
		navigator.mediaDevices?.addEventListener?.(
			"devicechange",
			this.onDeviceChange,
		);
	}

	private detachBrowserHandlers(): void {
		if (!this.browserHandlersAttached) return;
		this.browserHandlersAttached = false;
		window.removeEventListener("keydown", this.onKeyDown);
		window.removeEventListener("keyup", this.onKeyUp);
		window.removeEventListener("blur", this.onWindowBlur);
		document.removeEventListener("visibilitychange", this.onVisibilityChange);
		navigator.mediaDevices?.removeEventListener?.(
			"devicechange",
			this.onDeviceChange,
		);
	}

	togglePlayback(): void {
		const { state, member, playbackMuted } = this.snapshot;
		if (!state || !member) return;
		this.monitor.resume();
		this.patch({ playbackMuted: !playbackMuted });
		for (const item of state.members) {
			this.peers.get(item.id)?.setAudible(playbackMuted && item.canSpeak);
		}
		this.syncActivityAllowed();
	}

	retryPlayback(): void {
		this.monitor.resume();
		for (const peer of this.peers.values()) peer.retryPlayback();
	}

	setMemberVolume(memberId: string, volume: number): void {
		const { state, member, memberVolumes } = this.snapshot;
		if (!state || !member || memberId === member.id) return;
		const target = state.members.find((item) => item.id === memberId);
		if (!target) return;
		const next = normalizeLocalVolume(volume);
		if (next > 0) {
			this.lastAudibleVolumes.set(memberId, next);
		}
		const nextVolumes = { ...memberVolumes, [memberId]: next };
		this.savedVolumes[speakerKey(target)] = next;
		if (this.sessionId) {
			writeVoiceMemberVolumes(this.sessionId, this.savedVolumes);
		}
		this.peers.get(memberId)?.setVolume?.(next);
		if (memberVolumes[memberId] !== next) {
			this.patch({ memberVolumes: nextVolumes });
		}
	}

	toggleMemberMute(memberId: string): void {
		const current = this.snapshot.memberVolumes[memberId] ?? 100;
		if (current > 0) {
			this.lastAudibleVolumes.set(memberId, current);
			this.setMemberVolume(memberId, 0);
			return;
		}
		const restored = this.lastAudibleVolumes.get(memberId) ?? 100;
		this.setMemberVolume(memberId, restored > 0 ? restored : 100);
	}

	setSpeakerPopupOpen(open: boolean): void {
		if (this.snapshot.speakerPopupOpen === open) return;
		this.patch({ speakerPopupOpen: open });
	}

	toggleSpeakerPopup(): void {
		this.setSpeakerPopupOpen(!this.snapshot.speakerPopupOpen);
	}

	async setDiagnosticsConsent(consented: boolean): Promise<void> {
		if (!consented) {
			clearVoiceDiagnosticsConsent();
			this.patch({ diagnosticsConsent: false, diagnosticsStatus: "disabled" });
			this.wsOpenEventRecorded = false;
			await this.diagnostics.setConsent(false);
			return;
		}
		const consent = readVoiceDiagnosticsConsent() ?? {
			consentVersion: 1 as const,
			acceptedAt: new Date().toISOString(),
		};
		writeVoiceDiagnosticsConsent(consent);
		this.patch({ diagnosticsConsent: true, diagnosticsStatus: "pending" });
		await this.diagnostics.setConsent(true, consent.acceptedAt);
		this.syncDiagnosticsWsOpen();
	}

	private clearMedia(): void {
		this.stopMic();
		this.monitor.clear();
		this.lastAudibleVolumes.clear();
		for (const peer of this.peers.values()) peer.close();
		this.peers.clear();
		this.failedPeers = 0;
	}
}

