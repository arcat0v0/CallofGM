import { z } from "zod";

const isoDateTime = z.iso.datetime({ offset: true });
const roomId = z.string().uuid();
const memberId = z.string().uuid();
const nullableMetric = z.number().finite().nonnegative().nullable();
const delta = z.number().int().nonnegative();
const candidateType = z
	.enum(["host", "srflx", "prflx", "relay", "unknown"])
	.nullable();
const candidateProtocol = z.enum(["udp", "tcp", "unknown"]).nullable();

export const VoiceDiagnosticsConsent = z.strictObject({
	roomId,
	memberId,
	consentVersion: z.literal(1),
	acceptedAt: isoDateTime,
});
export type VoiceDiagnosticsConsent = z.infer<typeof VoiceDiagnosticsConsent>;

export const VoiceDiagnosticsSample = z.strictObject({
	at: isoDateTime,
	peerMemberId: memberId,
	rttMs: nullableMetric,
	jitterMs: nullableMetric,
	availableOutgoingBitrate: nullableMetric,
	packetsReceivedDelta: delta,
	packetsLostDelta: delta,
	packetsSentDelta: delta,
	bytesReceivedDelta: delta,
	bytesSentDelta: delta,
	concealmentEventsDelta: delta,
	concealedSamplesDelta: delta,
	localCandidateType: candidateType,
	localCandidateProtocol: candidateProtocol,
	remoteCandidateType: candidateType,
	remoteCandidateProtocol: candidateProtocol,
	connectionState: z.enum([
		"new",
		"connecting",
		"connected",
		"disconnected",
		"failed",
		"closed",
	]),
	iceConnectionState: z.enum([
		"new",
		"checking",
		"connected",
		"completed",
		"failed",
		"disconnected",
		"closed",
	]),
	signalingState: z.enum([
		"stable",
		"have-local-offer",
		"have-remote-offer",
		"have-local-pranswer",
		"have-remote-pranswer",
		"closed",
	]),
	remoteTrackMuted: z.boolean(),
	remoteTrackEnabled: z.boolean(),
	remoteTrackReadyState: z.enum(["live", "ended"]).nullable(),
	remoteRms: z.number().finite().nullable(),
	localMicState: z.enum(["off", "requesting", "on", "denied", "unavailable"]),
	audioProcessing: z.enum(["idle", "starting", "native", "rnnoise", "fallback"]),
});
export type VoiceDiagnosticsSample = z.infer<typeof VoiceDiagnosticsSample>;

export const VoiceDiagnosticsEvent = z.strictObject({
	at: isoDateTime,
	kind: z.enum([
		"peer-state",
		"ice-restart",
		"ws-open",
		"ws-close",
		"voice-join",
		"voice-rejoin",
		"mic-state",
		"processing-fallback",
		"device-changed",
	]),
	peerMemberId: memberId.nullable(),
	state: z.string().max(64).nullable(),
	previousState: z.string().max(64).nullable(),
});
export type VoiceDiagnosticsEvent = z.infer<typeof VoiceDiagnosticsEvent>;

export const VoiceDiagnosticsBatch = z.strictObject({
	schemaVersion: z.literal(1),
	consent: VoiceDiagnosticsConsent,
	samples: z.array(VoiceDiagnosticsSample).max(256),
	events: z.array(VoiceDiagnosticsEvent).max(256),
});
export type VoiceDiagnosticsBatch = z.infer<typeof VoiceDiagnosticsBatch>;

export const VoiceDiagnosticsRevoke = z.strictObject({ roomId, memberId });
export type VoiceDiagnosticsRevoke = z.infer<typeof VoiceDiagnosticsRevoke>;

export const VoiceDiagnosticsMutationResponse = z.strictObject({
	ok: z.literal(true),
});
export type VoiceDiagnosticsMutationResponse = z.infer<
	typeof VoiceDiagnosticsMutationResponse
>;

export const VoiceDiagnosticsReport = z.strictObject({
	id: z.string().uuid(),
	schemaVersion: z.literal(1),
	roomId,
	memberId,
	consentVersion: z.literal(1),
	consentAcceptedAt: isoDateTime,
	receivedAt: isoDateTime,
	samples: z.array(VoiceDiagnosticsSample).max(256),
	events: z.array(VoiceDiagnosticsEvent).max(256),
});
export type VoiceDiagnosticsReport = z.infer<typeof VoiceDiagnosticsReport>;

export const VoiceDiagnosticsReportsResponse = z.strictObject({
	reports: z.array(VoiceDiagnosticsReport),
});
export type VoiceDiagnosticsReportsResponse = z.infer<
	typeof VoiceDiagnosticsReportsResponse
>;

export const VoiceDiagnosticsReportsQuery = z.strictObject({
	limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type VoiceDiagnosticsReportsQuery = z.infer<
	typeof VoiceDiagnosticsReportsQuery
>;
