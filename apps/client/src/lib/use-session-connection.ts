import {
	type ServerMessage,
	SessionCloseCode,
	type SessionEvent,
} from "@cogm/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceController } from "@/features/voice/voice-controller";
import { usePlayStore } from "@/stores/play-store";
import { ensurePlayer } from "./identity";
import { connectSession, type SessionSocket } from "./session-socket";

const MAX_HANDSHAKE_FAILURES = 5;
const SESSION_ENDED_REASON = "session ended";

export function useSessionConnection(
	sessionId: string,
	options?: {
		ensurePlayer?: boolean;
		onLiveEvent?: (message: SessionEvent) => void;
	},
): { retry: () => void; voice: VoiceController } {
	const [voice] = useState(() => new VoiceController({ sessionId }));
	const applyMessage = usePlayStore((state) => state.applyMessage);
	const reset = usePlayStore((state) => state.reset);
	const setConnected = usePlayStore((state) => state.setConnected);
	const setTerminal = usePlayStore((state) => state.setTerminal);
	const markEnded = usePlayStore((state) => state.markEnded);

	const controls = useRef<{
		resync: () => Promise<void>;
	} | null>(null);

	useEffect(() => {
		voice.setSessionId(sessionId);
		let cancelled = false;
		let socket: SessionSocket | null = null;
		const controller = new AbortController();
		let retry: ReturnType<typeof setTimeout> | null = null;
		let attempt = 0;
		let handshakeFailures = 0;
		let refreshingSnapshot = false;
		let reopenedAfterEnd = false;
		let attemptGeneration = 0;
		reset();

		function scheduleReconnect() {
			clearTimeout(retry ?? undefined);
			const watermark = usePlayStore.getState().lastEventId;
			const delay = Math.min(8_000, 800 * 2 ** attempt);
			attempt += 1;
			retry = setTimeout(() => {
				void open(watermark > 0 ? watermark : undefined);
			}, delay);
		}

		async function refreshSnapshot(): Promise<void> {
			if (cancelled || refreshingSnapshot) {
				return;
			}
			refreshingSnapshot = true;
			try {
				await open();
			} finally {
				refreshingSnapshot = false;
			}
		}

		function handleMessage(message: ServerMessage): void {
			if ("eventId" in message) {
				const event = message as SessionEvent;
				const watermark = usePlayStore.getState().lastEventId;
				if (!event.replayed && event.eventId > watermark) {
					options?.onLiveEvent?.(event);
				}
			}
			if ("type" in message && message.type === "session:refresh") {
				void refreshSnapshot();
				return;
			}
			if ("type" in message && message.type === "session:rewound") {
				applyMessage(message);
				void refreshSnapshot();
				return;
			}
			const settingsBefore = usePlayStore.getState().settings;
			applyMessage(message);
			const play = usePlayStore.getState();
			if (play.terminal || play.status === "ended") voice.disconnect(false);
			if (message.type !== "session:settings-changed") {
				return;
			}
			const settingsAfter = usePlayStore.getState().settings;
			if (
				settingsAfter.sharePcSheets !== settingsBefore.sharePcSheets ||
				settingsAfter.obSeePcState !== settingsBefore.obSeePcState ||
				settingsAfter.diceSkin !== settingsBefore.diceSkin
			) {
				void refreshSnapshot();
			}
		}

		async function open(lastEventId?: number): Promise<void> {
			const generation = ++attemptGeneration;
			const isCurrent = () => !cancelled && generation === attemptGeneration;
			if (retry) {
				clearTimeout(retry);
				retry = null;
			}
			if (socket) voice.disconnect(true);
			socket?.close();
			socket = null;
			try {
				if (options?.ensurePlayer !== false) {
					await ensurePlayer();
				}
				if (!isCurrent()) {
					return;
				}
				const next = await connectSession({
					sessionId,
					lastEventId,
					signal: controller.signal,
					onMessage: (message) => {
						if (isCurrent()) {
							handleMessage(message);
						}
					},
					onVoiceMessage: (message) => {
						if (isCurrent()) voice.receive(message);
					},
					onReplaced: () => {
						if (isCurrent()) voice.disconnect(false);
					},
					onClose: ({ code, reason }) => {
						if (!isCurrent()) {
							return;
						}
						socket = null;
						setConnected(false);
						if (code === SessionCloseCode.kicked) {
							voice.disconnect(false);
							setTerminal("kicked");
							return;
						}
						if (code === SessionCloseCode.claimReplaced) {
							voice.disconnect(false);
							setTerminal("replaced");
							return;
						}
						if (code === SessionCloseCode.seatReleased) {
							voice.disconnect(false);
							setTerminal("released");
							return;
						}
						if (code === SessionCloseCode.loginRevoked) {
							voice.disconnect(false);
							setTerminal("unavailable");
							return;
						}
						if (code === 1001 && reason === SESSION_ENDED_REASON) {
							voice.disconnect(false);
							markEnded();
							if (!reopenedAfterEnd) {
								reopenedAfterEnd = true;
								scheduleReconnect();
							}
							return;
						}
						voice.disconnect(!usePlayStore.getState().terminal, code);
						scheduleReconnect();
					},
				});
				if (!isCurrent()) {
					next.close();
					return;
				}
				socket = next;
				voice.connect(next.sendVoice);
				attempt = 0;
				handshakeFailures = 0;
			} catch {
				if (!isCurrent()) {
					return;
				}
				setConnected(false);
				handshakeFailures += 1;
				if (handshakeFailures >= MAX_HANDSHAKE_FAILURES) {
					voice.disconnect(false);
					setTerminal("unavailable");
					return;
				}
				scheduleReconnect();
			}
		}

		controls.current = {
			resync: async () => {
				attempt = 0;
				handshakeFailures = 0;
				await open();
			},
		};

		void open();

		return () => {
			cancelled = true;
			voice.disconnect(false);
			controls.current = null;
			if (retry) {
				clearTimeout(retry);
			}
			controller.abort();
			socket?.close();
			reset();
		};
	}, [
		sessionId,
		options?.ensurePlayer,
		options?.onLiveEvent,
		applyMessage,
		reset,
		setConnected,
		setTerminal,
		markEnded,
		voice,
	]);

	const retryConnection = useCallback(() => {
		setTerminal(null);
		void controls.current?.resync();
	}, [setTerminal]);

	return { retry: retryConnection, voice };
}
