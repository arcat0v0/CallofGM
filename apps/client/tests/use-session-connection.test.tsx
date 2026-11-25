import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	mock,
	spyOn,
	test,
} from "bun:test";
import {
	type ServerMessage,
	SessionCloseCode,
	type VoiceClientMessage,
	type VoiceServerMessage,
	type VoiceState,
} from "@cogm/shared";
import { act, render, waitFor } from "@testing-library/react";
import type { VoiceController } from "@/features/voice/voice-controller";
import type { SessionSocket } from "@/lib/session-socket";

type ConnectOptions = {
	sessionId: string;
	lastEventId?: number;
	signal?: AbortSignal;
	onMessage: (message: ServerMessage) => void;
	onVoiceMessage?: (message: VoiceServerMessage) => void;
	onClose?: (info: { code: number; reason: string }) => void;
};

const connections: ConnectOptions[] = [];
const voiceCommands: VoiceClientMessage[] = [];
const nativePeerConnection = globalThis.RTCPeerConnection;
let rejectHandshake = false;

mock.module("@/lib/session-socket", () => ({
	connectSession: async (options: ConnectOptions): Promise<SessionSocket> => {
		connections.push(options);
		if (rejectHandshake) throw new Error("WebSocket handshake failed");
		return {
			sendCommand: () => crypto.randomUUID(),
			sendVoice: (message) => {
				voiceCommands.push(message);
				return true;
			},
			close: () => undefined,
		};
	},
	sendSessionCommand: () => null,
}));

const { useSessionConnection } = await import("@/lib/use-session-connection");
const { usePlayStore } = await import("@/stores/play-store");
const { useIdentityStore } = await import("@/stores/identity-store");

const SNAPSHOT = {
	protocolVersion: 1,
	type: "snapshot",
	watermark: 3,
	payload: {
		session: {
			id: "session-1",
			name: "测试团",
			moduleId: "module-1",
			moduleName: "测试模组",
			themeId: null,
			status: "active",
			phase: "free_discussion",
			currentSceneId: null,
			lastEventId: 3,
			settings: { sharePcSheets: true, obSeePcState: true, diceSkin: "olive" },
		},
		currentScene: null,
		viewer: { isGm: false, seatRole: "ob" },
		characters: [],
		bgm: null,
		recentHistory: [],
		history: { beforeEventId: null, hasMore: false },
		visibleHandouts: [],
		pendingCheckRequests: [],
	},
} satisfies ServerMessage;

let retry: (() => void) | null = null;
let voice: VoiceController | null = null;

function Harness() {
	const connection = useSessionConnection("session-1", { ensurePlayer: false });
	retry = connection.retry;
	voice = connection.voice;
	return null;
}

function ObservedHarness({
	onLiveEvent,
}: {
	onLiveEvent: (eventId: number) => void;
}) {
	useSessionConnection("session-1", {
		ensurePlayer: false,
		onLiveEvent: (event) => onLiveEvent(event.eventId),
	});
	return null;
}

describe("useSessionConnection retry", () => {
	beforeEach(() => {
		connections.length = 0;
		voiceCommands.length = 0;
		rejectHandshake = false;
		useIdentityStore.getState().setAccount({
			userId: "user-1",
			username: "gm",
			role: "gm",
		});
		voice = null;
		retry = null;
		usePlayStore.getState().reset();
	});

	afterEach(() => {
		globalThis.RTCPeerConnection = nativePeerConnection;
		useIdentityStore.getState().setAccount(null);
	});

	test.each([
		{ account: true, status: 401, terminal: "loginExpired" },
		{ account: true, status: 200, terminal: "unavailable" },
		{ account: true, status: 503, terminal: "unavailable" },
		{ account: true, status: null, terminal: "unavailable" },
		{ account: false, status: 401, terminal: "unavailable" },
	])(
		"classifies repeated handshake failures with account=$account and auth status=$status",
		async ({ account, status, terminal }) => {
			jest.useFakeTimers();
			rejectHandshake = true;
			if (!account) useIdentityStore.getState().setAccount(null);
			const fetcher = spyOn(globalThis, "fetch").mockImplementation(
				Object.assign(
					async () => {
						if (status === null) throw new TypeError("Network request failed");
						return Response.json({}, { status });
					},
					{ preconnect: globalThis.fetch.preconnect },
				),
			);
			const view = render(<Harness />);
			try {
				await act(async () => {});
				for (const delay of [800, 1600, 3200]) {
					await act(async () => {
						jest.advanceTimersByTime(delay);
					});
				}
				expect(connections).toHaveLength(4);
				expect(fetcher).not.toHaveBeenCalled();
				expect(usePlayStore.getState().terminal).toBeNull();
				await act(async () => {
					jest.advanceTimersByTime(6400);
				});
				expect(usePlayStore.getState().terminal).toBe(terminal);
				if (account) {
					expect(fetcher).toHaveBeenCalledTimes(1);
					expect(fetcher).toHaveBeenCalledWith(
						"/api/v1/auth/me",
						expect.objectContaining({ credentials: "include" }),
					);
				} else {
					expect(fetcher).not.toHaveBeenCalled();
				}
				await act(async () => {
					connections[4]?.onClose?.({ code: 1006, reason: "" });
					jest.advanceTimersByTime(8_000);
				});
				expect(connections).toHaveLength(5);
			} finally {
				view.unmount();
				fetcher.mockRestore();
				jest.useRealTimers();
			}
		},
	);
	test("kicked retry resyncs with a fresh snapshot instead of replaying the old watermark", async () => {
		render(<Harness />);
		await waitFor(() => expect(connections.length).toBe(1));
		const first = connections[0];
		if (!first) throw new Error("Expected first session connection");

		act(() => {
			usePlayStore.setState({ lastEventId: 7, snapshotReady: true });
			first.onClose?.({ code: 4000, reason: "kicked" });
		});
		expect(usePlayStore.getState().terminal).toBe("kicked");

		act(() => retry?.());
		expect(usePlayStore.getState().terminal).toBeNull();
		await waitFor(() => expect(connections.length).toBe(2));
		expect(connections[1]?.lastEventId).toBeUndefined();

		act(() => connections[1]?.onMessage(SNAPSHOT));
		expect(usePlayStore.getState().connected).toBe(true);
		expect(usePlayStore.getState().snapshotReady).toBe(true);
		expect(usePlayStore.getState().lastEventId).toBe(3);
		expect(usePlayStore.getState().terminal).toBeNull();
	});

	test("a superseded connection cannot restore the kicked terminal state", async () => {
		render(<Harness />);
		await waitFor(() => expect(connections.length).toBe(1));
		const first = connections[0];
		if (!first) throw new Error("Expected first session connection");

		act(() => first.onClose?.({ code: 4000, reason: "kicked" }));
		expect(usePlayStore.getState().terminal).toBe("kicked");

		act(() => retry?.());
		await waitFor(() => expect(connections.length).toBe(2));

		act(() => first.onClose?.({ code: 4000, reason: "kicked" }));
		expect(usePlayStore.getState().terminal).toBeNull();
	});

	test("automatic reconnect keeps the watermark for gap-free replay", async () => {
		render(<Harness />);
		await waitFor(() => expect(connections.length).toBe(1));

		act(() => {
			usePlayStore.setState({ lastEventId: 7 });
			connections[0]?.onClose?.({ code: 1006, reason: "network" });
		});

		await waitFor(() => expect(connections.length).toBe(2), { timeout: 3000 });
		expect(connections[1]?.lastEventId).toBe(7);
	});

	test("claim replacement still terminates the session", async () => {
		render(<Harness />);
		await waitFor(() => expect(connections.length).toBe(1));

		act(() =>
			connections[0]?.onClose?.({ code: 4001, reason: "claim replaced" }),
		);
		expect(usePlayStore.getState().terminal).toBe("replaced");
	});

	test("session end keeps the ended status and reopens once for review", async () => {
		render(<Harness />);
		await waitFor(() => expect(connections.length).toBe(1));

		act(() =>
			connections[0]?.onClose?.({ code: 1001, reason: "session ended" }),
		);
		expect(usePlayStore.getState().status).toBe("ended");
		await waitFor(() => expect(connections.length).toBe(2), { timeout: 3000 });
	});

	test("refresh rejoins only the same room and login revocation clears voice", async () => {
		globalThis.RTCPeerConnection =
			class extends EventTarget {} as typeof RTCPeerConnection;
		render(<Harness />);
		await waitFor(() => expect(connections.length).toBe(1));
		const member = {
			id: "00000000-0000-4000-8000-000000000021",
			name: "OB",
			role: "ob",
			canSpeak: false,
			speakGranted: false,
			muted: false,
		} as const;
		const room = {
			enabled: true,
			available: true,
			limit: 8,
			maxLimit: 8,
			selfId: null,
			members: [],
			memberCount: 0,
			iceServers: [],
			roomId: "00000000-0000-4000-8000-000000000020",
			canManage: false,
		} satisfies VoiceState;
		const joined = {
			...room,
			selfId: member.id,
			members: [member],
			memberCount: 1,
		};
		const deliver = (index: number, payload: VoiceState) =>
			connections[index]?.onVoiceMessage?.({
				protocolVersion: 1,
				type: "voice:state",
				payload,
			});
		act(() => {
			deliver(0, room);
			voice?.join();
			deliver(0, joined);
		});
		expect(voice?.getSnapshot().member).toEqual(member);
		act(() =>
			connections[0]?.onMessage({
				protocolVersion: 1,
				type: "session:refresh",
				payload: {},
			}),
		);
		expect(voice?.getSnapshot().member).toBeNull();
		await waitFor(() => expect(connections.length).toBe(2));
		act(() => {
			deliver(0, joined);
			deliver(1, room);
			deliver(1, joined);
		});
		expect(voiceCommands.map((message) => message.payload)).toEqual([
			{ roomId: room.roomId },
			{ roomId: room.roomId },
		]);
		expect(voice?.getSnapshot().member).toEqual(member);
		act(() =>
			connections[1]?.onClose?.({
				code: SessionCloseCode.loginRevoked,
				reason: "session replaced",
			}),
		);
		expect(voice?.getSnapshot().member).toBeNull();
		expect(voice?.getSnapshot().link).toBe("offline");
		expect(usePlayStore.getState().terminal).toBe("loginExpired");
	});

	test("skips onLiveEvent for replayed reconnect events while forwarding live events", async () => {
		const observed: number[] = [];
		render(<ObservedHarness onLiveEvent={(id) => observed.push(id)} />);
		await waitFor(() => expect(connections.length).toBe(1));

		act(() => {
			connections[0]?.onMessage({
				protocolVersion: 1,
				eventId: 4,
				type: "dice:rolled",
				occurredAt: 1,
				payload: {},
				replayed: true,
			});
			connections[0]?.onMessage({
				protocolVersion: 1,
				eventId: 5,
				type: "dice:rolled",
				occurredAt: 2,
				payload: {},
			});
		});

		expect(observed).toEqual([5]);
	});

	test("skips onLiveEvent for late events at or below the current watermark", async () => {
		const observed: number[] = [];
		render(<ObservedHarness onLiveEvent={(id) => observed.push(id)} />);
		await waitFor(() => expect(connections.length).toBe(1));

		act(() => {
			usePlayStore.setState({ lastEventId: 10 });
			connections[0]?.onMessage({
				protocolVersion: 1,
				eventId: 10,
				type: "dice:rolled",
				occurredAt: 1,
				payload: {},
			});
			connections[0]?.onMessage({
				protocolVersion: 1,
				eventId: 11,
				type: "dice:rolled",
				occurredAt: 2,
				payload: {},
			});
		});

		expect(observed).toEqual([11]);
	});
});
