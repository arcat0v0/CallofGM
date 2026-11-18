import type { VoiceSignal } from "@cogm/shared";

const MAX_CANDIDATES = 64;
const CONNECTION_TIMEOUT = 15_000;
const DISCONNECT_GRACE = 4_000;
const MAX_RESTARTS = 2;

type PeerHealth = "connecting" | "connected" | "failed";

type VoicePeerOptions = {
	initiator: boolean;
	iceServers: RTCIceServer[];
	send: (signal: VoiceSignal) => void;
	changed: () => void;
};

function audioOnly(sdp: string): boolean {
	const media = sdp.match(/^m=\S+/gm);
	return media?.length === 1 && media[0] === "m=audio";
}

function iceFragments(sdp: string): Set<string> {
	return new Set(
		sdp
			.match(/^a=ice-ufrag:\S+/gm)
			?.map((line) => line.slice("a=ice-ufrag:".length)),
	);
}

export class VoicePeer {
	private readonly connection: RTCPeerConnection;
	private readonly options: VoicePeerOptions;
	private transceiver: RTCRtpTransceiver | undefined;
	private track: MediaStreamTrack | null = null;
	private output: HTMLAudioElement | null = null;
	private remoteTrack: MediaStreamTrack | null = null;
	private audible = false;
	private playbackAttempt = 0;
	private closed = false;
	private tasks = Promise.resolve();
	private queuedSignals = 0;
	private ignoreOffer = false;
	private remoteIce = new Set<string>();
	private ignoredIce = new Set<string>();
	private candidates: RTCIceCandidateInit[] = [];
	private timer: ReturnType<typeof setTimeout> | undefined;
	private restarts = 0;
	health: PeerHealth = "connecting";
	playbackBlocked = false;

	constructor(options: VoicePeerOptions) {
		this.options = options;
		const connection = new RTCPeerConnection({
			iceServers: options.iceServers,
		});
		this.connection = connection;
		connection.onicecandidate = ({ candidate }) => {
			if (!this.closed && candidate?.candidate) {
				const {
					candidate: value,
					sdpMid,
					sdpMLineIndex,
					usernameFragment,
				} = candidate;
				options.send({
					kind: "candidate",
					candidate: {
						candidate: value,
						sdpMid,
						sdpMLineIndex,
						usernameFragment,
					},
				});
			}
		};
		connection.onnegotiationneeded = () => {
			this.enqueue(async () => {
				if (connection.signalingState !== "stable" || !this.transceiver) return;
				await connection.setLocalDescription();
				this.sendDescription();
			});
		};
		connection.ontrack = ({ track }) => this.attachOutput(track);
		connection.onconnectionstatechange = () => this.connectionChanged();
		if (options.initiator) {
			this.transceiver = connection.addTransceiver("audio", {
				direction: "sendrecv",
			});
		}
		this.armRecovery(CONNECTION_TIMEOUT);
	}

	private enqueue(action: () => Promise<void>): void {
		this.tasks = this.tasks
			.then(async () => {
				if (!this.closed) await action();
			})
			.catch(() => {
				if (!this.closed) this.armRecovery(DISCONNECT_GRACE);
			});
	}

	accept(signal: VoiceSignal): Promise<void> {
		if (this.closed || this.queuedSignals >= MAX_CANDIDATES) return this.tasks;
		this.queuedSignals += 1;
		this.enqueue(async () => {
			try {
				await this.applySignal(signal);
			} finally {
				this.queuedSignals -= 1;
			}
		});
		return this.tasks;
	}

	private async applySignal(signal: VoiceSignal): Promise<void> {
		const connection = this.connection;
		if (signal.kind === "candidate") {
			const candidate = signal.candidate;
			const fragment = candidate.usernameFragment;
			if (fragment ? this.ignoredIce.has(fragment) : this.ignoreOffer) return;
			if (
				!connection.remoteDescription ||
				(fragment && !this.remoteIce.has(fragment))
			) {
				if (this.candidates.length < MAX_CANDIDATES)
					this.candidates.push(candidate);
				return;
			}
			await this.addCandidate(candidate);
			return;
		}

		const description = signal.description;
		if (!audioOnly(description.sdp)) return;
		const offer = description.type === "offer";
		if (!offer && connection.signalingState !== "have-local-offer") return;
		const fragments = iceFragments(description.sdp);
		this.ignoreOffer =
			offer && this.options.initiator && connection.signalingState !== "stable";
		if (this.ignoreOffer) {
			this.ignoredIce = fragments;
			return;
		}
		await connection.setRemoteDescription(description);
		if (this.closed) return;
		this.remoteIce = fragments;
		for (const fragment of fragments) this.ignoredIce.delete(fragment);
		const candidates = this.candidates;
		this.candidates = [];
		for (const candidate of candidates) {
			if (
				candidate.usernameFragment &&
				!fragments.has(candidate.usernameFragment)
			)
				continue;
			await this.addCandidate(candidate);
		}
		if (!offer || this.closed) return;
		this.transceiver = connection
			.getTransceivers()
			.find(
				(item) => item.receiver.track.kind === "audio" && item.mid !== null,
			);
		if (!this.transceiver) return;
		this.transceiver.direction = "sendrecv";
		await this.transceiver.sender.replaceTrack(this.track);
		if (this.closed) return;
		await connection.setLocalDescription();
		this.sendDescription();
	}

	private async addCandidate(candidate: RTCIceCandidateInit): Promise<void> {
		try {
			await this.connection.addIceCandidate(candidate);
		} catch {
			return;
		}
	}

	private sendDescription(): void {
		const local = this.connection.localDescription;
		if (
			!this.closed &&
			local &&
			(local.type === "offer" || local.type === "answer")
		) {
			this.options.send({
				kind: "description",
				description: { type: local.type, sdp: local.sdp },
			});
		}
	}

	setTrack(track: MediaStreamTrack | null): void {
		this.track = track;
		this.enqueue(async () => {
			await this.transceiver?.sender.replaceTrack(this.track);
		});
	}

	private attachOutput(track: MediaStreamTrack): void {
		if (this.closed || track.kind !== "audio") {
			track.stop();
			return;
		}
		if (this.remoteTrack && this.remoteTrack !== track) this.remoteTrack.stop();
		this.remoteTrack = track;
		track.enabled = false;
		if (!this.output) {
			this.output = document.createElement("audio");
			this.output.hidden = true;
			this.output.muted = true;
			document.body.append(this.output);
		}
		this.output.srcObject = new MediaStream([track]);
		this.updatePlayback();
	}

	setAudible(audible: boolean): void {
		if (this.audible === audible) return;
		this.audible = audible;
		this.updatePlayback();
	}

	retryPlayback(): void {
		if (this.audible && this.playbackBlocked) this.updatePlayback();
	}

	private updatePlayback(): void {
		const output = this.output;
		if (!output || !this.remoteTrack) return;
		const attempt = ++this.playbackAttempt;
		this.remoteTrack.enabled = this.audible;
		output.muted = !this.audible;
		this.setBlocked(false);
		if (!this.audible) {
			output.pause();
			return;
		}
		void output.play().catch(() => {
			if (!this.closed && this.playbackAttempt === attempt)
				this.setBlocked(true);
		});
	}

	private setBlocked(blocked: boolean): void {
		if (this.playbackBlocked === blocked) return;
		this.playbackBlocked = blocked;
		this.options.changed();
	}

	private connectionChanged(): void {
		if (this.closed) return;
		const state = this.connection.connectionState;
		if (state === "connected") {
			clearTimeout(this.timer);
			this.restarts = 0;
			this.setHealth("connected");
		} else if (state === "disconnected" || state === "failed") {
			this.setHealth("connecting");
			this.armRecovery(DISCONNECT_GRACE);
		}
	}

	private armRecovery(delay: number): void {
		clearTimeout(this.timer);
		this.timer = setTimeout(() => {
			if (this.closed) return;
			if (!this.transceiver || this.restarts >= MAX_RESTARTS) {
				this.setHealth("failed");
				return;
			}
			this.restarts += 1;
			this.setHealth("connecting");
			this.connection.restartIce();
			this.armRecovery(CONNECTION_TIMEOUT);
		}, delay);
	}

	private setHealth(health: PeerHealth): void {
		if (this.health === health) return;
		this.health = health;
		this.options.changed();
	}

	close(): void {
		this.closed = true;
		clearTimeout(this.timer);
		this.candidates = [];
		this.remoteTrack?.stop();
		this.remoteTrack = null;
		if (this.output) {
			this.output.muted = true;
			this.output.pause();
			this.output.srcObject = null;
			this.output.remove();
			this.output = null;
		}
		this.connection.close();
	}
}
