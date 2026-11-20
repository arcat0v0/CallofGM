import { afterEach, describe, expect, jest, mock, test } from "bun:test";
import { VoiceDiagnostics } from "@/features/voice/voice-diagnostics";

const sessionId = "00000000-0000-4000-8000-000000000100";
const roomId = "00000000-0000-4000-8000-000000000101";
const memberId = "00000000-0000-4000-8000-000000000102";
const peerMemberId = "00000000-0000-4000-8000-000000000103";
const acceptedAt = "2026-11-20T08:00:00.000Z";
const samplePath = `/api/v1/sessions/${sessionId}/voice-diagnostics/samples`;

type FetchCall = [input: RequestInfo | URL, init?: RequestInit];

function response(ok = true): Response {
	return { ok } as Response;
}

function bodyOf(call: FetchCall): Record<string, unknown> {
	return JSON.parse(String(call[1]?.body)) as Record<string, unknown>;
}

function statsReport(values: {
	received: number;
	lost: number;
	sent: number;
	bytesReceived: number;
	bytesSent: number;
	concealmentEvents: number;
	concealedSamples: number;
	candidateType?: string;
	protocol?: string;
}): RTCStatsReport {
	const report = new Map<string, Record<string, unknown>>([
		[
			"transport",
			{ id: "transport", type: "transport", selectedCandidatePairId: "pair" },
		],
		[
			"pair",
			{
				id: "pair",
				type: "candidate-pair",
				localCandidateId: "local-address-id",
				remoteCandidateId: "remote-address-id",
				currentRoundTripTime: 0.025,
				availableOutgoingBitrate: 64_000,
			},
		],
		[
			"local-address-id",
			{
				id: "local-address-id",
				type: "local-candidate",
				candidateType: values.candidateType ?? "host",
				protocol: values.protocol ?? "udp",
				address: "192.168.1.20",
				port: 53210,
			},
		],
		[
			"remote-address-id",
			{
				id: "remote-address-id",
				type: "remote-candidate",
				candidateType: "srflx",
				protocol: "tcp",
				address: "203.0.113.8",
				port: 443,
			},
		],
		[
			"inbound",
			{
				id: "inbound",
				type: "inbound-rtp",
				kind: "audio",
				packetsReceived: values.received,
				packetsLost: values.lost,
				bytesReceived: values.bytesReceived,
				jitter: 0.012,
				concealmentEvents: values.concealmentEvents,
				concealedSamples: values.concealedSamples,
			},
		],
		[
			"outbound",
			{
				id: "outbound",
				type: "outbound-rtp",
				kind: "audio",
				packetsSent: values.sent,
				bytesSent: values.bytesSent,
			},
		],
	]);
	return report as unknown as RTCStatsReport;
}

function cumulative(overrides: Partial<Parameters<typeof statsReport>[0]> = {}) {
	return statsReport({
		received: 100,
		lost: 4,
		sent: 80,
		bytesReceived: 10_000,
		bytesSent: 8_000,
		concealmentEvents: 3,
		concealedSamples: 300,
		...overrides,
	});
}

function fixture(options: {
	fetchImpl?: (call: FetchCall) => Promise<Response>;
	maxQueuedSamples?: number;
	maxFlushAttempts?: number;
} = {}) {
	const calls: FetchCall[] = [];
	const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
		const call: FetchCall = [input, init];
		calls.push(call);
		return options.fetchImpl
			? options.fetchImpl(call)
			: response(true);
	});
	let clock = Date.parse(acceptedAt);
	const diagnostics = new VoiceDiagnostics({
		sessionId,
		fetch: fetchMock as unknown as typeof fetch,
		getRemoteRms: () => 0.025,
		maxQueuedSamples: options.maxQueuedSamples,
		maxFlushAttempts: options.maxFlushAttempts,
	});
	const connection = {
		connectionState: "connected",
		iceConnectionState: "connected",
		signalingState: "stable",
		getStats: mock(async () => cumulative()),
	} as unknown as RTCPeerConnection;
	const track = {
		muted: false,
		enabled: true,
		readyState: "live",
	} as MediaStreamTrack;
	return { diagnostics, calls, fetchMock, connection, track };
}

async function acceptAndJoin(diagnostics: VoiceDiagnostics): Promise<void> {
	await diagnostics.setConsent(true, acceptedAt);
	await diagnostics.setMembership(roomId, memberId, "voice-join");
}

afterEach(() => {
	jest.useRealTimers();
});

describe("voice diagnostics consent and transport", () => {
	test("does not fetch, sample, or start timers before explicit consent", async () => {
		jest.useFakeTimers();
		const { diagnostics, calls, fetchMock, connection } = fixture();
		diagnostics.setPeerConnection(peerMemberId, connection);
		await diagnostics.setMembership(roomId, memberId, "voice-join");
		jest.advanceTimersByTime(30_000);
		await diagnostics.sampleNow();
		await diagnostics.flush();
		expect(fetchMock).not.toHaveBeenCalled();
		expect(calls).toHaveLength(0);
		expect(diagnostics.status).toBe("disabled");
		diagnostics.close();
	});

	test("saves consent before joining but only registers and uploads for a current member", async () => {
		const { diagnostics, calls } = fixture();
		await diagnostics.setConsent(true, acceptedAt);
		await diagnostics.flush();
		expect(calls).toHaveLength(0);
		expect(diagnostics.status).toBe("pending");
		await diagnostics.setMembership(roomId, memberId, "voice-join");
		expect(calls).toHaveLength(1);
		expect(String(calls[0]?.[0])).toContain("/voice-diagnostics/consent");
		expect(calls[0]?.[1]?.method).toBe("PUT");
		expect(bodyOf(calls[0] as FetchCall)).toEqual({
			roomId,
			memberId,
			consentVersion: 1,
			acceptedAt,
		});
		expect(diagnostics.status).toBe("active");
		diagnostics.close();
	});

	test("re-registers a reconnected member with the original acceptance time", async () => {
		const { diagnostics, calls } = fixture();
		await acceptAndJoin(diagnostics);
		const nextMemberId = "00000000-0000-4000-8000-000000000104";
		await diagnostics.setMembership(null, null);
		await diagnostics.setMembership(roomId, nextMemberId, "voice-rejoin");
		const registrations = calls.filter(([input]) =>
			String(input).endsWith("/voice-diagnostics/consent"),
		);
		expect(registrations).toHaveLength(2);
		expect(bodyOf(registrations[1] as FetchCall)).toEqual({
			roomId,
			memberId: nextMemberId,
			consentVersion: 1,
			acceptedAt,
		});
		diagnostics.close();
	});

	test("revokes immediately, clears pending samples, and sends no later sample POST", async () => {
		const { diagnostics, calls, connection, track } = fixture();
		await acceptAndJoin(diagnostics);
		diagnostics.setPeerConnection(peerMemberId, connection);
		diagnostics.setPeerRemoteTrack(peerMemberId, track);
		await diagnostics.sampleNow();
		await diagnostics.setConsent(false);
		await diagnostics.flush();
		expect(calls.some(([input]) => String(input) === samplePath)).toBe(false);
		const revoke = calls.find(([input]) =>
			String(input).endsWith("/voice-diagnostics/revoke"),
		);
		expect(revoke).toBeDefined();
		expect(bodyOf(revoke as FetchCall)).toEqual({ roomId, memberId });
		expect(diagnostics.status).toBe("disabled");
		diagnostics.close();
	});
});

describe("voice diagnostics RTC samples", () => {
	test("reports per-peer deltas and only allowlisted candidate metadata", async () => {
		const { diagnostics, calls, connection, track } = fixture();
		await acceptAndJoin(diagnostics);
		diagnostics.setPeerConnection(peerMemberId, connection);
		diagnostics.setPeerRemoteTrack(peerMemberId, track);
		await diagnostics.sampleNow();
		connection.getStats = mock(async () =>
			cumulative({
				received: 155,
				lost: 2,
				sent: 110,
				bytesReceived: 15_500,
				bytesSent: 11_000,
				concealmentEvents: 8,
				concealedSamples: 900,
				candidateType: "invalid-candidate",
				protocol: "sctp",
			}),
		);
		await diagnostics.sampleNow();
		await diagnostics.flush();
		const post = calls.find(([input]) => String(input) === samplePath);
		expect(post).toBeDefined();
		const body = bodyOf(post as FetchCall);
		expect(body.schemaVersion).toBe(1);
		expect(body.consent).toEqual({
			roomId,
			memberId,
			consentVersion: 1,
			acceptedAt,
		});
		const samples = body.samples as Array<Record<string, unknown>>;
		expect(samples).toHaveLength(2);
		expect(samples[0]).toMatchObject({
			peerMemberId,
			packetsReceivedDelta: 0,
			packetsLostDelta: 0,
			rttMs: 25,
			jitterMs: 12,
			remoteRms: 0.025,
			remoteTrackReadyState: "live",
			localCandidateType: "host",
			localCandidateProtocol: "udp",
			remoteCandidateType: "srflx",
			remoteCandidateProtocol: "tcp",
		});
		expect(samples[1]).toMatchObject({
			packetsReceivedDelta: 55,
			packetsLostDelta: 0,
			packetsSentDelta: 30,
			bytesReceivedDelta: 5_500,
			bytesSentDelta: 3_000,
			concealmentEventsDelta: 5,
			concealedSamplesDelta: 600,
			localCandidateType: "unknown",
			localCandidateProtocol: "unknown",
		});
		const serialized = JSON.stringify(body);
		expect(serialized).not.toContain("192.168.1.20");
		expect(serialized).not.toContain("203.0.113.8");
		expect(serialized).not.toContain("local-address-id");
		expect(serialized).not.toMatch(/sdp|deviceId|deviceLabel|fingerprint|characterName/i);
		diagnostics.close();
	});

	test("keeps failed batches bounded and retries without recomputing deltas", async () => {
		let failSamples = true;
		const { diagnostics, calls, connection } = fixture({
			maxQueuedSamples: 2,
			maxFlushAttempts: 2,
			fetchImpl: async ([input]) => {
				if (String(input) === samplePath && failSamples) throw new Error("offline");
				return response(true);
			},
		});
		await acceptAndJoin(diagnostics);
		diagnostics.setPeerConnection(peerMemberId, connection);
		for (let index = 0; index < 5; index += 1) {
			await diagnostics.sampleNow();
			await diagnostics.flush();
		}
		failSamples = false;
		await diagnostics.sampleNow();
		await diagnostics.flush();
		const successfulPosts = calls.filter(
			([input, init]) => String(input) === samplePath && init?.keepalive !== true,
		);
		const lastPost = successfulPosts.at(-1);
		expect(lastPost).toBeDefined();
		const samples = bodyOf(lastPost as FetchCall).samples as Array<
			Record<string, unknown>
		>;
		expect(samples.length).toBeLessThanOrEqual(2);
		expect(samples.length).toBeGreaterThan(0);
		for (const sample of samples) {
			for (const [key, value] of Object.entries(sample)) {
				if (key.endsWith("Delta")) expect(value).toBeGreaterThanOrEqual(0);
			}
		}
		expect(diagnostics.status).toBe("active");
		diagnostics.close();
	});

	test("uses keepalive on page hide without flushing without consent", async () => {
		const { diagnostics, calls, connection } = fixture();
		window.dispatchEvent(new PageTransitionEvent("pagehide"));
		await diagnostics.setConsent(true, acceptedAt);
		await diagnostics.setMembership(roomId, memberId, "voice-join");
		diagnostics.setPeerConnection(peerMemberId, connection);
		await diagnostics.sampleNow();
		window.dispatchEvent(new PageTransitionEvent("pagehide"));
		await Promise.resolve();
		const post = calls.find(([input]) => String(input) === samplePath);
		expect(post?.[1]?.keepalive).toBe(true);
		diagnostics.close();
	});
});
