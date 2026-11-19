import { afterEach, describe, expect, mock, test } from "bun:test";
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
const roomId = "00000000-0000-4000-8000-000000000010";
const remote: VoiceMember = {
	...self,
	id: "00000000-0000-4000-8000-000000000002",
	name: "GM",
	role: "gm",
};

function fakeTrack() {
	return {
		kind: "audio",
		enabled: true,
		stop: mock(() => {}),
		addEventListener: mock(() => {}),
		removeEventListener: mock(() => {}),
		getSettings: () => ({
			echoCancellation: true,
			noiseSuppression: true,
			autoGainControl: true,
		}),
		applyConstraints: mock(async () => {}),
	};
}

function fixture(failDeviceSwitch = false) {
	const track = fakeTrack();
	const stream = {
		getTracks: () => [track],
		getAudioTracks: () => [track],
	} as unknown as MediaStream;
	const peer = {
		setTrack: mock((_track: MediaStreamTrack | null) => {}),
		setAudible: mock(() => {}),
		setVolume: mock(() => {}),
		retryPlayback: mock(() => {}),
		close: mock(() => {}),
	};
	const controller = new VoiceController({
		capture: async ({ audio }) => {
			if (failDeviceSwitch && typeof audio === "object" && audio.deviceId) {
				throw new DOMException("Device disappeared", "NotFoundError");
			}
			return stream;
		},
		createPeer: () => peer as unknown as VoicePeer,
		createMonitor: () => ({
			setTrack: () => {},
			setAllowed: () => {},
			resume: () => {},
			clear: () => {},
			close: () => {},
		}),
		createMicTester: () => ({
			start: () => {},
			setLoopback: () => {},
			stop: () => {},
		}),
	});
	const sent: VoiceClientMessage[] = [];
	controller.connect((message) => {
		sent.push(message);
		return true;
	});
	const base: VoiceState = {
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
	const state = (payload: VoiceState) =>
		controller.receive({ protocolVersion: 1, type: "voice:state", payload });
	state(base);
	controller.join();
	state({ ...base, selfId: self.id, members: [self, remote], memberCount: 2 });
	return { controller, track, peer, state, base };
}

afterEach(() => {
	localStorage.clear();
});

describe("voice enhancement controller", () => {
	test("a failed device change restores the selection without rejecting", async () => {
		const { controller, track, peer } = fixture(true);
		await controller.toggleMic();
		await controller.updateAudioSettings({ deviceId: "missing" });
		expect(controller.getSnapshot().audioSettings.deviceId).toBe("default");
		expect(controller.getSnapshot().mic).toBe("on");
		expect(peer.setTrack).toHaveBeenLastCalledWith(track);
		controller.disconnect(false);
	});

	test("PTT ignores interactive controls and consumed keydowns and releases on keyup and blur", async () => {
		const { controller, track, peer } = fixture();
		await controller.updateAudioSettings({
			pushToTalk: true,
			pushToTalkKey: "KeyV",
		});
		await controller.toggleMic();
		expect(controller.getSnapshot().pushToTalkActive).toBe(false);
		expect(track.enabled).toBe(false);
		window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyV" }));
		expect(controller.getSnapshot().pushToTalkActive).toBe(true);
		expect(track.enabled).toBe(true);
		window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyV" }));
		expect(controller.getSnapshot().pushToTalkActive).toBe(false);
		expect(track.enabled).toBe(false);
		window.dispatchEvent(
			new KeyboardEvent("keydown", { code: "KeyV", repeat: true }),
		);
		expect(controller.getSnapshot().pushToTalkActive).toBe(false);
		for (const [tag, role] of [
			["input", ""],
			["button", "combobox"],
			["div", "option"],
		]) {
			const control = document.createElement(tag ?? "div");
			if (role) control.setAttribute("role", role);
			document.body.append(control);
			control.dispatchEvent(
				new KeyboardEvent("keydown", { code: "KeyV", bubbles: true }),
			);
			control.remove();
			expect(controller.getSnapshot().pushToTalkActive).toBe(false);
		}
		const consumed = new KeyboardEvent("keydown", {
			code: "KeyV",
			cancelable: true,
		});
		consumed.preventDefault();
		window.dispatchEvent(consumed);
		expect(controller.getSnapshot().pushToTalkActive).toBe(false);
		window.dispatchEvent(
			new KeyboardEvent("keydown", { code: "KeyV", ctrlKey: true }),
		);
		expect(controller.getSnapshot().pushToTalkActive).toBe(false);
		window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyV" }));
		expect(controller.getSnapshot().pushToTalkActive).toBe(true);
		expect(track.enabled).toBe(true);
		window.dispatchEvent(new Event("blur"));
		expect(controller.getSnapshot().pushToTalkActive).toBe(false);
		expect(track.enabled).toBe(false);
		expect(peer.setTrack).toHaveBeenCalledWith(
			track as unknown as MediaStreamTrack,
		);
		controller.disconnect(false);
	});

	test("authoritative mute, leave and disconnect immediately override active PTT", async () => {
		for (const action of ["mute", "leave", "disconnect"] as const) {
			const { controller, track, peer, state, base } = fixture();
			await controller.updateAudioSettings({ pushToTalk: true });
			await controller.toggleMic();
			expect(controller.getSnapshot().pushToTalkActive).toBe(false);
			expect(track.enabled).toBe(false);
			controller.setPushToTalkActive(true);
			if (action === "mute") {
				state({
					...base,
					selfId: self.id,
					members: [{ ...self, canSpeak: false, muted: true }],
				});
			} else if (action === "leave") {
				controller.leave();
			} else {
				controller.disconnect(true);
			}
			expect(controller.getSnapshot().pushToTalkActive).toBe(false);
			expect(controller.getSnapshot().mic).toBe("off");
			expect(peer.setTrack).toHaveBeenLastCalledWith(null);
			expect(track.stop).toHaveBeenCalled();
			controller.disconnect(false);
		}
	});

	test("enabling PTT gates an already open mic and disabling restores sending", async () => {
		const { controller, track } = fixture();
		await controller.toggleMic();
		expect(track.enabled).toBe(true);
		await controller.updateAudioSettings({ pushToTalk: true });
		expect(track.enabled).toBe(false);
		expect(controller.getSnapshot().pushToTalkActive).toBe(false);
		controller.setPushToTalkActive(true);
		expect(track.enabled).toBe(true);
		await controller.updateAudioSettings({ pushToTalk: false });
		expect(track.enabled).toBe(true);
		expect(controller.getSnapshot().pushToTalkActive).toBe(false);
		controller.disconnect(false);
	});

	test("refreshes labels and stops capture when the selected device disappears", async () => {
		const descriptor = Object.getOwnPropertyDescriptor(
			navigator,
			"mediaDevices",
		);
		let devices = [{ deviceId: "mic-a", kind: "audioinput", label: "" }];
		Object.defineProperty(navigator, "mediaDevices", {
			configurable: true,
			value: {
				enumerateDevices: mock(async () => devices as MediaDeviceInfo[]),
				addEventListener: () => {},
				removeEventListener: () => {},
				getSupportedConstraints: () => ({}),
			},
		});
		try {
			const { controller, track, peer } = fixture();
			await controller.updateAudioSettings({ deviceId: "mic-a" });
			await controller.toggleMic();
			devices = [
				{ deviceId: "mic-a", kind: "audioinput", label: "Microphone A" },
			];
			await controller.refreshAudioDevices();
			expect(controller.getSnapshot().audioDevices).toContainEqual({
				deviceId: "mic-a",
				label: "Microphone A",
			});
			devices = [{ deviceId: "other", kind: "audioinput", label: "Other" }];
			await controller.refreshAudioDevices();
			expect(controller.getSnapshot().mic).toBe("unavailable");
			expect(controller.getSnapshot().pushToTalkActive).toBe(false);
			expect(peer.setTrack).toHaveBeenLastCalledWith(null);
			expect(track.stop).toHaveBeenCalled();
			controller.disconnect(false);
		} finally {
			if (descriptor)
				Object.defineProperty(navigator, "mediaDevices", descriptor);
			else Reflect.deleteProperty(navigator, "mediaDevices");
		}
	});
});
