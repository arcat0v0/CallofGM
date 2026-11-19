import { afterEach, describe, expect, jest, mock, test } from "bun:test";
import type { VoiceSignal } from "@cogm/shared";
import {
	applyOpusSenderParameters,
	configureOpusSdp,
	VOICE_MAX_BITRATE,
	VoicePeer,
} from "@/features/voice/voice-peer";

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
	onconnectionstatechange?: () => void;
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

function fixture(
	initiator: boolean,
	onRemoteTrack?: (track: MediaStreamTrack | null) => void,
) {
	globalThis.RTCPeerConnection =
		PeerConnection as unknown as typeof RTCPeerConnection;
	const send = mock((_signal: VoiceSignal) => {});
	const subject = new VoicePeer({
		initiator,
		iceServers: [],
		send,
		changed: () => {},
		onRemoteTrack,
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

	test("retries a later disconnect after an exhausted recovery cycle", () => {
		jest.useFakeTimers();
		try {
			const { subject, connection } = fixture(true);
			connection.connectionState = "disconnected";
			connection.onconnectionstatechange?.();
			jest.advanceTimersByTime(4_000);
			jest.advanceTimersByTime(15_000);
			jest.advanceTimersByTime(15_000);
			expect(connection.restartIce).toHaveBeenCalledTimes(2);
			expect(subject.health).toBe("failed");
			connection.onconnectionstatechange?.();
			jest.advanceTimersByTime(4_000);
			expect(connection.restartIce).toHaveBeenCalledTimes(3);
			expect(subject.health).toBe("connecting");
		} finally {
			jest.useRealTimers();
		}
	});

	test("applies per-speaker volume before and after track attachment and notifies remote track lifecycle", () => {
		const trackEvents: Array<MediaStreamTrack | null> = [];
		const { subject, connection } = fixture(false, (track) => {
			trackEvents.push(track);
		});
		subject.setVolume(35);
		const track = { kind: "audio", enabled: true, stop: mock(() => {}) };
		connection.ontrack?.({ track: track as unknown as MediaStreamTrack });
		const output = document.querySelector("audio");
		expect(output?.volume).toBeCloseTo(0.35, 2);
		expect(trackEvents).toEqual([track as unknown as MediaStreamTrack]);
		subject.setVolume(140);
		expect(output?.volume).toBe(1);
		subject.setVolume(-10);
		expect(output?.volume).toBe(0);
		subject.close();
		expect(trackEvents).toEqual([track as unknown as MediaStreamTrack, null]);
	});
});

describe("Opus voice configuration", () => {
	test("applies bitrate and standard DTX only when the encoding supports it", async () => {
		const parameters = {
			codecs: [],
			headerExtensions: [],
			rtcp: {},
			encodings: [{ maxBitrate: 64_000, dtx: "disabled" }],
		} as unknown as RTCRtpSendParameters;
		const sender = {
			getParameters: mock(() => parameters),
			setParameters: mock(async (next: RTCRtpSendParameters) => {
				Object.assign(parameters, next);
			}),
		} as unknown as RTCRtpSender;
		const result = await applyOpusSenderParameters(sender);
		expect(parameters.encodings[0]?.maxBitrate).toBe(VOICE_MAX_BITRATE);
		expect(parameters.encodings[0]).toMatchObject({ dtx: "enabled" });
		expect(result.maxBitrate).toBe(true);
		expect(result.dtx).toBe(true);
	});

	test("keeps the negotiated connection when sender parameters are rejected", async () => {
		const sender = {
			getParameters: () => ({ encodings: [{}] }),
			setParameters: mock(async () => {
				throw new Error("unsupported");
			}),
		} as unknown as RTCRtpSender;
		await expect(applyOpusSenderParameters(sender)).resolves.toEqual({
			maxBitrate: false,
			dtx: false,
		});
	});

	test("updates only Opus fmtp and preserves audio media and ICE lines", () => {
		const sdp = [
			"v=0",
			"a=ice-ufrag:keep-me",
			"m=audio 9 UDP/TLS/RTP/SAVPF 111 96",
			"a=rtpmap:111 opus/48000/2",
			"a=fmtp:111 minptime=10;stereo=1",
			"a=rtpmap:96 telephone-event/8000",
			"a=fmtp:96 0-16",
			"",
		].join("\r\n");
		const configured = configureOpusSdp(sdp, { fec: true, dtx: true });
		expect(configured).toContain("a=ice-ufrag:keep-me");
		expect(configured).toContain("a=fmtp:96 0-16");
		expect(configured).toContain(`maxaveragebitrate=${VOICE_MAX_BITRATE}`);
		expect(configured).toContain("useinbandfec=1");
		expect(configured).toContain("usedtx=1");
		expect(configured).toContain("stereo=0");
		expect(configured).not.toContain("stereo=1");
		const withoutFec = configureOpusSdp(sdp, { fec: false, dtx: false });
		expect(withoutFec).not.toContain("useinbandfec=1");
		expect(withoutFec).not.toContain("usedtx=1");
	});
});
