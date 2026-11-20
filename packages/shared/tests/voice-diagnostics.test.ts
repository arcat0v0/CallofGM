import { describe, expect, test } from "bun:test";
import {
	VoiceDiagnosticsBatch,
	VoiceDiagnosticsEvent,
	VoiceDiagnosticsSample,
} from "../src";

const roomId = crypto.randomUUID();
const memberId = crypto.randomUUID();
const peerMemberId = crypto.randomUUID();
const acceptedAt = "2026-11-20T12:00:00.000Z";

function sample() {
	return {
		at: acceptedAt,
		peerMemberId,
		rttMs: 42.5,
		jitterMs: 1.25,
		availableOutgoingBitrate: 32_000,
		packetsReceivedDelta: 20,
		packetsLostDelta: 1,
		packetsSentDelta: 21,
		bytesReceivedDelta: 2_000,
		bytesSentDelta: 2_100,
		concealmentEventsDelta: 0,
		concealedSamplesDelta: 0,
		localCandidateType: "host",
		localCandidateProtocol: "udp",
		remoteCandidateType: "relay",
		remoteCandidateProtocol: "tcp",
		connectionState: "connected",
		iceConnectionState: "completed",
		signalingState: "stable",
		remoteTrackMuted: false,
		remoteTrackEnabled: true,
		remoteTrackReadyState: "live",
		remoteRms: 0.02,
		localMicState: "on",
		audioProcessing: "rnnoise",
	};
}

function batch() {
	return {
		schemaVersion: 1,
		consent: { roomId, memberId, consentVersion: 1, acceptedAt },
		samples: [sample()],
		events: [
			{
				at: acceptedAt,
				kind: "peer-state",
				peerMemberId,
				state: "connected",
				previousState: "connecting",
			},
		],
	};
}

describe("voice diagnostics contracts", () => {
	test("accepts the minimized RTC metrics and events", () => {
		expect(VoiceDiagnosticsBatch.parse(batch())).toEqual(batch());
		expect(
			VoiceDiagnosticsSample.parse({
				...sample(),
				rttMs: null,
				jitterMs: null,
				availableOutgoingBitrate: null,
				localCandidateType: "unknown",
				localCandidateProtocol: "unknown",
				remoteCandidateType: null,
				remoteCandidateProtocol: null,
				remoteTrackReadyState: null,
				remoteRms: null,
				localMicState: "denied",
				audioProcessing: "fallback",
			}),
		).toMatchObject({ rttMs: null, remoteTrackReadyState: null });
	});

	test("rejects additional fields at every level", () => {
		expect(
			VoiceDiagnosticsBatch.safeParse({ ...batch(), audio: "not allowed" })
				.success,
		).toBe(false);
		expect(
			VoiceDiagnosticsBatch.safeParse({
				...batch(),
				consent: { ...batch().consent, accountId: crypto.randomUUID() },
			}).success,
		).toBe(false);
		expect(
			VoiceDiagnosticsSample.safeParse({ ...sample(), deviceId: "microphone" })
				.success,
		).toBe(false);
		expect(
			VoiceDiagnosticsEvent.safeParse({
				...batch().events[0],
				sdp: "v=0",
			}).success,
		).toBe(false);
	});

	test("rejects invalid metrics, identifiers, timestamps and enum values", () => {
		for (const patch of [
			{ rttMs: -1 },
			{ jitterMs: Number.POSITIVE_INFINITY },
			{ availableOutgoingBitrate: Number.NaN },
			{ packetsLostDelta: -1 },
			{ bytesSentDelta: 1.5 },
			{ peerMemberId: "member" },
			{ at: "yesterday" },
			{ localCandidateType: "192.0.2.1" },
			{ remoteCandidateProtocol: "sctp" },
			{ connectionState: "unknown" },
			{ remoteTrackReadyState: "paused" },
			{ localMicState: "muted" },
			{ audioProcessing: "custom" },
		]) {
			expect(VoiceDiagnosticsSample.safeParse({ ...sample(), ...patch }).success).toBe(false);
		}
		expect(
			VoiceDiagnosticsEvent.safeParse({
				...batch().events[0],
				kind: "join",
			}).success,
		).toBe(false);
	});

	test("rejects batches over capacity", () => {
		expect(
			VoiceDiagnosticsBatch.safeParse({
				...batch(),
				samples: Array.from({ length: 257 }, sample),
			}).success,
		).toBe(false);
		expect(
			VoiceDiagnosticsBatch.safeParse({
				...batch(),
				events: Array.from({ length: 257 }, () => batch().events[0]),
			}).success,
		).toBe(false);
	});
});
