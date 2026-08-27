import type { ClientCommand, ClientCommandType, ServerMessage } from "@cogm/shared";
import { getFingerprint } from "./fingerprint";

export type SessionSocket = {
  sendCommand: (type: ClientCommandType, payload: unknown) => string;
  close: () => void;
};

type ConnectSessionOptions = {
  sessionId: string;
  lastEventId?: number;
  onMessage: (message: ServerMessage) => void;
  onClose?: () => void;
};

const HEARTBEAT_MS = 20_000;

let active: SessionSocket | null = null;

export function getSessionSocket(): SessionSocket | null {
  return active;
}

export async function connectSession(options: ConnectSessionOptions): Promise<SessionSocket> {
  const fingerprint = await getFingerprint();
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

  ws.addEventListener("close", () => {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    if (active === socket) {
      active = null;
    }
    if (!closedByClient) {
      options.onClose?.();
    }
  });

  await new Promise<void>((resolve, reject) => {
    const onOpen = () => {
      ws.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      ws.removeEventListener("open", onOpen);
      reject(new Error("无法连接团内实时通道"));
    };
    ws.addEventListener("open", onOpen, { once: true });
    ws.addEventListener("error", onError, { once: true });
  });

  previous?.close();
  active = socket;
  return socket;
}

export const connectSessionSocket = connectSession;

export function sendSessionCommand(type: ClientCommandType, payload: unknown): string | null {
  return active?.sendCommand(type, payload) ?? null;
}
