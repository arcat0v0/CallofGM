import { afterEach, describe, expect, mock, test } from "bun:test";
import type { VoiceSignal } from "@cogm/shared";
import { VoicePeer } from "@/features/voice/voice-peer";

let created: PeerConnection | undefined;
let peer: VoicePeer | undefined;
const nativeConnection = globalThis.RTCPeerConnection;
const audioSdp = (fragment: string) =>
	`v=0\r\na=ice-ufrag:${fragment}\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n`;

class PeerConnection {
	connectionState = "new";
	signalingState = "stable";
	localDescription: RTCSessionDescriptionInit | null = null;
	remoteDescription: RTCSessionDescriptionInit | null = null;
	onnegotiationneeded?: () => void;
	ontrack?: (event: { track: MediaStreamTrack }) => void;
	private readonly transceiver = {
		sender: { replaceTrack: mock(async () => {}) },
		receiver: { track: { kind: "audio" } },
		direction: "sendrecv",
		mid: "0",
	};

	constructor() {
		created = this;
	}

	addTransceiver = () => this.transceiver;
	getTransceivers = () => [this.transceiver];
	setLocalDescription = mock(async () => {
		const offer = this.signalingState === "stable";
		this.signalingState = offer ? "have-local-offer" : "stable";
		this.localDescription = {
			type: offer ? "offer" : "answer",
			sdp: audioSdp("local"),
		};
	});
	setRemoteDescription = mock(
		async (description: RTCSessionDescriptionInit) => {
			this.remoteDescription = description;
			this.signalingState =
				description.type === "offer" ? "have-remote-offer" : "stable";
		},
	);
	addIceCandidate = mock(async (_candidate: RTCIceCandidateInit) => {});
	close = mock(() => {});
	restartIce = mock(() => {});
}

function fixture(initiator: boolean) {
	globalThis.RTCPeerConnection =
		PeerConnection as unknown as typeof RTCPeerConnection;
	const send = mock((_signal: VoiceSignal) => {});
	const subject = new VoicePeer({
		initiator,
		iceServers: [],
		send,
		changed: () => {},
	});
	peer = subject;
	if (!created) throw new Error("missing peer connection");
	return { subject, connection: created, send };
}

function description(type: "offer" | "answer", fragment: string): VoiceSignal {
	return {
		kind: "description",
		description: { type, sdp: audioSdp(fragment) },
	};
}

function candidate(fragment: string): VoiceSignal {
	return {
		kind: "candidate",
		candidate: {
			candidate: `candidate-${fragment}`,
			usernameFragment: fragment,
		},
	};
}

afterEach(() => {
	peer?.close();
	globalThis.RTCPeerConnection = nativeConnection;
	created = undefined;
	peer = undefined;
});

describe("voice peer", () => {
	test("holds early ICE until its audio offer and discards rejected extra media sections", async () => {
		const { subject, connection, send } = fixture(false);
		void subject.accept(candidate("remote"));
		await subject.accept({
			kind: "description",
			description: {
				type: "offer",
				sdp: `${audioSdp("remote")}m=video 9 UDP/TLS/RTP/SAVPF 96\r\n`,
			},
		});
		expect(connection.setRemoteDescription).not.toHaveBeenCalled();
		expect(connection.addIceCandidate).not.toHaveBeenCalled();
		await subject.accept(description("offer", "remote"));
		expect(connection.addIceCandidate).toHaveBeenCalledWith({
			candidate: "candidate-remote",
			usernameFragment: "remote",
		});
		expect(send).toHaveBeenCalledWith(description("answer", "local"));
	});

	test("the designated offerer ignores glare and candidates from the rejected offer", async () => {
		const { subject, connection, send } = fixture(true);
		connection.onnegotiationneeded?.();
		void subject.accept(description("offer", "glare"));
		void subject.accept(candidate("glare"));
		await subject.accept(description("answer", "accepted"));
		expect(send).toHaveBeenCalledWith(description("offer", "local"));
		expect(connection.setRemoteDescription.mock.calls).toEqual([
			[{ type: "answer", sdp: audioSdp("accepted") }],
		]);
		expect(connection.addIceCandidate).not.toHaveBeenCalled();
	});

	test("late tracks remain muted before authority and are destroyed with the peer", () => {
		const { subject, connection } = fixture(false);
		const stop = mock(() => {});
		const track = { kind: "audio", enabled: true, stop };
		connection.ontrack?.({ track: track as unknown as MediaStreamTrack });
		const output = document.querySelector("audio");
		expect(output?.muted).toBe(true);
		expect(track.enabled).toBe(false);
		subject.close();
		expect(stop).toHaveBeenCalledTimes(1);
		expect(output?.srcObject).toBeNull();
		expect(document.querySelector("audio")).toBeNull();
	});
});
