import { afterEach, describe, expect, jest, mock, test } from "bun:test";
import { VoiceDiagnostics } from "@/features/voice/voice-diagnostics";

const sessionId = "00000000-0000-4000-8000-000000000100";
const roomId = "00000000-0000-4000-8000-000000000101";
const memberId = "00000000-0000-4000-8000-000000000102";
const peerMemberId = "00000000-0000-4000-8000-000000000103";
const acceptedAt = "2026-11-20T08:00:00.000Z";
const otherMemberId = "00000000-0000-4000-8000-000000000104";
const otherSessionId = "00000000-0000-4000-8000-000000000105";

function exported(diagnostics: VoiceDiagnostics) {
	return JSON.parse(diagnostics.exportJson() ?? "null");
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

function cumulative(
	overrides: Partial<Parameters<typeof statsReport>[0]> = {},
) {
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

function fixture() {
	let clock = Date.parse(acceptedAt);
	const diagnostics = new VoiceDiagnostics({
		sessionId,
		now: () => new Date(clock++),
		getRemoteRms: () => 0.025,
	});
	const getStats = mock(async () => cumulative());
	const connection = {
		connectionState: "connected",
		iceConnectionState: "connected",
		signalingState: "stable",
		getStats,
	} as unknown as RTCPeerConnection;
	diagnostics.setPeerConnection(peerMemberId, connection);
	diagnostics.setPeerRemoteTrack(peerMemberId, {
		muted: false,
		enabled: true,
		readyState: "live",
		label: "private microphone label",
	} as MediaStreamTrack);
	return { diagnostics, getStats };
}

afterEach(() => {
	jest.useRealTimers();
	sessionStorage.clear();
});

describe("local voice diagnostics", () => {
	test("only samples joined peers after opting in and on the five-second interval", async () => {
		jest.useFakeTimers();
		const { diagnostics, getStats } = fixture();
		try {
			diagnostics.setMembership(roomId, memberId, "voice-join");
			jest.advanceTimersByTime(15_000);
			await diagnostics.sampleNow();
			expect(getStats).not.toHaveBeenCalled();
			expect(diagnostics.exportJson()).toBeNull();
			diagnostics.setMembership(null, null);
			diagnostics.setConsent(true);
			jest.advanceTimersByTime(15_000);
			expect(getStats).not.toHaveBeenCalled();
			diagnostics.setMembership(roomId, memberId, "voice-join");
			jest.advanceTimersByTime(4_999);
			expect(getStats).not.toHaveBeenCalled();
			jest.advanceTimersByTime(1);
			expect(getStats).toHaveBeenCalledTimes(1);
		} finally {
			diagnostics.close();
		}
	});

	test("exports sanitized peer sample deltas under the member who produced them", async () => {
		const { diagnostics, getStats } = fixture();
		try {
			diagnostics.setConsent(true);
			diagnostics.setMembership(roomId, memberId, "voice-join");
			await diagnostics.sampleNow();
			getStats.mockResolvedValue(
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
			diagnostics.recordEvent("ws-close", 1006);
			diagnostics.setMembership(null, null);
			diagnostics.setMembership(roomId, otherMemberId, "voice-rejoin");
			await diagnostics.sampleNow();
			diagnostics.setMembership(null, null);
			const report = exported(diagnostics);
			expect(report.schemaVersion).toBe(1);
			expect(report.samples).toHaveLength(3);
			expect(report.samples[0]).toMatchObject({
				roomId,
				memberId,
				peerMemberId,
				packetsReceivedDelta: 0,
				rttMs: 25,
				jitterMs: 12,
				remoteRms: 0.025,
				remoteTrackReadyState: "live",
				localCandidateType: "host",
				localCandidateProtocol: "udp",
				remoteCandidateType: "srflx",
				remoteCandidateProtocol: "tcp",
			});
			expect(report.samples[1]).toMatchObject({
				memberId,
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
			expect(report.samples[2]).toMatchObject({
				memberId: otherMemberId,
				packetsReceivedDelta: 0,
			});
			expect(report.events).toMatchObject([
				{ kind: "voice-join", memberId },
				{ kind: "ws-close", memberId, state: 1006 },
				{ kind: "voice-rejoin", memberId: otherMemberId },
			]);
			expect(diagnostics.exportJson()).not.toMatch(
				/192\.168\.1\.20|203\.0\.113\.8|address-id|invalid-candidate|sctp|microphone label|sdp|deviceId|deviceLabel|fingerprint|characterName|reason/i,
			);
		} finally {
			diagnostics.close();
		}
	});

	test("stopping and replacing membership discard pending samples without blocking the next member", async () => {
		jest.useFakeTimers();
		const { diagnostics, getStats } = fixture();
		try {
			diagnostics.setConsent(true);
			diagnostics.setMembership(roomId, memberId, "voice-join");
			await diagnostics.sampleNow();
			const stopped = Promise.withResolvers<RTCStatsReport>();
			getStats.mockReturnValueOnce(stopped.promise);
			const pendingStop = diagnostics.sampleNow();
			diagnostics.setConsent(false);
			diagnostics.recordEvent("device-changed", "changed");
			jest.advanceTimersByTime(10_000);
			await diagnostics.sampleNow();
			expect(getStats).toHaveBeenCalledTimes(2);
			expect(exported(diagnostics).events).toHaveLength(1);
			diagnostics.setConsent(true);
			const replaced = Promise.withResolvers<RTCStatsReport>();
			getStats.mockReturnValueOnce(replaced.promise);
			const pendingReplace = diagnostics.sampleNow();
			diagnostics.setMembership(roomId, otherMemberId, "voice-rejoin");
			await diagnostics.sampleNow();
			stopped.resolve(cumulative({ received: 999 }));
			replaced.resolve(cumulative({ received: 999 }));
			await Promise.all([pendingStop, pendingReplace]);
			expect(exported(diagnostics).samples).toMatchObject([
				{ memberId, packetsReceivedDelta: 0 },
				{ memberId: otherMemberId, packetsReceivedDelta: 0 },
			]);
		} finally {
			diagnostics.close();
		}
	});

	test("bounds replayed logs, reloads them with collection off, and clears them on a session change", async () => {
		const { diagnostics } = fixture();
		diagnostics.setConsent(true);
		diagnostics.setMembership(roomId, memberId, "voice-join");
		for (let index = 0; index < 245; index += 1) {
			await diagnostics.sampleNow();
			diagnostics.recordEvent("ws-close", 1000 + index);
		}
		const report = exported(diagnostics);
		expect(report.samples).toHaveLength(240);
		expect(report.samples[0].at).toBe("2026-11-20T08:00:00.011Z");
		expect(report.events).toHaveLength(128);
		expect(report.events[0].state).toBe(1117);
		diagnostics.close();
		const { diagnostics: reloaded, getStats } = fixture();
		try {
			expect(reloaded.exportJson()).toBe(diagnostics.exportJson());
			reloaded.setMembership(roomId, memberId, "voice-join");
			await reloaded.sampleNow();
			expect(getStats).not.toHaveBeenCalled();
			reloaded.setConsent(true);
			reloaded.setSessionId(otherSessionId);
			expect(reloaded.exportJson()).toBeNull();
			reloaded.setSessionId(sessionId);
			expect(reloaded.exportJson()).toBeNull();
		} finally {
			reloaded.close();
		}
	});
});
