import { afterEach, describe, expect, mock, test } from "bun:test";
import type { VoiceClientMessage, VoiceMember, VoiceState } from "@cogm/shared";
import {
	computeRms,
	micTestLevelFromRms,
	VoiceActivityMonitor,
	VoiceMicTester,
} from "@/features/voice/voice-activity";
import {
	isVoiceMemberSpeaking,
	type VoiceActivityMonitorLike,
	VoiceController,
	type VoiceMicTesterLike,
} from "@/features/voice/voice-controller";
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

function fixture(capture?: () => Promise<MediaStream>, sessionId?: string) {
	const sent: VoiceClientMessage[] = [];
	const peer = {
		setTrack: mock((_track: MediaStreamTrack | null) => {}),
		setAudible: mock((_audible: boolean) => {}),
		setVolume: mock((_volume: number) => {}),
		retryPlayback: mock(() => {}),
		close: mock(() => {}),
		accept: mock(() => {}),
	};
	const createPeer = mock(() => peer as unknown as VoicePeer);
	let emitSpeaking: ((ids: string[]) => void) | null = null;
	let allowedIds = new Set<string>();
	const monitor: VoiceActivityMonitorLike = {
		setTrack: mock(() => {}),
		setAllowed: mock((allowed: ReadonlySet<string>) => {
			allowedIds = new Set(allowed);
		}),
		resume: mock(() => {}),
		clear: mock(() => {}),
		close: mock(() => {}),
	};
	let emitMicSample: ((level: number, detected: boolean) => void) | null = null;
	const micTester: VoiceMicTesterLike = {
		start: mock(() => {}),
		setLoopback: mock(() => {}),
		stop: mock(() => {}),
	};
	const controller = new VoiceController({
		sessionId,
		capture,
		createPeer,
		createMonitor: (onChange) => {
			emitSpeaking = onChange;
			return monitor;
		},
		createMicTester: (onSample) => {
			emitMicSample = onSample;
			return micTester;
		},
	});
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
	return {
		controller,
		connect,
		state,
		join,
		sent,
		peer,
		createPeer,
		monitor,
		micTester,
		emitSpeaking: (ids: string[]) => emitSpeaking?.(ids),
		emitMicSample: (level: number, detected: boolean) =>
			emitMicSample?.(level, detected),
		getAllowed: () => allowedIds,
	};
}

afterEach(() => {
	localStorage.clear();
	sessionStorage.clear();
});

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

	test("configures and marks mic unavailable safely on non-secure HTTP origins", async () => {
		const cryptoDescriptor = Object.getOwnPropertyDescriptor(
			globalThis,
			"crypto",
		);
		const mediaDescriptor = Object.getOwnPropertyDescriptor(
			navigator,
			"mediaDevices",
		);
		const nativeGetRandomValues = globalThis.crypto.getRandomValues.bind(
			globalThis.crypto,
		);
		Object.defineProperty(globalThis, "crypto", {
			value: { getRandomValues: nativeGetRandomValues },
			configurable: true,
			writable: true,
		});
		Object.defineProperty(navigator, "mediaDevices", {
			value: undefined,
			configurable: true,
			writable: true,
		});
		try {
			const { controller, sent, state, join } = fixture();
			state({ ...waiting, enabled: false, canManage: true });
			controller.configure({ enabled: true });
			expect(sent).toHaveLength(1);
			const first = sent[0];
			if (!first) throw new Error("Expected voice:configure command");
			expect(first.type).toBe("voice:configure");
			expect(first.requestId).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
			);
			controller.receive({
				protocolVersion: 1,
				type: "voice:reply",
				payload: { requestId: first.requestId, ok: true },
			});
			join();
			await controller.toggleMic();
			expect(controller.getSnapshot().mic).toBe("unavailable");
			controller.disconnect(false);
		} finally {
			if (cryptoDescriptor) {
				Object.defineProperty(globalThis, "crypto", cryptoDescriptor);
			}
			if (mediaDescriptor) {
				Object.defineProperty(navigator, "mediaDevices", mediaDescriptor);
			} else {
				delete (navigator as { mediaDevices?: unknown }).mediaDevices;
			}
		}
	});

	test("manages per-speaker volumes, mute memory, and reconnect restoration", () => {
		const { controller, peer, state, join } = fixture(undefined, "session-vol");
		join();
		expect(controller.getSnapshot().memberVolumes[remote.id]).toBe(100);
		expect(peer.setVolume).toHaveBeenLastCalledWith(100);

		controller.setMemberVolume(remote.id, 42);
		expect(controller.getSnapshot().memberVolumes[remote.id]).toBe(42);
		expect(peer.setVolume).toHaveBeenLastCalledWith(42);

		controller.toggleMemberMute(remote.id);
		expect(controller.getSnapshot().memberVolumes[remote.id]).toBe(0);
		expect(peer.setVolume).toHaveBeenLastCalledWith(0);

		controller.toggleMemberMute(remote.id);
		expect(controller.getSnapshot().memberVolumes[remote.id]).toBe(42);
		expect(peer.setVolume).toHaveBeenLastCalledWith(42);

		// Remote rejoins with a new ephemeral UUID while keeping the same role & name
		const rejoinedRemote: VoiceMember = {
			...remote,
			id: "00000000-0000-4000-8000-000000000099",
		};
		state({ ...joined, members: [self, rejoinedRemote] });
		expect(controller.getSnapshot().memberVolumes[rejoinedRemote.id]).toBe(42);
		expect(peer.setVolume).toHaveBeenLastCalledWith(42);
		controller.disconnect(false);
	});

	test("gates speaking indicators by authoritative state, mic state, and playback mute", () => {
		const { controller, state, join, emitSpeaking, getAllowed } = fixture();
		join();
		expect(getAllowed().has(remote.id)).toBe(true);
		expect(getAllowed().has(self.id)).toBe(false);

		emitSpeaking([remote.id, self.id]);
		expect(isVoiceMemberSpeaking(controller.getSnapshot(), remote)).toBe(true);
		expect(isVoiceMemberSpeaking(controller.getSnapshot(), self)).toBe(false);

		controller.togglePlayback();
		expect(getAllowed().has(remote.id)).toBe(false);
		expect(isVoiceMemberSpeaking(controller.getSnapshot(), remote)).toBe(false);

		controller.togglePlayback();
		const mutedRemote = { ...remote, canSpeak: false };
		state({ ...joined, members: [self, mutedRemote] });
		expect(getAllowed().has(remote.id)).toBe(false);
		expect(controller.getSnapshot().speakingIds).toEqual([]);
		expect(isVoiceMemberSpeaking(controller.getSnapshot(), mutedRemote)).toBe(
			false,
		);
		controller.disconnect(false);
	});

	test("activity monitor detects threshold, enforces hangover, and respects allowed set", () => {
		expect(computeRms(new Uint8Array([128, 128, 128, 128]))).toBe(0);
		expect(computeRms(new Uint8Array([160, 96, 160, 96]))).toBeCloseTo(0.25, 2);

		let currentSamples = new Uint8Array(128).fill(128);
		const updates: string[][] = [];
		const fakeAnalyser = {
			fftSize: 256,
			smoothingTimeConstant: 0.25,
			frequencyBinCount: 128,
			connect: () => {},
			disconnect: () => {},
			getByteTimeDomainData: (out: Uint8Array) => {
				out.set(currentSamples);
			},
		};
		const fakeContext = {
			state: "running",
			createMediaStreamSource: () => ({
				connect: () => {},
				disconnect: () => {},
			}),
			createAnalyser: () => fakeAnalyser,
			resume: async () => {},
			close: async () => {},
		} as unknown as AudioContext;

		const monitor = new VoiceActivityMonitor((ids) => updates.push(ids), {
			threshold: 0.02,
			hangoverMs: 400,
			pollMs: 1000,
			createContext: () => fakeContext,
		});
		monitor.setTrack("peer-1", {
			getTracks: () => [],
		} as unknown as MediaStream);
		monitor.setAllowed(new Set(["peer-1"]));
		currentSamples = new Uint8Array(128).fill(145); // loud
		expect(monitor.sampleNow(1000)).toEqual(["peer-1"]);
		currentSamples = new Uint8Array(128).fill(128); // silence within hangover
		expect(monitor.sampleNow(1200)).toEqual(["peer-1"]);
		expect(monitor.sampleNow(1500)).toEqual([]); // past hangover
		currentSamples = new Uint8Array(128).fill(145);
		expect(monitor.sampleNow(2000)).toEqual(["peer-1"]);
		monitor.setAllowed(new Set()); // immediately clears disallowed speaker
		expect(updates.at(-1)).toEqual([]);
		monitor.close();
	});

	test("mic test runs locally without joining, tracks level & loopback, and cleans up on stop or live mic", async () => {
		const stop = mock(() => {});
		const track = {
			kind: "audio",
			stop,
			addEventListener: () => {},
		};
		const stream = {
			getTracks: () => [track],
			getAudioTracks: () => [track],
		} as unknown as MediaStream;
		const { controller, peer, micTester, emitMicSample, join } = fixture(
			async () => stream,
		);

		await controller.startMicTest();
		expect(controller.getSnapshot().micTest).toBe("active");
		expect(micTester.start).toHaveBeenCalledWith(stream);
		expect(peer.setTrack).not.toHaveBeenCalled();

		emitMicSample(54, true);
		expect(controller.getSnapshot().micTestLevel).toBe(54);
		expect(controller.getSnapshot().micTestDetected).toBe(true);

		controller.toggleMicTestLoopback();
		expect(controller.getSnapshot().micTestLoopback).toBe(true);
		expect(micTester.setLoopback).toHaveBeenLastCalledWith(true);

		controller.stopMicTest();
		expect(controller.getSnapshot().micTest).toBe("idle");
		expect(controller.getSnapshot().micTestLevel).toBe(0);
		expect(controller.getSnapshot().micTestLoopback).toBe(false);
		expect(stop).toHaveBeenCalledTimes(1);

		await controller.startMicTest();
		expect(controller.getSnapshot().micTest).toBe("active");
		join();
		expect(controller.getSnapshot().micTest).toBe("idle");
		expect(stop).toHaveBeenCalledTimes(2);
		controller.disconnect(false);
	});

	test("mic tester computes perceptual level and toggles gain loopback cleanly", () => {
		expect(micTestLevelFromRms(0)).toBe(0);
		expect(micTestLevelFromRms(0.16)).toBe(66);

		let currentSamples = new Uint8Array(128).fill(128);
		const samples: Array<{ level: number; detected: boolean }> = [];
		const gainNode = {
			gain: { value: 0 },
			connect: mock(() => {}),
			disconnect: mock(() => {}),
		};
		const fakeAnalyser = {
			fftSize: 256,
			smoothingTimeConstant: 0.25,
			frequencyBinCount: 128,
			connect: () => {},
			disconnect: () => {},
			getByteTimeDomainData: (out: Uint8Array) => {
				out.set(currentSamples);
			},
		};
		const fakeContext = {
			state: "running",
			destination: {},
			createMediaStreamSource: () => ({
				connect: () => {},
				disconnect: () => {},
			}),
			createAnalyser: () => fakeAnalyser,
			createGain: () => gainNode,
			resume: async () => {},
			close: mock(async () => {}),
		} as unknown as AudioContext;

		const tester = new VoiceMicTester(
			(level, detected) => samples.push({ level, detected }),
			{
				threshold: 0.02,
				hangoverMs: 300,
				pollMs: 1000,
				createContext: () => fakeContext,
			},
		);
		tester.start({} as MediaStream);
		expect(gainNode.connect).not.toHaveBeenCalled();

		tester.setLoopback(true);
		expect(gainNode.gain.value).toBe(0.85);
		expect(gainNode.connect).toHaveBeenCalledTimes(1);

		currentSamples = new Uint8Array(128).fill(160);
		const result = tester.sampleNow(1000);
		expect(result.detected).toBe(true);
		expect(result.level).toBeGreaterThan(50);

		tester.setLoopback(false);
		expect(gainNode.gain.value).toBe(0);
		expect(gainNode.disconnect).toHaveBeenCalledTimes(1);

		tester.stop();
		expect(samples.at(-1)).toEqual({ level: 0, detected: false });
	});

	test("mic tester attaches to shared pipeline tap without closing pipeline context and recovers from interrupted state", () => {
		const currentSamples = new Uint8Array(128).fill(160);
		const samples: Array<{ level: number; detected: boolean }> = [];
		const gainNode = {
			gain: { value: 0 },
			connect: mock(() => {}),
			disconnect: mock(() => {}),
		};
		const fakeAnalyser = {
			fftSize: 256,
			smoothingTimeConstant: 0.25,
			frequencyBinCount: 128,
			connect: mock(() => {}),
			disconnect: mock(() => {}),
			getByteTimeDomainData: (out: Uint8Array) => {
				out.set(currentSamples);
			},
		};
		const tapNode = {
			connect: mock(() => {}),
			disconnect: mock(() => {}),
		} as unknown as AudioNode;
		const listeners = new Map<string, Set<() => void>>();
		const sharedContext = {
			state: "interrupted",
			destination: {},
			createAnalyser: () => fakeAnalyser,
			createGain: () => gainNode,
			resume: mock(async () => {
				sharedContext.state = "running";
			}),
			close: mock(async () => {}),
			addEventListener: (event: string, cb: () => void) => {
				const bucket = listeners.get(event) ?? new Set<() => void>();
				bucket.add(cb);
				listeners.set(event, bucket);
			},
			removeEventListener: (event: string, cb: () => void) => {
				listeners.get(event)?.delete(cb);
			},
		} as unknown as AudioContext & { state: string };

		const tester = new VoiceMicTester(
			(level, detected) => samples.push({ level, detected }),
			{ threshold: 0.02, hangoverMs: 300, pollMs: 1000 },
		);
		tester.startTap(sharedContext, tapNode);
		expect(sharedContext.resume).toHaveBeenCalled();

		tester.setLoopback(true);
		const result = tester.sampleNow(1000);
		expect(result.detected).toBe(true);
		expect(result.level).toBeGreaterThan(50);

		tester.stop();
		expect(sharedContext.close).not.toHaveBeenCalled();
		expect(tapNode.disconnect).toHaveBeenCalled();
	});
});

describe("local voice diagnostics lifecycle", () => {
	test("ignores prior upload consent and makes no fetch across opt-in, reconnect and stop", () => {
		localStorage.setItem(
			"cogm.voiceDiagnosticsConsent",
			JSON.stringify({
				consentVersion: 1,
				acceptedAt: "2026-11-20T08:00:00.000Z",
			}),
		);
		const nativeFetch = globalThis.fetch;
		const fetchMock = mock(async () => {
			throw new Error("Diagnostics must stay local");
		});
		globalThis.fetch = Object.assign(fetchMock, {
			preconnect: nativeFetch.preconnect,
		});
		const { controller, connect, state, join } = fixture(
			undefined,
			"session-diagnostics",
		);
		try {
			join();
			expect(controller.getSnapshot().diagnosticsConsent).toBe(false);
			expect(localStorage.getItem("cogm.voiceDiagnosticsConsent")).toBeNull();
			expect(controller.getDiagnosticsExport()).toBeNull();
			controller.setDiagnosticsConsent(true);
			controller.disconnect(true, 1006);
			connect();
			state(waiting);
			state(waiting);
			const rejoinedSelf = {
				...self,
				id: "00000000-0000-4000-8000-000000000099",
			};
			state({
				...joined,
				selfId: rejoinedSelf.id,
				members: [rejoinedSelf, remote],
			});
			controller.setDiagnosticsConsent(false);
			const report = controller.getDiagnosticsExport();
			controller.leave();
			controller.disconnect(false);
			expect(controller.getSnapshot().diagnosticsConsent).toBe(false);
			expect(controller.getDiagnosticsExport()).toBe(report);
			expect(JSON.parse(report ?? "null")).toMatchObject({
				events: [
					{ kind: "ws-open", memberId: self.id },
					{ kind: "ws-close", memberId: self.id, state: 1006 },
					{ kind: "voice-rejoin", memberId: rejoinedSelf.id },
					{ kind: "ws-open", memberId: rejoinedSelf.id },
				],
			});
			expect(fetchMock).not.toHaveBeenCalled();
		} finally {
			controller.disconnect(false);
			globalThis.fetch = nativeFetch;
		}
	});
});

describe("voice rejoin resilience and speaker output selection", () => {
	test("buffers early voice:signal offers arriving while join is in flight and replays on peer creation", () => {
		const { controller, state, peer } = fixture();
		state(waiting);
		controller.join();
		const earlyOffer = {
			kind: "description" as const,
			description: { type: "offer" as const, sdp: "v=0\r\nm=audio 9\r\n" },
		};
		controller.receive({
			protocolVersion: 1,
			type: "voice:signal",
			payload: { fromMemberId: remote.id, signal: earlyOffer },
		});
		expect(peer.accept).not.toHaveBeenCalled();
		state(joined);
		expect(peer.accept).toHaveBeenCalledWith(earlyOffer);
		controller.disconnect(false);
	});

	test("tracks real peer connection states and reconnects via leave + automatic rejoin", () => {
		let onChanged: (() => void) | undefined;
		const sent: VoiceClientMessage[] = [];
		const peer = {
			health: "connecting" as "connecting" | "connected" | "failed",
			playbackBlocked: false,
			setTrack: mock(() => {}),
			setAudible: mock(() => {}),
			setVolume: mock(() => {}),
			setOutputDevice: mock(() => {}),
			retryPlayback: mock(() => {}),
			close: mock(() => {}),
			accept: mock(() => {}),
		};
		const controller = new VoiceController({
			createPeer: (options) => {
				onChanged = options.changed;
				return peer as unknown as VoicePeer;
			},
		});
		controller.connect((message) => {
			sent.push(message);
			return true;
		});
		controller.receive({
			protocolVersion: 1,
			type: "voice:state",
			payload: waiting,
		});
		controller.join();
		controller.receive({
			protocolVersion: 1,
			type: "voice:state",
			payload: joined,
		});
		expect(controller.getSnapshot().peerConnecting).toBe(1);
		expect(controller.getSnapshot().peerConnected).toBe(0);
		expect(controller.getSnapshot().peerStates[remote.id]).toBe("connecting");

		peer.health = "connected";
		onChanged?.();
		expect(controller.getSnapshot().peerConnecting).toBe(0);
		expect(controller.getSnapshot().peerConnected).toBe(1);
		expect(controller.getSnapshot().peerStates[remote.id]).toBe("connected");

		peer.health = "failed";
		onChanged?.();
		expect(controller.getSnapshot().peerFailed).toBe(1);
		expect(controller.getSnapshot().peerStates[remote.id]).toBe("failed");

		controller.reconnect();
		expect(sent.at(-1)?.type).toBe("voice:leave");
		controller.receive({
			protocolVersion: 1,
			type: "voice:state",
			payload: waiting,
		});
		expect(sent.at(-1)?.type).toBe("voice:join");
		controller.disconnect(false);
	});

	test("enumerates audiooutput devices and forwards outputDeviceId to peers and mic tester", async () => {
		const mediaDescriptor = Object.getOwnPropertyDescriptor(
			navigator,
			"mediaDevices",
		);
		const setOutputDevicePeer = mock((_id: string) => {});
		const setOutputDeviceTester = mock((_id: string) => {});
		const peer = {
			setTrack: mock(() => {}),
			setAudible: mock(() => {}),
			setVolume: mock(() => {}),
			setOutputDevice: setOutputDevicePeer,
			retryPlayback: mock(() => {}),
			close: mock(() => {}),
			accept: mock(() => {}),
		};
		Object.defineProperty(navigator, "mediaDevices", {
			configurable: true,
			value: {
				enumerateDevices: async () => [
					{ deviceId: "mic-1", kind: "audioinput", label: "USB Mic" },
					{ deviceId: "spk-1", kind: "audiooutput", label: "Headphones" },
				],
			},
		});
		const controller = new VoiceController({
			createPeer: () => peer as unknown as VoicePeer,
			createMicTester: () => ({
				start: mock(() => {}),
				setLoopback: mock(() => {}),
				setOutputDevice: setOutputDeviceTester,
				stop: mock(() => {}),
			}),
		});
		try {
			controller.connect(() => true);
			await controller.refreshAudioDevices();
			expect(controller.getSnapshot().audioOutputDevices).toEqual([
				{ deviceId: "default", label: "" },
				{ deviceId: "spk-1", label: "Headphones" },
			]);
			controller.receive({
				protocolVersion: 1,
				type: "voice:state",
				payload: waiting,
			});
			controller.join();
			controller.receive({
				protocolVersion: 1,
				type: "voice:state",
				payload: joined,
			});
			await controller.updateAudioSettings({ outputDeviceId: "spk-1" });
			expect(controller.getSnapshot().audioSettings.outputDeviceId).toBe(
				"spk-1",
			);
			expect(setOutputDevicePeer).toHaveBeenLastCalledWith("spk-1");
			expect(setOutputDeviceTester).toHaveBeenLastCalledWith("spk-1");
		} finally {
			controller.disconnect(false);
			if (mediaDescriptor) {
				Object.defineProperty(navigator, "mediaDevices", mediaDescriptor);
			} else {
				delete (navigator as { mediaDevices?: unknown }).mediaDevices;
			}
		}
	});
});
