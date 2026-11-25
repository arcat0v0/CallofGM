import type { VoiceSignal } from "@cogm/shared";

const MAX_CANDIDATES = 64;
const CONNECTION_TIMEOUT = 15_000;
const DISCONNECT_GRACE = 4_000;
const MAX_RESTARTS = 2;

export type PeerHealth = "connecting" | "connected" | "failed";

export function supportsAudioOutputSelection(): boolean {
	return (
		typeof HTMLMediaElement !== "undefined" &&
		typeof (
			HTMLMediaElement.prototype as HTMLMediaElement & { setSinkId?: unknown }
		).setSinkId === "function"
	);
}

type VoicePeerDiagnostics = {
	setConnection: (connection: RTCPeerConnection | null) => void;
	setRemoteTrack: (track: MediaStreamTrack | null) => void;
	recordEvent: (
		kind: "peer-state" | "ice-restart",
		state: RTCPeerConnectionState | "requested",
		previousState: RTCPeerConnectionState | null,
	) => void;
};

type VoicePeerOptions = {
	initiator: boolean;
	iceServers: RTCIceServer[];
	outputDeviceId?: string;
	send: (signal: VoiceSignal) => void;
	changed: () => void;
	onRemoteTrack?: (track: MediaStreamTrack | null) => void;
	diagnostics?: VoicePeerDiagnostics;
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

export const VOICE_MAX_BITRATE = 32_000;

type OpusSupport = {
	opus: boolean;
	fec: boolean;
	dtx: boolean;
};

type OpusCapabilities = {
	support: OpusSupport;
	codecs: RTCRtpCodec[];
};

type OpusFmtpOptions = Pick<OpusSupport, "fec" | "dtx">;

export type OpusSenderParameterStatus = {
	maxBitrate: boolean;
	dtx: boolean;
};

type EncodingWithDtx = RTCRtpEncodingParameters & {
	dtx?: "enabled" | "disabled";
};

function detectOpusCapabilities(): OpusCapabilities {
	if (
		typeof RTCRtpSender === "undefined" ||
		typeof RTCRtpSender.getCapabilities !== "function"
	) {
		return { support: { opus: false, fec: false, dtx: false }, codecs: [] };
	}
	try {
		const codecs = RTCRtpSender.getCapabilities("audio")?.codecs ?? [];
		const opus = codecs.find(
			(codec) => codec.mimeType.toLowerCase() === "audio/opus",
		);
		if (!opus) {
			return { support: { opus: false, fec: false, dtx: false }, codecs };
		}
		const fmtp = opus.sdpFmtpLine ?? "";
		return {
			support: {
				opus: true,
				fec: /(?:^|;)\s*useinbandfec\s*=\s*1\s*(?:;|$)/i.test(fmtp),
				dtx: true,
			},
			codecs,
		};
	} catch {
		return { support: { opus: false, fec: false, dtx: false }, codecs: [] };
	}
}

function opusFmtp(parameters: string, options: OpusFmtpOptions): string {
	const entries = parameters
		.split(";")
		.map((entry) => entry.trim())
		.filter(Boolean);
	const values = new Map<string, string>();
	for (const entry of entries) {
		const separator = entry.indexOf("=");
		const key = (separator >= 0 ? entry.slice(0, separator) : entry)
			.trim()
			.toLowerCase();
		values.set(key, entry);
	}
	values.set("maxaveragebitrate", `maxaveragebitrate=${VOICE_MAX_BITRATE}`);
	values.set("stereo", "stereo=0");
	if (options.dtx) values.set("usedtx", "usedtx=1");
	if (options.fec) values.set("useinbandfec", "useinbandfec=1");
	return [...values.values()].join(";");
}

export function configureOpusSdp(
	sdp: string,
	options: OpusFmtpOptions,
): string {
	const lines = sdp.split(/\r?\n/);
	const opusPayloads = new Set<string>();
	const fmtpPayloads = new Set<string>();
	let audio = false;
	for (const line of lines) {
		if (line.startsWith("m=")) audio = line.startsWith("m=audio");
		if (!audio) continue;
		const rtpmap = line.match(/^a=rtpmap:(\d+)\s+opus\/48000(?:\/2)?/i);
		if (rtpmap?.[1]) opusPayloads.add(rtpmap[1]);
		const fmtp = line.match(/^a=fmtp:(\d+)\s*/i);
		if (fmtp?.[1]) fmtpPayloads.add(fmtp[1]);
	}
	const configured: string[] = [];
	audio = false;
	for (const line of lines) {
		if (line.startsWith("m=")) audio = line.startsWith("m=audio");
		if (!audio) {
			configured.push(line);
			continue;
		}
		const rtpmap = line.match(/^a=rtpmap:(\d+)\s+opus\/48000(?:\/2)?/i);
		const payload = rtpmap?.[1];
		if (payload && !fmtpPayloads.has(payload)) {
			configured.push(line);
			configured.push(`a=fmtp:${payload} ${opusFmtp("", options)}`);
			continue;
		}
		const fmtp = line.match(/^a=fmtp:(\d+)\s*(.*)$/i);
		if (fmtp?.[1] && opusPayloads.has(fmtp[1])) {
			configured.push(`a=fmtp:${fmtp[1]} ${opusFmtp(fmtp[2] ?? "", options)}`);
			continue;
		}
		configured.push(line);
	}
	return configured.join("\r\n");
}

export async function applyOpusSenderParameters(
	sender: RTCRtpSender,
): Promise<OpusSenderParameterStatus> {
	try {
		if (
			typeof sender.getParameters !== "function" ||
			typeof sender.setParameters !== "function"
		) {
			return { maxBitrate: false, dtx: false };
		}
		const parameters = sender.getParameters();
		const encoding = parameters.encodings[0] as EncodingWithDtx | undefined;
		if (!encoding) return { maxBitrate: false, dtx: false };
		const supportsDtx = "dtx" in encoding;
		encoding.maxBitrate = VOICE_MAX_BITRATE;
		if (supportsDtx) encoding.dtx = "enabled";
		await sender.setParameters(parameters);
		const applied = sender.getParameters().encodings[0] as
			| EncodingWithDtx
			| undefined;
		return {
			maxBitrate: applied?.maxBitrate === VOICE_MAX_BITRATE,
			dtx: supportsDtx && applied?.dtx === "enabled",
		};
	} catch {
		return { maxBitrate: false, dtx: false };
	}
}

export class VoicePeer {
	private readonly connection: RTCPeerConnection;
	private readonly options: VoicePeerOptions;
	private transceiver: RTCRtpTransceiver | undefined;
	private track: MediaStreamTrack | null = null;
	private output: HTMLAudioElement | null = null;
	private outputDeviceId: string;
	private remoteTrack: MediaStreamTrack | null = null;
	private audible = false;
	private volume = 100;
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
	private readonly opus = detectOpusCapabilities();
	private opusSenderConfigured = false;
	health: PeerHealth = "connecting";
	private diagnosticsConnectionState: RTCPeerConnectionState = "new";
	playbackBlocked = false;

	constructor(options: VoicePeerOptions) {
		this.options = options;
		this.outputDeviceId = options.outputDeviceId || "default";
		const connection = new RTCPeerConnection({
			iceServers: options.iceServers,
		});
		this.connection = connection;
		options.diagnostics?.setConnection(connection);
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
				await this.setLocalDescription();
				this.sendDescription();
			});
		};
		connection.ontrack = ({ track }) => this.attachOutput(track);
		connection.onconnectionstatechange = () => this.connectionChanged();
		connection.oniceconnectionstatechange = () => this.iceConnectionChanged();
		if (options.initiator) {
			this.transceiver = connection.addTransceiver("audio", {
				direction: "sendrecv",
			});
			this.configureCodecPreferences();
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
		if (this.closed) return;
		if (!offer) {
			await this.configureOpusSender();
			return;
		}
		this.transceiver = connection
			.getTransceivers()
			.find(
				(item) => item.receiver.track.kind === "audio" && item.mid !== null,
			);
		if (!this.transceiver) return;
		this.configureCodecPreferences();
		this.transceiver.direction = "sendrecv";
		await this.transceiver.sender.replaceTrack(this.track);
		if (this.closed) return;
		await this.setLocalDescription();
		await this.configureOpusSender();
		if (this.closed) return;
		this.sendDescription();
	}

	private configureCodecPreferences(): void {
		if (
			!this.opus.support.opus ||
			!this.transceiver ||
			typeof this.transceiver.setCodecPreferences !== "function"
		) {
			return;
		}
		try {
			const opus = this.opus.codecs.filter(
				(codec) => codec.mimeType.toLowerCase() === "audio/opus",
			);
			const remaining = this.opus.codecs.filter(
				(codec) => codec.mimeType.toLowerCase() !== "audio/opus",
			);
			this.transceiver.setCodecPreferences([...opus, ...remaining]);
		} catch {}
	}

	private async setLocalDescription(
		offerOptions?: RTCOfferOptions,
	): Promise<void> {
		const connection = this.connection;
		if (
			!this.opus.support.opus ||
			typeof connection.createOffer !== "function" ||
			typeof connection.createAnswer !== "function"
		) {
			if (offerOptions && typeof connection.createOffer === "function") {
				const description = await connection.createOffer(offerOptions);
				await connection.setLocalDescription(description);
				return;
			}
			await connection.setLocalDescription();
			return;
		}
		try {
			const description =
				connection.signalingState === "have-remote-offer"
					? await connection.createAnswer()
					: offerOptions
						? await connection.createOffer(offerOptions)
						: await connection.createOffer();
			if (!description.sdp) throw new Error("Missing local SDP");
			await connection.setLocalDescription({
				type: description.type,
				sdp: configureOpusSdp(description.sdp, this.opus.support),
			});
		} catch {
			if (!this.closed) await connection.setLocalDescription();
		}
	}

	private async configureOpusSender(): Promise<void> {
		if (this.opusSenderConfigured || !this.transceiver || this.closed) return;
		this.opusSenderConfigured = true;
		await applyOpusSenderParameters(this.transceiver.sender);
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
			this.output.setAttribute("playsinline", "");
			this.output.volume = this.volume / 100;
			document.body.append(this.output);
			this.applyOutputSink();
		}
		this.output.srcObject = new MediaStream([track]);
		this.options.onRemoteTrack?.(track);
		this.options.diagnostics?.setRemoteTrack(track);
		this.updatePlayback();
	}

	setOutputDevice(deviceId: string): void {
		const next = deviceId || "default";
		if (this.outputDeviceId === next) return;
		this.outputDeviceId = next;
		this.applyOutputSink();
	}

	private applyOutputSink(): void {
		const output = this.output as
			| (HTMLAudioElement & { setSinkId?: (sinkId: string) => Promise<void> })
			| null;
		if (!output || typeof output.setSinkId !== "function") return;
		const target = this.outputDeviceId === "default" ? "" : this.outputDeviceId;
		try {
			void output.setSinkId(target).catch(() => {});
		} catch {}
	}

	setAudible(audible: boolean): void {
		if (this.audible === audible) return;
		this.audible = audible;
		this.updatePlayback();
	}

	setVolume(volume: number): void {
		const next = Number.isFinite(volume)
			? Math.min(100, Math.max(0, Math.round(volume)))
			: 100;
		if (this.volume === next) return;
		this.volume = next;
		if (this.output) {
			this.output.volume = next / 100;
		}
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
		output.volume = this.volume / 100;
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
		const previousState = this.diagnosticsConnectionState;
		const state = this.connection.connectionState;
		this.diagnosticsConnectionState = state;
		if (previousState !== state) {
			this.options.diagnostics?.recordEvent("peer-state", state, previousState);
		}
		if (state === "connected") {
			clearTimeout(this.timer);
			this.restarts = 0;
			this.setHealth("connected");
		} else if (state === "disconnected" || state === "failed") {
			if (this.health === "failed") this.restarts = 0;
			this.setHealth("connecting");
			this.armRecovery(DISCONNECT_GRACE);
		}
	}

	private iceConnectionChanged(): void {
		const iceState = this.connection.iceConnectionState;
		if (!iceState) return;
		const connState = this.connection.connectionState;
		if (
			(iceState === "connected" || iceState === "completed") &&
			connState === "connected"
		) {
			clearTimeout(this.timer);
			this.restarts = 0;
			this.setHealth("connected");
			return;
		}
		if (
			(iceState === "failed" || iceState === "disconnected") &&
			connState !== "disconnected" &&
			connState !== "failed"
		) {
			if (this.health === "failed") this.restarts = 0;
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
			if (
				this.options.initiator &&
				this.connection.signalingState === "have-local-offer"
			) {
				// Initial offer was never answered (e.g. lost during rejoin); resend a fresh offer.
				this.enqueue(async () => {
					if (this.closed || !this.transceiver) return;
					await this.setLocalDescription({ iceRestart: true });
					this.sendDescription();
				});
			} else {
				this.connection.restartIce();
			}
			this.options.diagnostics?.recordEvent(
				"ice-restart",
				"requested",
				this.connection.connectionState,
			);
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
		this.options.diagnostics?.setRemoteTrack(null);
		this.options.diagnostics?.setConnection(null);
		this.options.onRemoteTrack?.(null);
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
