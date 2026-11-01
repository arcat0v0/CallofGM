import type { ClientCommand, ClientCommandType, ServerMessage } from "@cogm/shared";
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

let active: SessionSocket | null = null;

export async function connectSession(options: ConnectSessionOptions): Promise<SessionSocket> {
  const fingerprint = await getFingerprint();
  if (options.signal?.aborted) {
    throw new DOMException("连接已取消", "AbortError");
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
  let closedByClient = false;

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
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      if (active === socket) {
        active = null;
      }
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    },
  };

  let rejectOpen: ((reason?: unknown) => void) | null = null;

  const abortConnection = () => {
    socket.close();
    rejectOpen?.(new DOMException("连接已取消", "AbortError"));
    rejectOpen = null;
  };

  options.signal?.addEventListener("abort", abortConnection, { once: true });

  ws.addEventListener("open", () => {
    heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send("ping");
      }
    }, HEARTBEAT_MS);
  });

  ws.addEventListener("message", (event) => {
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
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    if (active === socket) {
      active = null;
    }
    if (!closedByClient) {
      options.onClose?.({ code: event.code, reason: event.reason });
    }
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
      reject(new Error("无法连接团内实时通道"));
    };
    ws.addEventListener("open", onOpen, { once: true });
    ws.addEventListener("error", onError, { once: true });
  });

  if (options.signal?.aborted) {
    abortConnection();
    throw new DOMException("连接已取消", "AbortError");
  }

  previous?.close();
  active = socket;
  return socket;
}

export function sendSessionCommand(type: ClientCommandType, payload: unknown): string | null {
  return active?.sendCommand(type, payload) ?? null;
}
