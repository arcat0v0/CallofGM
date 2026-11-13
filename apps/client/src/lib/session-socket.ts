import type {
	ClientCommand,
	ClientCommandType,
	ServerMessage,
} from "@cogm/shared";
import { t } from "@/i18n";
import { getFingerprint } from "./fingerprint";

export type SessionSocket = {
	sendCommand: (type: ClientCommandType, payload: unknown) => string;
	close: () => void;
};

type ConnectSessionOptions = {
	sessionId: string;
	lastEventId?: number;
	signal?: AbortSignal;
	onMessage: (message: ServerMessage) => void;
	onClose?: (info: { code: number; reason: string }) => void;
};

const HEARTBEAT_MS = 20_000;
const PONG_TIMEOUT_MS = 10_000;

let active: SessionSocket | null = null;

export async function connectSession(
	options: ConnectSessionOptions,
): Promise<SessionSocket> {
	const fingerprint = await getFingerprint();
	if (options.signal?.aborted) {
		throw new DOMException(t("play.connectAborted"), "AbortError");
	}
	const protocol = location.protocol === "https:" ? "wss:" : "ws:";
	const params = new URLSearchParams({ fingerprint });
	if (options.lastEventId !== undefined) {
		params.set("lastEventId", String(options.lastEventId));
	}
	const url = `${protocol}//${location.host}/api/v1/sessions/${encodeURIComponent(options.sessionId)}/ws?${params.toString()}`;

	const previous = active;
	const ws = new WebSocket(url);
	let heartbeat: ReturnType<typeof setInterval> | null = null;
	let pongTimer: ReturnType<typeof setTimeout> | null = null;
	let closedByClient = false;
	let notifiedClose = false;

	const clearTimers = () => {
		if (heartbeat) {
			clearInterval(heartbeat);
			heartbeat = null;
		}
		if (pongTimer) {
			clearTimeout(pongTimer);
			pongTimer = null;
		}
	};

	const clearPong = () => {
		if (pongTimer) {
			clearTimeout(pongTimer);
			pongTimer = null;
		}
	};

	const notifyClosed = (code: number, reason: string) => {
		if (closedByClient || notifiedClose) return;
		notifiedClose = true;
		options.onClose?.({ code, reason });
	};

	const onVisibilityOrOnline = () => {
		if (
			typeof document !== "undefined" &&
			document.visibilityState === "hidden"
		) {
			return;
		}
		sendPing();
	};

	const cleanupListeners = () => {
		if (typeof document !== "undefined") {
			document.removeEventListener("visibilitychange", onVisibilityOrOnline);
		}
		if (typeof window !== "undefined") {
			window.removeEventListener("online", onVisibilityOrOnline);
		}
	};

	const sendPing = () => {
		if (closedByClient || ws.readyState !== WebSocket.OPEN) return;
		ws.send("ping");
		if (!pongTimer) {
			pongTimer = setTimeout(() => {
				pongTimer = null;
				if (closedByClient) return;
				clearTimers();
				cleanupListeners();
				if (active === socket) {
					active = null;
				}
				try {
					ws.close(4008, "heartbeat timeout");
				} catch {
					// ignore close errors on dead socket
				}
				notifyClosed(4008, "heartbeat timeout");
			}, PONG_TIMEOUT_MS);
		}
	};

	const sendCommand = (type: ClientCommandType, payload: unknown): string => {
		const commandId = crypto.randomUUID();
		const command: ClientCommand = {
			protocolVersion: 1,
			commandId,
			type,
			payload,
		};
		if (ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(command));
		}
		return commandId;
	};

	const socket: SessionSocket = {
		sendCommand,
		close: () => {
			closedByClient = true;
			clearTimers();
			cleanupListeners();
			if (active === socket) {
				active = null;
			}
			if (
				ws.readyState === WebSocket.OPEN ||
				ws.readyState === WebSocket.CONNECTING
			) {
				ws.close();
			}
		},
	};

	let rejectOpen: ((reason?: unknown) => void) | null = null;

	const abortConnection = () => {
		socket.close();
		rejectOpen?.(new DOMException(t("play.connectAborted"), "AbortError"));
		rejectOpen = null;
	};

	options.signal?.addEventListener("abort", abortConnection, { once: true });

	ws.addEventListener("open", () => {
		if (typeof document !== "undefined") {
			document.addEventListener("visibilitychange", onVisibilityOrOnline);
		}
		if (typeof window !== "undefined") {
			window.addEventListener("online", onVisibilityOrOnline);
		}
		heartbeat = setInterval(sendPing, HEARTBEAT_MS);
	});

	ws.addEventListener("message", (event) => {
		if (closedByClient) return;
		clearPong();
		if (typeof event.data === "string" && event.data === "pong") {
			return;
		}
		try {
			const parsed = JSON.parse(String(event.data)) as ServerMessage;
			options.onMessage(parsed);
		} catch {
			// ignore malformed frames
		}
	});

	ws.addEventListener("close", (event) => {
		clearTimers();
		cleanupListeners();
		if (active === socket) {
			active = null;
		}
		notifyClosed(event.code, event.reason);
	});

	await new Promise<void>((resolve, reject) => {
		rejectOpen = reject;
		if (options.signal?.aborted) {
			abortConnection();
			return;
		}
		const onOpen = () => {
			ws.removeEventListener("error", onError);
			rejectOpen = null;
			resolve();
		};
		const onError = () => {
			ws.removeEventListener("open", onOpen);
			rejectOpen = null;
			reject(new Error(t("play.connectFailed")));
		};
		ws.addEventListener("open", onOpen, { once: true });
		ws.addEventListener("error", onError, { once: true });
	});

	if (options.signal?.aborted) {
		abortConnection();
		throw new DOMException(t("play.connectAborted"), "AbortError");
	}

	previous?.close();
	active = socket;
	return socket;
}

export function sendSessionCommand(
	type: ClientCommandType,
	payload: unknown,
): string | null {
	return active?.sendCommand(type, payload) ?? null;
}
