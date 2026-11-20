import type {
	VoiceDiagnosticsBatch,
	VoiceDiagnosticsConsent,
	VoiceDiagnosticsEvent,
	VoiceDiagnosticsSample,
} from "@cogm/shared";

export type VoiceDiagnosticsStatus = "disabled" | "pending" | "active" | "error";
export type VoiceDiagnosticsEventKind = VoiceDiagnosticsEvent["kind"];

type ConsentPreference = Pick<
	VoiceDiagnosticsConsent,
	"consentVersion" | "acceptedAt"
>;
type LocalDiagnosticsState = Pick<
	VoiceDiagnosticsSample,
	"localMicState" | "audioProcessing"
>;
type PeerDiagnostics = {
	connection: RTCPeerConnection | null;
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
type PendingBatch = {
	body: VoiceDiagnosticsBatch;
	attempts: number;
};

export type VoiceDiagnosticsOptions = {
	sessionId: string | null;
	consent?: ConsentPreference | null;
	fetch?: typeof fetch;
	now?: () => Date;
	getRemoteRms?: (peerMemberId: string) => number | null;
	getLocalState?: () => LocalDiagnosticsState;
	onStatus?: (status: VoiceDiagnosticsStatus) => void;
	sampleIntervalMs?: number;
	flushIntervalMs?: number;
	maxQueuedSamples?: number;
	maxQueuedEvents?: number;
	maxFlushAttempts?: number;
};

const DEFAULT_SAMPLE_INTERVAL = 5_000;
const DEFAULT_FLUSH_INTERVAL = 15_000;
const DEFAULT_MAX_QUEUED_SAMPLES = 240;
const DEFAULT_MAX_QUEUED_EVENTS = 128;
const DEFAULT_MAX_FLUSH_ATTEMPTS = 3;
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

function candidateType(value: unknown): VoiceDiagnosticsSample["localCandidateType"] {
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
	private readonly fetchImpl: typeof fetch;
	private readonly now: () => Date;
	private readonly getRemoteRms: (peerMemberId: string) => number | null;
	private readonly getLocalState: () => LocalDiagnosticsState;
	private readonly onStatus: ((status: VoiceDiagnosticsStatus) => void) | undefined;
	private readonly sampleIntervalMs: number;
	private readonly flushIntervalMs: number;
	private readonly maxQueuedSamples: number;
	private readonly maxQueuedEvents: number;
	private readonly maxFlushAttempts: number;
	private sessionId: string | null;
	private consent: ConsentPreference | null;
	private roomId: string | null = null;
	private memberId: string | null = null;
	private registeredKey: string | null = null;
	private generation = 0;
	private sampleTimer: ReturnType<typeof setInterval> | null = null;
	private flushTimer: ReturnType<typeof setInterval> | null = null;
	private sampling = false;
	private inFlight: PendingBatch | null = null;
	private readonly batches: PendingBatch[] = [];
	private currentSamples: VoiceDiagnosticsSample[] = [];
	private currentEvents: VoiceDiagnosticsEvent[] = [];
	private readonly peers = new Map<string, PeerDiagnostics>();
	status: VoiceDiagnosticsStatus;

	constructor(options: VoiceDiagnosticsOptions) {
		this.sessionId = options.sessionId;
		this.consent = options.consent ?? null;
		this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
		this.now = options.now ?? (() => new Date());
		this.getRemoteRms = options.getRemoteRms ?? (() => null);
		this.getLocalState =
			options.getLocalState ??
			(() => ({ localMicState: "off", audioProcessing: "idle" }));
		this.onStatus = options.onStatus;
		this.sampleIntervalMs = options.sampleIntervalMs ?? DEFAULT_SAMPLE_INTERVAL;
		this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL;
		this.maxQueuedSamples = Math.min(
			256,
			Math.max(1, options.maxQueuedSamples ?? DEFAULT_MAX_QUEUED_SAMPLES),
		);
		this.maxQueuedEvents = Math.min(
			256,
			Math.max(1, options.maxQueuedEvents ?? DEFAULT_MAX_QUEUED_EVENTS),
		);
		this.maxFlushAttempts = Math.max(
			1,
			options.maxFlushAttempts ?? DEFAULT_MAX_FLUSH_ATTEMPTS,
		);
		this.status = this.consent ? "pending" : "disabled";
		if (typeof window !== "undefined") {
			window.addEventListener("pagehide", this.onPageHide);
			document.addEventListener("visibilitychange", this.onVisibilityChange);
		}
	}

	get consented(): boolean {
		return this.consent !== null;
	}

	private setStatus(status: VoiceDiagnosticsStatus): void {
		if (this.status === status) return;
		this.status = status;
		this.onStatus?.(status);
	}

	private endpoint(kind: "consent" | "revoke" | "samples"): string {
		return `/api/v1/sessions/${encodeURIComponent(this.sessionId ?? "")}/voice-diagnostics/${kind}`;
	}

	private activeConsent(): VoiceDiagnosticsConsent | null {
		if (!this.consent || !this.roomId || !this.memberId) return null;
		return {
			roomId: this.roomId,
			memberId: this.memberId,
			consentVersion: this.consent.consentVersion,
			acceptedAt: this.consent.acceptedAt,
		};
	}

	private canUpload(): boolean {
		return Boolean(
			this.sessionId &&
				this.registeredKey === `${this.roomId}:${this.memberId}` &&
				this.activeConsent(),
		);
	}

	private clearTimers(): void {
		if (this.sampleTimer) clearInterval(this.sampleTimer);
		if (this.flushTimer) clearInterval(this.flushTimer);
		this.sampleTimer = null;
		this.flushTimer = null;
	}

	private startTimers(): void {
		if (!this.canUpload() || this.sampleTimer || this.flushTimer) return;
		this.sampleTimer = setInterval(() => {
			void this.sampleNow();
		}, this.sampleIntervalMs);
		this.flushTimer = setInterval(() => {
			void this.flush();
		}, this.flushIntervalMs);
	}

	private clearPending(): void {
		this.batches.length = 0;
		this.currentSamples = [];
		this.currentEvents = [];
		this.inFlight = null;
		for (const peer of this.peers.values()) peer.previous = null;
	}

	setSessionId(sessionId: string | null): void {
		if (this.sessionId === sessionId) return;
		this.generation += 1;
		this.sessionId = sessionId;
		this.registeredKey = null;
		this.clearTimers();
		this.clearPending();
		this.setStatus(this.consent ? "pending" : "disabled");
	}

	async setConsent(consented: boolean, acceptedAt?: string): Promise<void> {
		if (!consented) {
			const consent = this.activeConsent();
			const sessionId = this.sessionId;
			this.generation += 1;
			this.consent = null;
			this.registeredKey = null;
			this.clearTimers();
			this.clearPending();
			this.setStatus("disabled");
			if (!consent || !sessionId) return;
			try {
				await this.fetchImpl(this.endpoint("revoke"), {
					method: "POST",
					credentials: "include",
					keepalive: true,
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ roomId: consent.roomId, memberId: consent.memberId }),
				});
			} catch {}
			return;
		}
		if (!this.consent) {
			this.consent = {
				consentVersion: 1,
				acceptedAt: acceptedAt ?? this.now().toISOString(),
			};
		}
		this.setStatus(this.canUpload() ? "active" : "pending");
		await this.register();
	}

	async setMembership(
		roomId: string | null,
		memberId: string | null,
		kind?: "voice-join" | "voice-rejoin",
	): Promise<void> {
		const nextRoom = roomId && memberId ? roomId : null;
		const nextMember = roomId && memberId ? memberId : null;
		if (this.roomId === nextRoom && this.memberId === nextMember) {
			await this.register();
			return;
		}
		this.generation += 1;
		this.roomId = nextRoom;
		this.memberId = nextMember;
		this.registeredKey = null;
		this.clearTimers();
		this.clearPending();
		for (const peer of this.peers.values()) peer.previous = null;
		this.setStatus(this.consent ? "pending" : "disabled");
		if (kind && nextRoom && nextMember) {
			this.recordEvent(kind, kind === "voice-rejoin" ? "rejoined" : "joined");
		}
		await this.register();
	}

	private async register(): Promise<void> {
		const consent = this.activeConsent();
		if (!consent || !this.sessionId || this.canUpload()) return;
		const generation = this.generation;
		const key = `${consent.roomId}:${consent.memberId}`;
		this.setStatus("pending");
		try {
			const response = await this.fetchImpl(this.endpoint("consent"), {
				method: "PUT",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(consent),
			});
			if (generation !== this.generation || !this.consent) return;
			if (!response.ok) {
				this.setStatus("error");
				return;
			}
			this.registeredKey = key;
			this.setStatus("active");
			this.startTimers();
		} catch {
			if (generation === this.generation && this.consent) this.setStatus("error");
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
		const existing = this.peers.get(peerMemberId);
		this.peers.set(peerMemberId, {
			connection,
			remoteTrack: existing?.remoteTrack ?? null,
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
		kind: VoiceDiagnosticsEventKind,
		state: string | null = null,
		previousState: string | null = null,
		peerMemberId: string | null = null,
	): void {
		if (!this.consent || !this.roomId || !this.memberId) return;
		this.currentEvents.push({
			at: this.now().toISOString(),
			kind,
			peerMemberId,
			state: state?.slice(0, 64) ?? null,
			previousState: previousState?.slice(0, 64) ?? null,
		});
		this.trimQueue();
	}

	async sampleNow(): Promise<void> {
		if (!this.canUpload() || this.sampling) return;
		this.sampling = true;
		const generation = this.generation;
		const at = this.now().toISOString();
		const peers = [...this.peers.entries()].filter(
			(entry): entry is [string, PeerDiagnostics & { connection: RTCPeerConnection }] =>
				entry[1].connection !== null,
		);
		try {
			await Promise.all(
				peers.map(async ([peerMemberId, peer]) => {
					let report: RTCStatsReport;
					try {
						report = await peer.connection.getStats();
					} catch {
						return;
					}
					if (
						generation !== this.generation ||
						this.peers.get(peerMemberId) !== peer ||
						!this.canUpload()
					) {
						return;
					}
					const sample = this.createSample(at, peerMemberId, peer, report);
					this.currentSamples.push(sample);
					this.trimQueue();
				}),
			);
		} finally {
			this.sampling = false;
		}
	}

	private createSample(
		at: string,
		peerMemberId: string,
		peer: PeerDiagnostics & { connection: RTCPeerConnection },
		report: RTCStatsReport,
	): VoiceDiagnosticsSample {
		const records: Record<string, unknown>[] = [];
		report.forEach((value) => {
			const record = statsRecord(value);
			if (record) records.push(record);
		});
		const byId = new Map(
			records
				.filter((record) => typeof record.id === "string")
				.map((record) => [record.id as string, record]),
		);
		const transport = records.find((record) => record.type === "transport");
		const pairId = transport?.selectedCandidatePairId;
		const pair = typeof pairId === "string" ? byId.get(pairId) : undefined;
		const localCandidateId = pair?.localCandidateId;
		const remoteCandidateId = pair?.remoteCandidateId;
		const local =
			typeof localCandidateId === "string"
				? byId.get(localCandidateId)
				: undefined;
		const remote =
			typeof remoteCandidateId === "string"
				? byId.get(remoteCandidateId)
				: undefined;
		const inbound = records.find(
			(record) =>
				record.type === "inbound-rtp" &&
				(record.kind === "audio" || record.mediaType === "audio"),
		);
		const outbound = records.find(
			(record) =>
				record.type === "outbound-rtp" &&
				(record.kind === "audio" || record.mediaType === "audio"),
		);
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
		let remoteRms: number | null = null;
		try {
			remoteRms = this.getRemoteRms(peerMemberId);
		} catch {}
		const localState = this.getLocalState();
		return {
			at,
			peerMemberId,
			rttMs: roundTripTime === null ? null : roundTripTime * 1000,
			jitterMs: jitter === null ? null : jitter * 1000,
			availableOutgoingBitrate: finiteMetric(pair?.availableOutgoingBitrate),
			packetsReceivedDelta: counterDelta(
				next.packetsReceived,
				previous?.packetsReceived ?? null,
			),
			packetsLostDelta: counterDelta(next.packetsLost, previous?.packetsLost ?? null),
			packetsSentDelta: counterDelta(next.packetsSent, previous?.packetsSent ?? null),
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
			localMicState: localState.localMicState,
			audioProcessing: localState.audioProcessing,
		};
	}

	private trimQueue(): void {
		let sampleCount =
			this.currentSamples.length +
			this.batches.reduce((count, batch) => count + batch.body.samples.length, 0);
		while (sampleCount > this.maxQueuedSamples) {
			const batch = this.batches.find((item) => item.body.samples.length > 0);
			if (batch) batch.body.samples.shift();
			else this.currentSamples.shift();
			sampleCount -= 1;
		}
		let eventCount =
			this.currentEvents.length +
			this.batches.reduce((count, batch) => count + batch.body.events.length, 0);
		while (eventCount > this.maxQueuedEvents) {
			const batch = this.batches.find((item) => item.body.events.length > 0);
			if (batch) batch.body.events.shift();
			else this.currentEvents.shift();
			eventCount -= 1;
		}
		for (let index = this.batches.length - 1; index >= 0; index -= 1) {
			const body = this.batches[index]?.body;
			if (body && body.samples.length === 0 && body.events.length === 0) {
				this.batches.splice(index, 1);
			}
		}
	}

	async flush(keepalive = false): Promise<void> {
		if (!this.canUpload() || this.inFlight) return;
		const consent = this.activeConsent();
		if (!consent) return;
		if (this.currentSamples.length > 0 || this.currentEvents.length > 0) {
			this.batches.push({
				body: {
					schemaVersion: 1,
					consent,
					samples: this.currentSamples,
					events: this.currentEvents,
				},
				attempts: 0,
			});
			this.currentSamples = [];
			this.currentEvents = [];
		}
		const pending = this.batches.shift();
		if (!pending) return;
		pending.attempts += 1;
		this.inFlight = pending;
		const generation = this.generation;
		try {
			const response = await this.fetchImpl(this.endpoint("samples"), {
				method: "POST",
				credentials: "include",
				keepalive,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(pending.body),
			});
			if (generation !== this.generation) return;
			if (!response.ok) throw new Error("Diagnostics upload failed");
			this.setStatus("active");
		} catch {
			if (generation !== this.generation) return;
			if (pending.attempts < this.maxFlushAttempts) this.batches.unshift(pending);
			this.setStatus("error");
		} finally {
			if (this.inFlight === pending) this.inFlight = null;
		}
	}

	private readonly onPageHide = (): void => {
		void this.flush(true);
	};

	private readonly onVisibilityChange = (): void => {
		if (document.hidden) void this.flush(true);
	};

	close(): void {
		this.generation += 1;
		this.clearTimers();
		this.clearPending();
		this.peers.clear();
		this.registeredKey = null;
		this.setStatus(this.consent ? "pending" : "disabled");
		if (typeof window !== "undefined") {
			window.removeEventListener("pagehide", this.onPageHide);
			document.removeEventListener("visibilitychange", this.onVisibilityChange);
		}
	}
}
