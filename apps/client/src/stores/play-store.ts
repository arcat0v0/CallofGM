import { create } from "zustand";
import { toast } from "sonner";
import {
  coc7e,
  type BgmState,
  type CatalogHandoutDto,
  type ChatMessageDto,
  type CheckRequestDto,
  type GrantedHandoutDto,
  type OnlinePlayerDto,
  type SceneDto,
  type SePlayedEvent,
  type ServerMessage,
  type SessionPhase,
  type SessionSnapshotPayload,
  type SessionStatus,
  type SeatRole,
  type SnapshotCharacter,
  type TrackDto,
} from "@cogm/shared";
import type { ChatMessage } from "@/features/chat/types";
import { mapActivityEvent, mapChatMessage } from "@/lib/chat-map";
import { errorCopy } from "@/lib/error-copy";
import { formatClock, initialsOf } from "@/lib/format";

export type ConnectionTerminal = "kicked" | "unavailable";

type PlayState = {
  sessionId: string | null;
  moduleId: string | null;
  moduleName: string | null;
  status: SessionStatus | null;
  phase: SessionPhase | null;
  lastEventId: number;
  viewer: { isGm: boolean; seatRole: SeatRole | null };
  characters: SnapshotCharacter[];
  messages: ChatMessage[];
  pendingQueue: ChatMessageDto[];
  bgm: BgmState | null;
  scene: { id: string; name: string; bgAssetId: string | null } | null;
  handouts: GrantedHandoutDto[];
  presence: OnlinePlayerDto[];
  presenceAvailable: boolean;
  pendingChecks: CheckRequestDto[];
  catalogScenes: SceneDto[];
  catalogTracks: TrackDto[];
  catalogHandouts: CatalogHandoutDto[];
  seCue: SePlayedEvent | null;
  bgmTransitionMs: number;
  muted: boolean;
  connected: boolean;
  terminal: ConnectionTerminal | null;
  lastRejection: { commandId: string; message: string } | null;
  applySnapshot: (payload: SessionSnapshotPayload, watermark: number) => void;
  applyMessage: (message: ServerMessage) => void;
  setCatalog: (input: { scenes?: SceneDto[]; tracks?: TrackDto[]; handouts?: CatalogHandoutDto[] }) => void;
  setConnected: (connected: boolean) => void;
  setTerminal: (terminal: ConnectionTerminal | null) => void;
  markEnded: () => void;
  setMuted: (muted: boolean) => void;
  clearSeCue: () => void;
  reset: () => void;
};

const empty = {
  sessionId: null as string | null,
  moduleId: null as string | null,
  moduleName: null as string | null,
  status: null as SessionStatus | null,
  phase: null as SessionPhase | null,
  lastEventId: 0,
  viewer: { isGm: false, seatRole: null } as PlayState["viewer"],
  characters: [] as SnapshotCharacter[],
  messages: [] as ChatMessage[],
  pendingQueue: [] as ChatMessageDto[],
  bgm: null as BgmState | null,
  scene: null as PlayState["scene"],
  handouts: [] as GrantedHandoutDto[],
  presence: [] as OnlinePlayerDto[],
  presenceAvailable: false,
  pendingChecks: [] as CheckRequestDto[],
  catalogScenes: [] as SceneDto[],
  catalogTracks: [] as TrackDto[],
  catalogHandouts: [] as CatalogHandoutDto[],
  seCue: null as SePlayedEvent | null,
  bgmTransitionMs: 400,
  muted: false,
  connected: false,
  terminal: null as ConnectionTerminal | null,
  lastRejection: null as { commandId: string; message: string } | null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function appendMessage(messages: ChatMessage[], next: ChatMessage | null): ChatMessage[] {
  if (!next || messages.some((message) => message.id === next.id)) {
    return messages;
  }
  return [...messages, next];
}

function applyEvent(state: PlayState, type: string, payload: unknown, eventId?: number, occurredAt?: number): Partial<PlayState> {
  if (type === "audio:se") {
    const cue = (isRecord(payload) ? payload : {}) as SePlayedEvent;
    if (!cue.trackId) {
      return {};
    }
    return { seCue: cue };
  }

  if (!isRecord(payload)) {
    return {};
  }

  switch (type) {
    case "chat:message": {
      const dto = (payload.message ?? payload) as ChatMessageDto;
      if (!dto?.id) {
        return {};
      }
      return { messages: appendMessage(state.messages, mapChatMessage(dto)) };
    }
    case "dice:rolled":
    case "check:resolved": {
      let activityPayload: Record<string, unknown> = payload;
      if (type === "dice:rolled" && payload.rollerType === "player" && typeof payload.rollerId === "string" && !payload.characterName) {
        const roller = state.characters.find((character) => character.claim?.playerId === payload.rollerId);
        if (roller) {
          activityPayload = { ...payload, characterName: roller.name };
        }
      }
      const next = mapActivityEvent(type, activityPayload, eventId ?? Date.now(), occurredAt);
      const patch: Partial<PlayState> = { messages: appendMessage(state.messages, next) };
      if (type === "check:resolved") {
        const requestId = typeof payload.requestId === "string" ? payload.requestId : null;
        if (requestId) {
          patch.pendingChecks = state.pendingChecks.filter((item) => item.id !== requestId);
        }
      }
      return patch;
    }
    case "session:status-changed": {
      const status = payload.status;
      if (status === "waiting" || status === "preparing" || status === "active" || status === "ended") {
        return { status };
      }
      return {};
    }
    case "session:phase-changed": {
      const phase = payload.phase;
      if (
        phase === "free_discussion" ||
        phase === "performance_time" ||
        phase === "forced_cg" ||
        phase === "free_performance"
      ) {
        return { phase };
      }
      return {};
    }
    case "scene:changed": {
      const id = typeof payload.sceneId === "string" ? payload.sceneId : typeof payload.id === "string" ? payload.id : null;
      const name = typeof payload.name === "string" ? payload.name : "";
      if (!id) {
        return {};
      }
      return {
        scene: {
          id,
          name,
          bgAssetId: typeof payload.bgAssetId === "string" ? payload.bgAssetId : null,
        },
      };
    }
    case "expression:changed": {
      const characterId = typeof payload.characterId === "string" ? payload.characterId : null;
      const expressionKey = typeof payload.expressionKey === "string" ? payload.expressionKey : null;
      if (!characterId || !expressionKey) {
        return {};
      }
      return {
        characters: state.characters.map((character) =>
          character.characterId === characterId ? { ...character, currentExpressionKey: expressionKey } : character,
        ),
      };
    }
    case "audio:bgm": {
      const bgm = (payload.bgm ?? payload) as BgmState;
      if (!bgm || typeof bgm !== "object") {
        return {};
      }
      const transitionMs = typeof payload.transitionMs === "number" ? payload.transitionMs : 400;
      return { bgm, bgmTransitionMs: transitionMs };
    }
    case "handout:granted": {
      const grant = (payload.grant ?? payload) as GrantedHandoutDto;
      if (!grant?.grantId) {
        return {};
      }
      if (state.handouts.some((item) => item.grantId === grant.grantId)) {
        return {
          handouts: state.handouts.map((item) => (item.grantId === grant.grantId ? grant : item)),
        };
      }
      return { handouts: [...state.handouts, grant] };
    }
    case "check:requested": {
      const request = (payload.request ?? payload) as CheckRequestDto;
      if (!request?.id) {
        return {};
      }
      if (state.pendingChecks.some((item) => item.id === request.id)) {
        return {};
      }
      return { pendingChecks: [...state.pendingChecks, request] };
    }
    case "state:changed": {
      const characterId = typeof payload.characterId === "string" ? payload.characterId : null;
      if (!characterId) {
        return {};
      }
      return {
        characters: state.characters.map((character) =>
          character.characterId === characterId ? { ...character, state: payload.state ?? character.state } : character,
        ),
      };
    }
    case "state:hint": {
      const characterId = typeof payload.characterId === "string" ? payload.characterId : null;
      const name = state.characters.find((character) => character.characterId === characterId)?.name ?? "角色";
      const hints = Array.isArray(payload.hints) ? payload.hints.filter((item): item is string => typeof item === "string") : [];
      for (const hint of hints) {
        toast.warning(`${name}：${hint}`);
      }
      return {};
    }
    default:
      return {};
  }
}

export const usePlayStore = create<PlayState>((set, get) => ({
  ...empty,
  applySnapshot: (payload, watermark) => {
    const fromEvents = payload.recentEvents
      .map((event) => mapActivityEvent(event.type, event.payload, event.eventId, event.occurredAt))
      .filter((message): message is ChatMessage => message !== null);
    const fromChat = payload.recentMessages.map(mapChatMessage);
    const merged: ChatMessage[] = [];
    for (const message of [...fromChat, ...fromEvents]) {
      if (!merged.some((item) => item.id === message.id)) {
        merged.push(message);
      }
    }
    set({
      sessionId: payload.session.id,
      moduleId: payload.session.moduleId,
      moduleName: payload.session.moduleName,
      status: payload.session.status,
      phase: payload.session.phase,
      lastEventId: watermark,
      viewer: payload.viewer,
      characters: payload.characters,
      messages: merged,
      pendingQueue: payload.pendingQueue ?? [],
      bgm: payload.bgm,
      scene: payload.currentScene,
      handouts: payload.visibleHandouts,
      presence: payload.online ?? [],
      presenceAvailable: payload.online !== undefined,
      pendingChecks: payload.pendingCheckRequests,
      connected: true,
      terminal: null,
    });
  },
  applyMessage: (message) => {
    if (message.type === "snapshot" && "watermark" in message) {
      get().applySnapshot(message.payload as SessionSnapshotPayload, message.watermark);
      return;
    }
    if ("type" in message && (message.type === "command:accepted" || message.type === "command:rejected")) {
      const payload = isRecord(message.payload) ? message.payload : {};
      if (message.type === "command:rejected") {
        const errorMsg = errorCopy({ code: typeof payload.code === "string" ? payload.code : null });
        toast.error(errorMsg);
        const cmdId = "commandId" in message && typeof message.commandId === "string" ? message.commandId : "";
        set({ lastRejection: { commandId: cmdId, message: errorMsg } });
        return;
      }
      const requestId = typeof payload.requestId === "string" ? payload.requestId : null;
      const pending = requestId ? get().pendingChecks.find((item) => item.id === requestId) : undefined;
      const skillKey = pending ? coc7e.coc7eSkillLabel(pending.skillKey) : "鉴定";
      const hiddenRolled = payload.rolled === true && payload.hidden === true;
      if (requestId && hiddenRolled) {
        toast.success("已掷出");
      }
      if (requestId) {
        set((state) => {
          const patch: Partial<PlayState> = {
            pendingChecks: state.pendingChecks.filter((item) => item.id !== requestId),
          };
          if (hiddenRolled) {
            patch.messages = appendMessage(state.messages, {
              id: `check-ack-${requestId}`,
              speakerName: skillKey,
              speakerRoleLabel: "鉴定",
              avatarInitials: initialsOf(skillKey),
              avatarBg: "bg-default",
              avatarFg: "text-foreground",
              time: formatClock(Date.now()),
              body: `${skillKey} 已掷出`,
              tone: "ooc",
            });
          }
          return patch;
        });
      }
      return;
    }
    if ("eventId" in message && typeof message.eventId === "number" && "type" in message) {
      set((state) => ({
        lastEventId: Math.max(state.lastEventId, message.eventId),
        ...applyEvent(state, message.type, message.payload, message.eventId, "occurredAt" in message ? message.occurredAt : undefined),
      }));
      return;
    }
    if ("type" in message && message.type === "chat:queue") {
      const payload = message.payload as { messages?: ChatMessageDto[] };
      set({ pendingQueue: payload.messages ?? [] });
      return;
    }
    if ("type" in message && message.type === "presence:updated") {
      const payload = message.payload as { online?: OnlinePlayerDto[] };
      set({ presence: payload.online ?? [], presenceAvailable: true });
      return;
    }
    if ("type" in message && message.type === "audio:se") {
      set((state) => applyEvent(state, "audio:se", message.payload));
    }
  },
  setCatalog: (input) => {
    set((state) => ({
      catalogScenes: input.scenes ?? state.catalogScenes,
      catalogTracks: input.tracks ?? state.catalogTracks,
      catalogHandouts: input.handouts ?? state.catalogHandouts,
    }));
  },
  setConnected: (connected) => set({ connected }),
  setTerminal: (terminal) => set({ terminal }),
  markEnded: () => set({ status: "ended" }),
  setMuted: (muted) => set({ muted }),
  clearSeCue: () => set({ seCue: null }),
  reset: () => set({ ...empty }),
}));
