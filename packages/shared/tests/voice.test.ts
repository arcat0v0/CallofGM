import { describe, expect, test } from "bun:test";
import {
	VoiceClientMessage,
	VoiceServerMessage,
	voiceProtocolVersion,
} from "../src";

const roomId = crypto.randomUUID();
const memberId = crypto.randomUUID();

describe("voice protocol", () => {
	test("binds joins to an opening and preserves literal message types", () => {
		const message = VoiceClientMessage.parse({
			protocolVersion: voiceProtocolVersion,
			requestId: "join-1",
			type: "voice:join",
			payload: { roomId },
		});
		expect(message.type).toBe("voice:join");
		expect(message.payload.roomId).toBe(roomId);
	});

	test("rejects ambiguous controls and invalid identifiers", () => {
		expect(
			VoiceClientMessage.safeParse({
				protocolVersion: 1,
				requestId: "configure-1",
				type: "voice:configure",
				payload: { enabled: true, limit: 4 },
			}).success,
		).toBe(false);
		expect(
			VoiceClientMessage.safeParse({
				protocolVersion: 1,
				requestId: "",
				type: "voice:leave",
				payload: {},
			}).success,
		).toBe(false);
	});

	test("round-trips description and nullable ICE candidate shapes", () => {
		for (const signal of [
			{
				kind: "description",
				description: { type: "answer", sdp: "v=0\r\n" },
			},
			{
				kind: "candidate",
				candidate: {
					candidate: "candidate:1 1 UDP 1 192.0.2.1 9 typ host",
					sdpMid: null,
					sdpMLineIndex: null,
					usernameFragment: null,
				},
			},
		]) {
			const message = VoiceServerMessage.parse({
				protocolVersion: 1,
				type: "voice:signal",
				payload: { fromMemberId: memberId, signal },
			});
			expect(message.payload.signal).toEqual(signal);
		}
	});
});
