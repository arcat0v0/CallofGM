import {
	type VoiceClientMessage,
	type VoiceMember,
	type VoiceServerMessage,
	type VoiceState,
	voiceProtocolVersion,
} from "@cogm/shared";
import { VoicePeer } from "./voice-peer";

type VoiceCommand = {
	[Kind in VoiceClientMessage["type"]]: Pick<
		Extract<VoiceClientMessage, { type: Kind }>,
		"type" | "payload"
	>;
}[VoiceClientMessage["type"]];
type VoiceTransport = (message: VoiceClientMessage) => boolean;
type VoiceLink = "connecting" | "reconnecting" | "ready" | "offline";
type MicState = "off" | "requesting" | "on" | "denied" | "unavailable";
type PendingCommand = {
	message: VoiceClientMessage;
	timer: ReturnType<typeof setTimeout>;
};
type VoiceSnapshot = {
	link: VoiceLink;
	state: VoiceState | null;
	member: VoiceMember | null;
	pending: VoiceClientMessage["type"] | null;
	mic: MicState;
	playbackMuted: boolean;
	playbackBlocked: boolean;
	peerConnecting: number;
	peerFailed: number;
	error: string | null;
};
type VoiceOptions = {
	capture?: () => Promise<MediaStream>;
	createPeer?: (...args: ConstructorParameters<typeof VoicePeer>) => VoicePeer;
};

const REQUEST_TIMEOUT = 6_000;
const INITIAL: VoiceSnapshot = {
	link: "connecting",
	state: null,
	member: null,
	pending: null,
	mic: "off",
	playbackMuted: false,
	playbackBlocked: false,
	peerConnecting: 0,
	peerFailed: 0,
	error: null,
};

export class VoiceController {
	private readonly options: VoiceOptions;
	private readonly listeners = new Set<() => void>();
	private readonly peers = new Map<string, VoicePeer>();
	private snapshot = INITIAL;
	private transport: VoiceTransport | null = null;
	private pending: PendingCommand | null = null;
	private rejoinRoom: string | null = null;
	private unwantedMember: string | null = null;
	private stream: MediaStream | null = null;
	private micGeneration = 0;
	private failedPeers = 0;

	constructor(options: VoiceOptions = {}) {
		this.options = options;
	}

	getSnapshot = (): VoiceSnapshot => this.snapshot;

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	private patch(patch: Partial<VoiceSnapshot>): void {
		this.snapshot = { ...this.snapshot, ...patch };
		for (const listener of this.listeners) listener();
	}

	connect(transport: VoiceTransport): void {
		this.transport = transport;
		if (this.snapshot.link === "offline") this.patch({ link: "connecting" });
	}

	disconnect(retry: boolean): void {
		this.rejoinRoom = retry
			? (this.snapshot.member && this.snapshot.state?.roomId) || this.rejoinRoom
			: null;
		this.transport = null;
		this.unwantedMember = null;
		this.clearPending();
		this.clearMedia();
		this.patch({
			link: retry ? "reconnecting" : "offline",
			state: null,
			member: null,
			pending: null,
			peerConnecting: 0,
			peerFailed: 0,
			playbackBlocked: false,
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
		});
		if (member) this.syncPeers(state, member.id);
		const rejoinRoom = this.rejoinRoom;
		this.rejoinRoom = null;
		if (rejoinRoom && state.roomId === rejoinRoom && !state.selfId) this.join();
	}

	private syncPeers(state: VoiceState, ownId: string): void {
		const active = new Set(state.members.map((item) => item.id));
		for (const [id, peer] of this.peers) {
			if (!active.has(id)) {
				peer.close();
				this.peers.delete(id);
			}
		}
		this.failedPeers = 0;
		for (const item of state.members) {
			if (item.id === ownId) continue;
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
			peer.setAudible(item.canSpeak && !this.snapshot.playbackMuted);
		}
		this.publishPeerStatus();
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
			requestId: crypto.randomUUID(),
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
		this.request({ type: "voice:join", payload: { roomId: state.roomId } });
	}

	leave(): void {
		const { member } = this.snapshot;
		if (!member) return;
		this.rejoinRoom = null;
		this.unwantedMember = member.id;
		this.clearPending();
		this.clearMedia();
		this.patch({
			member: null,
			pending: null,
			peerConnecting: 0,
			peerFailed: 0,
			playbackBlocked: false,
		});
		this.request({ type: "voice:leave", payload: {} });
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

	async toggleMic(): Promise<void> {
		if (!this.snapshot.member?.canSpeak) return;
		if (this.snapshot.mic === "on" || this.snapshot.mic === "requesting") {
			this.stopMic();
			return;
		}
		const generation = ++this.micGeneration;
		this.patch({ mic: "requesting" });
		try {
			const stream = await (this.options.capture
				? this.options.capture()
				: navigator.mediaDevices.getUserMedia({ audio: true, video: false }));
			if (generation !== this.micGeneration) {
				for (const track of stream.getTracks()) track.stop();
				return;
			}
			const track = stream.getAudioTracks()[0];
			this.stream = stream;
			if (!track) {
				this.stopMic();
				this.patch({ mic: "unavailable" });
				return;
			}
			track.addEventListener(
				"ended",
				() => {
					if (this.stream === stream) {
						this.stopMic();
						this.patch({ mic: "unavailable" });
					}
				},
				{ once: true },
			);
			for (const peer of this.peers.values()) peer.setTrack(track);
			this.patch({ mic: "on" });
		} catch (error) {
			if (generation !== this.micGeneration) return;
			const denied =
				error instanceof DOMException &&
				(error.name === "NotAllowedError" || error.name === "SecurityError");
			this.patch({ mic: denied ? "denied" : "unavailable" });
		}
	}

	private stopMic(): void {
		this.micGeneration += 1;
		if (this.stream) {
			for (const track of this.stream.getTracks()) track.stop();
			this.stream = null;
		}
		if (this.snapshot.mic !== "off") {
			for (const peer of this.peers.values()) peer.setTrack(null);
			this.patch({ mic: "off" });
		}
	}

	togglePlayback(): void {
		const { state, member, playbackMuted } = this.snapshot;
		if (!state || !member) return;
		this.patch({ playbackMuted: !playbackMuted });
		for (const item of state.members) {
			this.peers.get(item.id)?.setAudible(playbackMuted && item.canSpeak);
		}
	}

	retryPlayback(): void {
		for (const peer of this.peers.values()) peer.retryPlayback();
	}

	private clearMedia(): void {
		for (const peer of this.peers.values()) peer.close();
		this.peers.clear();
		this.failedPeers = 0;
		this.stopMic();
	}
}
