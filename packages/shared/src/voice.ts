import { z } from "zod";

export const voiceProtocolVersion = 1 as const;

const requestId = z.string().min(1).max(128);
const memberId = z.string().uuid();
const roomId = z.string().uuid();

export const VoiceDescription = z.strictObject({
	type: z.enum(["offer", "answer"]),
	sdp: z.string().min(1).max(65_536),
});
export type VoiceDescription = z.infer<typeof VoiceDescription>;

export const VoiceCandidate = z.strictObject({
	candidate: z.string().min(1).max(8_192),
	sdpMid: z.string().max(256).nullable().optional(),
	sdpMLineIndex: z.number().int().min(0).max(65_535).nullable().optional(),
	usernameFragment: z.string().max(256).nullable().optional(),
});
export type VoiceCandidate = z.infer<typeof VoiceCandidate>;

export const VoiceSignal = z.discriminatedUnion("kind", [
	z.strictObject({
		kind: z.literal("description"),
		description: VoiceDescription,
	}),
	z.strictObject({ kind: z.literal("candidate"), candidate: VoiceCandidate }),
]);
export type VoiceSignal = z.infer<typeof VoiceSignal>;

export const VoiceMember = z.strictObject({
	id: memberId,
	name: z.string().min(1).max(120),
	role: z.enum(["gm", "pc", "ob"]),
	canSpeak: z.boolean(),
	speakGranted: z.boolean(),
	muted: z.boolean(),
});
export type VoiceMember = z.infer<typeof VoiceMember>;

export const VoiceIceServer = z.strictObject({
	urls: z.array(z.string().min(1).max(2_048)).min(1).max(16),
	username: z.string().min(1).max(512).optional(),
	credential: z.string().min(1).max(2_048).optional(),
});
export type VoiceIceServer = z.infer<typeof VoiceIceServer>;

export const VoiceState = z.strictObject({
	enabled: z.boolean(),
	available: z.boolean(),
	limit: z.number().int().min(2).max(256),
	maxLimit: z.number().int().min(2).max(256),
	selfId: memberId.nullable(),
	members: z.array(VoiceMember).max(256),
	memberCount: z.number().int().min(0).max(256),
	iceServers: z.array(VoiceIceServer).max(32),
	roomId: roomId.nullable(),
	canManage: z.boolean(),
});
export type VoiceState = z.infer<typeof VoiceState>;

const emptyPayload = z.strictObject({});
const voiceClientEnvelope = <const Kind extends string, T extends z.ZodType>(
	type: Kind,
	payload: T,
) =>
	z.strictObject({
		protocolVersion: z.literal(voiceProtocolVersion),
		requestId,
		type: z.literal(type),
		payload,
	});

export const VoiceClientMessage = z.discriminatedUnion("type", [
	voiceClientEnvelope("voice:join", z.strictObject({ roomId })),
	voiceClientEnvelope("voice:leave", emptyPayload),
	voiceClientEnvelope(
		"voice:configure",
		z.union([
			z.strictObject({ enabled: z.boolean() }),
			z.strictObject({ limit: z.number().int().min(2).max(256) }),
		]),
	),
	voiceClientEnvelope(
		"voice:moderate",
		z.union([
			z.strictObject({ memberId, speakGranted: z.boolean() }),
			z.strictObject({ memberId, muted: z.boolean() }),
		]),
	),
	voiceClientEnvelope(
		"voice:signal",
		z.strictObject({ toMemberId: memberId, signal: VoiceSignal }),
	),
]);
export type VoiceClientMessage = z.infer<typeof VoiceClientMessage>;

const voiceServerEnvelope = <const Kind extends string, T extends z.ZodType>(
	type: Kind,
	payload: T,
) =>
	z.strictObject({
		protocolVersion: z.literal(voiceProtocolVersion),
		type: z.literal(type),
		payload,
	});

export const VoiceServerMessage = z.discriminatedUnion("type", [
	voiceServerEnvelope("voice:state", VoiceState),
	voiceServerEnvelope(
		"voice:signal",
		z.strictObject({ fromMemberId: memberId, signal: VoiceSignal }),
	),
	voiceServerEnvelope(
		"voice:reply",
		z.union([
			z.strictObject({ requestId, ok: z.literal(true) }),
			z.strictObject({
				requestId,
				ok: z.literal(false),
				code: z.string().min(1).max(128),
			}),
		]),
	),
]);
export type VoiceServerMessage = z.infer<typeof VoiceServerMessage>;
