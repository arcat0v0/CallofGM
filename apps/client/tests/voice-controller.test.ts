import { describe, expect, mock, test } from "bun:test";
import type { VoiceClientMessage, VoiceMember, VoiceState } from "@cogm/shared";
import { VoiceController } from "@/features/voice/voice-controller";
import type { VoicePeer } from "@/features/voice/voice-peer";

const self: VoiceMember = {
	id: "00000000-0000-4000-8000-000000000001",
	name: "PC",
	role: "pc",
	canSpeak: true,
	speakGranted: false,
	muted: false,
};
const remote: VoiceMember = {
	...self,
	id: "00000000-0000-4000-8000-000000000002",
	name: "GM",
	role: "gm",
};
const roomId = "00000000-0000-4000-8000-000000000010";
const waiting: VoiceState = {
	enabled: true,
	available: true,
	limit: 8,
	maxLimit: 16,
	selfId: null,
	members: [],
	memberCount: 1,
	iceServers: [],
	roomId,
	canManage: false,
};
const joined: VoiceState = {
	...waiting,
	selfId: self.id,
	members: [self, remote],
	memberCount: 2,
};

function fixture(capture?: () => Promise<MediaStream>) {
	const sent: VoiceClientMessage[] = [];
	const peer = {
		setTrack: mock((_track: MediaStreamTrack | null) => {}),
		setAudible: mock((_audible: boolean) => {}),
		retryPlayback: mock(() => {}),
		close: mock(() => {}),
		accept: mock(() => {}),
	};
	const createPeer = mock(() => peer as unknown as VoicePeer);
	const controller = new VoiceController({ capture, createPeer });
	const connect = () =>
		controller.connect((message) => {
			sent.push(message);
			return true;
		});
	const state = (payload: VoiceState) =>
		controller.receive({ protocolVersion: 1, type: "voice:state", payload });
	const join = () => {
		state(waiting);
		controller.join();
		state(joined);
	};
	connect();
	return { controller, connect, state, join, sent, peer, createPeer };
}

describe("voice membership and media lifetime", () => {
	test("joins without capture and re-enters the same room once after a fresh state", () => {
		const capture = mock(async () => new MediaStream());
		const { controller, connect, sent, state, join, peer } = fixture(capture);
		join();
		expect(capture).not.toHaveBeenCalled();
		controller.disconnect(true);
		controller.disconnect(true);
		expect(peer.close).toHaveBeenCalledTimes(1);
		connect();
		expect(sent).toHaveLength(1);
		state(waiting);
		state(waiting);
		expect(sent.map((message) => message.type)).toEqual([
			"voice:join",
			"voice:join",
		]);
		controller.disconnect(false);
	});

	test("does not re-enter after explicit leave, terminal loss or a new room generation", () => {
		for (const loss of ["leave", "terminal", "newRoom"] as const) {
			const { controller, connect, sent, state, join } = fixture();
			join();
			if (loss === "leave") controller.leave();
			controller.disconnect(loss !== "terminal");
			connect();
			state(
				loss === "newRoom"
					? { ...waiting, roomId: "00000000-0000-4000-8000-000000000011" }
					: waiting,
			);
			expect(
				sent.filter((message) => message.type === "voice:join"),
			).toHaveLength(1);
			controller.disconnect(false);
		}
	});

	test("stops capture that completes after forced mute and never resumes it on restoration", async () => {
		const stop = mock(() => {});
		const deferred = Promise.withResolvers<MediaStream>();
		const { controller, peer, join, state } = fixture(() => deferred.promise);
		join();
		const capture = controller.toggleMic();
		state({
			...joined,
			members: [{ ...self, canSpeak: false, muted: true }, remote],
		});
		state(joined);
		deferred.resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream);
		await capture;
		expect(stop).toHaveBeenCalledTimes(1);
		expect(peer.setTrack.mock.calls).toEqual([[null]]);
		expect(controller.getSnapshot().mic).toBe("off");
		controller.disconnect(false);
	});

	test("keeps listening when microphone permission is denied", async () => {
		const { controller, peer, join } = fixture(async () => {
			throw new DOMException("denied", "NotAllowedError");
		});
		join();
		await controller.toggleMic();
		expect(controller.getSnapshot().mic).toBe("denied");
		expect(controller.getSnapshot().state?.selfId).toBe(self.id);
		expect(peer.close).not.toHaveBeenCalled();
		controller.disconnect(false);
	});

	test("gates remote playback from authoritative state and discards old signals", () => {
		const { controller, peer, state, join } = fixture();
		join();
		state({ ...joined, members: [self, { ...remote, canSpeak: false }] });
		expect(peer.setAudible).toHaveBeenLastCalledWith(false);
		controller.togglePlayback();
		controller.togglePlayback();
		expect(peer.setAudible).toHaveBeenLastCalledWith(false);
		state({ ...joined, members: [self], memberCount: 1 });
		expect(peer.close).toHaveBeenCalledTimes(1);
		controller.receive({
			protocolVersion: 1,
			type: "voice:signal",
			payload: {
				fromMemberId: remote.id,
				signal: {
					kind: "description",
					description: { type: "offer", sdp: "v=0" },
				},
			},
		});
		expect(peer.accept).not.toHaveBeenCalled();
		controller.disconnect(false);
	});
});
