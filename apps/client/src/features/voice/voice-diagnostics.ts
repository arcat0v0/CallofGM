type MicState = "off" | "requesting" | "on" | "denied" | "unavailable";
type AudioProcessing = "idle" | "starting" | "native" | "rnnoise" | "fallback";
type LocalDiagnosticsState = {
	localMicState: MicState;
	audioProcessing: AudioProcessing;
};
type Membership = { roomId: string; memberId: string };
type CandidateType = (typeof CANDIDATE_TYPES)[number] | "unknown";
type CandidateProtocol = "udp" | "tcp" | "unknown";
type VoiceDiagnosticsSample = Membership &
	LocalDiagnosticsState & {
		at: string;
		peerMemberId: string;
		rttMs: number | null;
		jitterMs: number | null;
		availableOutgoingBitrate: number | null;
		packetsReceivedDelta: number;
		packetsLostDelta: number;
		packetsSentDelta: number;
		bytesReceivedDelta: number;
		bytesSentDelta: number;
		concealmentEventsDelta: number;
		concealedSamplesDelta: number;
		localCandidateType: CandidateType;
		localCandidateProtocol: CandidateProtocol;
		remoteCandidateType: CandidateType;
		remoteCandidateProtocol: CandidateProtocol;
		connectionState: RTCPeerConnectionState;
		iceConnectionState: RTCIceConnectionState;
		signalingState: RTCSignalingState;
		remoteTrackMuted: boolean;
		remoteTrackEnabled: boolean;
		remoteTrackReadyState: MediaStreamTrackState | null;
		remoteRms: number | null;
	};
type EventKind =
	| "peer-state"
	| "ice-restart"
	| "ws-open"
	| "ws-close"
	| "voice-join"
	| "voice-rejoin"
	| "mic-state"
	| "processing-fallback"
	| "device-changed";
type EventState =
	| RTCPeerConnectionState
	| MicState
	| AudioProcessing
	| "requested"
	| "open"
	| "joined"
	| "rejoined"
	| "changed";
type VoiceDiagnosticsEvent = Membership & {
	at: string;
	kind: EventKind;
	peerMemberId: string | null;
	state: EventState | number | null;
	previousState: EventState | null;
};
type VoiceDiagnosticsExport = {
	schemaVersion: 1;
	samples: VoiceDiagnosticsSample[];
	events: VoiceDiagnosticsEvent[];
};

type PeerDiagnostics = {
	connection: RTCPeerConnection;
	remoteTrack: MediaStreamTrack | null;
	previous: RTCStatsCounters | null;
};
type RTCStatsCounters = {
	packetsReceived: number | null;
	packetsLost: number | null;
	packetsSent: number | null;
	bytesReceived: number | null;
	bytesSent: number | null;
	concealmentEvents: number | null;
	concealedSamples: number | null;
};
type VoiceDiagnosticsOptions = {
	sessionId: string | null;
	now?: () => Date;
	getRemoteRms?: (peerMemberId: string) => number | null;
	getLocalState?: () => LocalDiagnosticsState;
	onLogAvailable?: () => void;
};

const SAMPLE_INTERVAL = 5_000;
const MAX_SAMPLES = 240;
const MAX_EVENTS = 128;
const LOG_KEY = "cogm.voiceDiagnosticsLog";
const CANDIDATE_TYPES = ["host", "srflx", "prflx", "relay"] as const;

function finiteMetric(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) && value >= 0
		? value
		: null;
}

function counter(value: unknown): number | null {
	const metric = finiteMetric(value);
	return metric === null ? null : Math.floor(metric);
}

function counterDelta(current: number | null, previous: number | null): number {
	return current === null || previous === null
		? 0
		: Math.max(0, current - previous);
}

function statsRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null
		? (value as Record<string, unknown>)
		: null;
}

function statsById(
	report: RTCStatsReport,
	id: unknown,
): Record<string, unknown> | null {
	return typeof id === "string" ? statsRecord(report.get(id)) : null;
}

function candidateType(
	value: unknown,
): VoiceDiagnosticsSample["localCandidateType"] {
	return typeof value === "string" &&
		(CANDIDATE_TYPES as readonly string[]).includes(value)
		? (value as (typeof CANDIDATE_TYPES)[number])
		: "unknown";
}

function candidateProtocol(
	value: unknown,
): VoiceDiagnosticsSample["localCandidateProtocol"] {
	return value === "udp" || value === "tcp" ? value : "unknown";
}

export class VoiceDiagnostics {
	private readonly now: () => Date;
	private sessionId: string | null;
	private consent = false;
	private membership: Membership | null = null;
	private generation = 0;
	private sampleTimer: Timer | undefined;
	private sampling = false;
	private log: VoiceDiagnosticsExport = {
		schemaVersion: 1,
		samples: [],
		events: [],
	};
	private readonly peers = new Map<string, PeerDiagnostics>();

	constructor(private readonly options: VoiceDiagnosticsOptions) {
		this.sessionId = options.sessionId;
		this.now = options.now ?? (() => new Date());
		if (this.sessionId) this.restoreLog(this.sessionId);
	}

	get hasLog(): boolean {
		return this.log.samples.length > 0 || this.log.events.length > 0;
	}

	exportJson(): string | null {
		return this.hasLog ? JSON.stringify(this.log) : null;
	}

	private restoreLog(sessionId: string): void {
		try {
			localStorage.removeItem("cogm.voiceDiagnosticsConsent");
		} catch {}
		try {
			const raw = sessionStorage.getItem(LOG_KEY);
			if (!raw) return;
			const stored = JSON.parse(raw) as {
				sessionId: string;
				log: VoiceDiagnosticsExport;
			};
			if (stored?.sessionId !== sessionId) {
				sessionStorage.removeItem(LOG_KEY);
				return;
			}
			const log = stored.log;
			if (
				log?.schemaVersion === 1 &&
				Array.isArray(log.samples) &&
				log.samples.length <= MAX_SAMPLES &&
				Array.isArray(log.events) &&
				log.events.length <= MAX_EVENTS
			) {
				this.log.samples = log.samples;
				this.log.events = log.events;
			}
		} catch {}
	}

	private persistLog(wasEmpty: boolean): void {
		try {
			sessionStorage.setItem(
				LOG_KEY,
				JSON.stringify({ sessionId: this.sessionId, log: this.log }),
			);
		} catch {}
		if (wasEmpty) this.options.onLogAvailable?.();
	}

	private resetSampling(): void {
		this.generation += 1;
		this.sampling = false;
		clearInterval(this.sampleTimer);
		this.sampleTimer = undefined;
		for (const peer of this.peers.values()) peer.previous = null;
		if (this.sessionId && this.consent && this.membership) {
			this.sampleTimer = setInterval(() => {
				void this.sampleNow();
			}, SAMPLE_INTERVAL);
		}
	}

	setSessionId(sessionId: string | null): void {
		if (this.sessionId === sessionId) return;
		const previous = this.sessionId;
		this.sessionId = sessionId;
		this.close();
		this.log = { schemaVersion: 1, samples: [], events: [] };
		if (previous) {
			try {
				sessionStorage.removeItem(LOG_KEY);
			} catch {}
		} else if (sessionId) {
			this.restoreLog(sessionId);
		}
	}

	setConsent(consented: boolean): void {
		if (this.consent === consented) return;
		this.consent = consented;
		this.resetSampling();
	}

	setMembership(
		roomId: string | null,
		memberId: string | null,
		kind?: "voice-join" | "voice-rejoin",
	): void {
		if (
			(this.membership?.roomId ?? null) === roomId &&
			(this.membership?.memberId ?? null) === memberId
		)
			return;
		this.membership = roomId && memberId ? { roomId, memberId } : null;
		this.resetSampling();
		if (kind && this.membership) {
			this.recordEvent(kind, kind === "voice-rejoin" ? "rejoined" : "joined");
		}
	}

	setPeerConnection(
		peerMemberId: string,
		connection: RTCPeerConnection | null,
	): void {
		if (!connection) {
			this.peers.delete(peerMemberId);
			return;
		}
		this.peers.set(peerMemberId, {
			connection,
			remoteTrack: this.peers.get(peerMemberId)?.remoteTrack ?? null,
			previous: null,
		});
	}

	setPeerRemoteTrack(
		peerMemberId: string,
		remoteTrack: MediaStreamTrack | null,
	): void {
		const peer = this.peers.get(peerMemberId);
		if (peer) peer.remoteTrack = remoteTrack;
	}

	recordEvent(
		kind: EventKind,
		state: EventState | number | null = null,
		previousState: EventState | null = null,
		peerMemberId: string | null = null,
	): void {
		if (!this.sessionId || !this.consent || !this.membership) return;
		const wasEmpty = !this.hasLog;
		const events = this.log.events;
		if (events.length === MAX_EVENTS) events.shift();
		events.push({
			...this.membership,
			at: this.now().toISOString(),
			kind,
			peerMemberId,
			state,
			previousState,
		});
		this.persistLog(wasEmpty);
	}

	async sampleNow(): Promise<void> {
		const membership = this.membership;
		if (
			!this.sessionId ||
			!this.consent ||
			!membership ||
			this.sampling ||
			this.peers.size === 0
		)
			return;
		this.sampling = true;
		const generation = this.generation;
		const at = this.now().toISOString();
		try {
			const reports = await Promise.all(
				Array.from(this.peers, async ([id, peer]) => {
					try {
						return { id, peer, report: await peer.connection.getStats() };
					} catch {
						return null;
					}
				}),
			);
			if (generation !== this.generation) return;
			const wasEmpty = !this.hasLog;
			const samples = this.log.samples;
			let changed = false;
			for (const entry of reports) {
				if (!entry || this.peers.get(entry.id) !== entry.peer) continue;
				if (samples.length === MAX_SAMPLES) samples.shift();
				samples.push(
					this.createSample(membership, at, entry.id, entry.peer, entry.report),
				);
				changed = true;
			}
			if (changed) this.persistLog(wasEmpty);
		} finally {
			if (generation === this.generation) this.sampling = false;
		}
	}

	private createSample(
		membership: Membership,
		at: string,
		peerMemberId: string,
		peer: PeerDiagnostics,
		report: RTCStatsReport,
	): VoiceDiagnosticsSample {
		let transport: Record<string, unknown> | null = null;
		let inbound: Record<string, unknown> | null = null;
		let outbound: Record<string, unknown> | null = null;
		for (const value of report.values()) {
			const record = statsRecord(value);
			if (!record) continue;
			if (record.type === "transport") transport ??= record;
			if (record.kind !== "audio" && record.mediaType !== "audio") continue;
			if (record.type === "inbound-rtp") inbound ??= record;
			if (record.type === "outbound-rtp") outbound ??= record;
		}
		const pair = statsById(report, transport?.selectedCandidatePairId);
		const local = statsById(report, pair?.localCandidateId);
		const remote = statsById(report, pair?.remoteCandidateId);
		const next: RTCStatsCounters = {
			packetsReceived: counter(inbound?.packetsReceived),
			packetsLost: counter(inbound?.packetsLost),
			packetsSent: counter(outbound?.packetsSent),
			bytesReceived: counter(inbound?.bytesReceived),
			bytesSent: counter(outbound?.bytesSent),
			concealmentEvents: counter(inbound?.concealmentEvents),
			concealedSamples: counter(inbound?.concealedSamples),
		};
		const previous = peer.previous;
		peer.previous = next;
		const roundTripTime = finiteMetric(pair?.currentRoundTripTime);
		const jitter = finiteMetric(inbound?.jitter);
		const remoteRms = finiteMetric(this.options.getRemoteRms?.(peerMemberId));
		const localState = this.options.getLocalState?.();
		return {
			...membership,
			at,
			peerMemberId,
			rttMs: roundTripTime === null ? null : roundTripTime * 1000,
			jitterMs: jitter === null ? null : jitter * 1000,
			availableOutgoingBitrate: finiteMetric(pair?.availableOutgoingBitrate),
			packetsReceivedDelta: counterDelta(
				next.packetsReceived,
				previous?.packetsReceived ?? null,
			),
			packetsLostDelta: counterDelta(
				next.packetsLost,
				previous?.packetsLost ?? null,
			),
			packetsSentDelta: counterDelta(
				next.packetsSent,
				previous?.packetsSent ?? null,
			),
			bytesReceivedDelta: counterDelta(
				next.bytesReceived,
				previous?.bytesReceived ?? null,
			),
			bytesSentDelta: counterDelta(next.bytesSent, previous?.bytesSent ?? null),
			concealmentEventsDelta: counterDelta(
				next.concealmentEvents,
				previous?.concealmentEvents ?? null,
			),
			concealedSamplesDelta: counterDelta(
				next.concealedSamples,
				previous?.concealedSamples ?? null,
			),
			localCandidateType: candidateType(local?.candidateType),
			localCandidateProtocol: candidateProtocol(local?.protocol),
			remoteCandidateType: candidateType(remote?.candidateType),
			remoteCandidateProtocol: candidateProtocol(remote?.protocol),
			connectionState: peer.connection.connectionState,
			iceConnectionState: peer.connection.iceConnectionState,
			signalingState: peer.connection.signalingState,
			remoteTrackMuted: peer.remoteTrack?.muted ?? false,
			remoteTrackEnabled: peer.remoteTrack?.enabled ?? false,
			remoteTrackReadyState: peer.remoteTrack?.readyState ?? null,
			remoteRms,
			localMicState: localState?.localMicState ?? "off",
			audioProcessing: localState?.audioProcessing ?? "idle",
		};
	}

	close(): void {
		this.consent = false;
		this.membership = null;
		this.peers.clear();
		this.resetSampling();
	}
}
