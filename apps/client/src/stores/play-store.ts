import { create } from "zustand";
import { toast } from "sonner";
import {
  coc7e,
  HISTORY_DEFAULT_LIMIT,
  HistoryPageReply,
  type BgmState,
  type CatalogHandoutDto,
  type ChatMessageDto,
  type CheckRequestDto,
  type GrantedHandoutDto,
  type HistoryPage,
  type KickedPlayerDto,
  type OnlinePlayerDto,
  type SceneDto,
  type SePlayedEvent,
  type ServerMessage,
  type SessionPhase,
  type SessionSettings,
  type SessionSnapshotPayload,
  SessionSettingsDefaults,
  type SessionStatus,
  type SeatRole,
  type SnapshotCharacter,
  type TrackDto,
} from "@cogm/shared";
import type { ChatMessage } from "@/features/chat/types";
import { mapActivityEvent, mapChatMessage, mapHistoryItem, resolveActivityPayload } from "@/lib/chat-map";
import { errorCopy } from "@/lib/error-copy";
import { formatClock, initialsOf } from "@/lib/format";
import { LOCAL_VOLUME_DEFAULT, normalizeLocalVolume } from "@/lib/local-volume";
import { sendSessionCommand } from "@/lib/session-socket";
import { readLocalMuted, readLocalVolume, writeLocalMuted, writeLocalVolume } from "@/lib/storage";

export type ConnectionTerminal = "kicked" | "unavailable" | "replaced";

type PlayState = {
  sessionId: string | null;
  moduleId: string | null;
  moduleName: string | null;
  sessionName: string | null;
  status: SessionStatus | null;
  phase: SessionPhase | null;
  lastEventId: number;
  settings: SessionSettings;
  viewer: { isGm: boolean; seatRole: SeatRole | null };
  characters: SnapshotCharacter[];
  messages: ChatMessage[];
  pendingQueue: ChatMessageDto[];
  bgm: BgmState | null;
  scene: { id: string; name: string; bgAssetId: string | null } | null;
  handouts: GrantedHandoutDto[];
  presence: OnlinePlayerDto[];
  presenceAvailable: boolean;
  kickedPlayers: KickedPlayerDto[];
  kickedReason: string | null;
  pendingChecks: CheckRequestDto[];
  dismissedChecks: string[];
  catalogScenes: SceneDto[];
  catalogTracks: TrackDto[];
  catalogHandouts: CatalogHandoutDto[];
  seCue: SePlayedEvent | null;
  bgmTransitionMs: number;
  muted: boolean;
  localVolume: number;
  connected: boolean;
  snapshotReady: boolean;
  terminal: ConnectionTerminal | null;
  lastRejection: { commandId: string; message: string } | null;
  historyBeforeEventId: number | null;
  historyHasMore: boolean;
  historyLoading: boolean;
  historyCommandId: string | null;
  historyPagesLoaded: number;
  applySnapshot: (payload: SessionSnapshotPayload, watermark: number) => void;
  applyMessage: (message: ServerMessage) => void;
  setCatalog: (input: { scenes?: SceneDto[]; tracks?: TrackDto[]; handouts?: CatalogHandoutDto[] }) => void;
  setConnected: (connected: boolean) => void;
  setTerminal: (terminal: ConnectionTerminal | null) => void;
  markEnded: () => void;
  markHandoutRead: (grantId: string) => void;
  dismissCheck: (requestId: string) => void;
  resumeChecks: () => void;
  setMuted: (muted: boolean) => void;
  setLocalVolume: (localVolume: number) => void;
  clearSeCue: () => void;
  loadOlderHistory: () => void;
  reset: () => void;
};

const empty = {
  sessionId: null as string | null,
  moduleId: null as string | null,
  moduleName: null as string | null,
  sessionName: null as string | null,
  status: null as SessionStatus | null,
  phase: null as SessionPhase | null,
  lastEventId: 0,
  settings: SessionSettingsDefaults,
  viewer: { isGm: false, seatRole: null } as PlayState["viewer"],
  characters: [] as SnapshotCharacter[],
  messages: [] as ChatMessage[],
  pendingQueue: [] as ChatMessageDto[],
  bgm: null as BgmState | null,
  scene: null as PlayState["scene"],
  handouts: [] as GrantedHandoutDto[],
  presence: [] as OnlinePlayerDto[],
  presenceAvailable: false,
  kickedPlayers: [] as KickedPlayerDto[],
  kickedReason: null as string | null,
  pendingChecks: [] as CheckRequestDto[],
  dismissedChecks: [] as string[],
  catalogScenes: [] as SceneDto[],
  catalogTracks: [] as TrackDto[],
  catalogHandouts: [] as CatalogHandoutDto[],
  seCue: null as SePlayedEvent | null,
  bgmTransitionMs: 400,
  muted: false,
  localVolume: LOCAL_VOLUME_DEFAULT,
  connected: false,
  snapshotReady: false,
  terminal: null as ConnectionTerminal | null,
  lastRejection: null as { commandId: string; message: string } | null,
  historyBeforeEventId: null as number | null,
  historyHasMore: false,
  historyLoading: false,
  historyCommandId: null as string | null,
  historyPagesLoaded: 0,
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

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) {
    return current;
  }
  const byId = new Map<string, ChatMessage>();
  for (const message of current) {
    byId.set(message.id, message);
  }
  for (const message of incoming) {
    if (!byId.has(message.id)) {
      byId.set(message.id, message);
    }
  }
  return [...byId.values()].sort((a, b) => a.sortKey - b.sortKey);
}

function mapHistoryItems(items: HistoryPage["items"], characters: SnapshotCharacter[]): ChatMessage[] {
  return items
    .map((item) => mapHistoryItem(item, characters))
    .filter((message): message is ChatMessage => message !== null);
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
      const activityPayload = resolveActivityPayload(type, payload, state.characters);
      const next = mapActivityEvent(type, activityPayload, eventId ?? Date.now(), occurredAt);
      const patch: Partial<PlayState> = { messages: appendMessage(state.messages, next) };
      if (type === "check:resolved") {
        const requestId = typeof payload.requestId === "string" ? payload.requestId : null;
        if (requestId) {
          patch.pendingChecks = state.pendingChecks.filter((item) => item.id !== requestId);
          patch.dismissedChecks = state.dismissedChecks.filter((item) => item !== requestId);
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
    case "session:settings-changed": {
      if (typeof payload.sharePcSheets !== "boolean" || typeof payload.obSeePcState !== "boolean") {
        return {};
      }
      return {
        settings: {
          sharePcSheets: payload.sharePcSheets,
          obSeePcState: payload.obSeePcState,
        },
      };
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
  localVolume: readLocalVolume(),
  muted: readLocalMuted(),
  applySnapshot: (payload, watermark) => {
    const merged = mergeMessages([], mapHistoryItems(payload.recentHistory, payload.characters));
    set({
      sessionId: payload.session.id,
      moduleId: payload.session.moduleId,
      moduleName: payload.session.moduleName,
      sessionName: payload.session.name,
      status: payload.session.status,
      phase: payload.session.phase,
      lastEventId: watermark,
      settings: payload.session.settings,
      viewer: payload.viewer,
      characters: payload.characters,
      messages: merged,
      pendingQueue: payload.pendingQueue ?? [],
      bgm: payload.bgm,
      scene: payload.currentScene,
      handouts: payload.visibleHandouts,
      presence: payload.online ?? [],
      presenceAvailable: payload.online !== undefined,
      kickedPlayers: payload.kickedPlayers ?? [],
      pendingChecks: payload.pendingCheckRequests,
      dismissedChecks: [],
      connected: true,
      snapshotReady: true,
      terminal: null,
      historyBeforeEventId: payload.history.beforeEventId,
      historyHasMore: payload.history.hasMore,
      historyLoading: false,
      historyCommandId: null,
      historyPagesLoaded: 0,
    });
  },
  applyMessage: (message) => {
    if (message.type === "snapshot" && "watermark" in message) {
      get().applySnapshot(message.payload as SessionSnapshotPayload, message.watermark);
      return;
    }
    if ("type" in message && (message.type === "command:accepted" || message.type === "command:rejected")) {
      const payload = isRecord(message.payload) ? message.payload : {};
      const commandId = "commandId" in message && typeof message.commandId === "string" ? message.commandId : "";
      if (message.type === "command:rejected") {
        const errorMsg = errorCopy({ code: typeof payload.code === "string" ? payload.code : null });
        toast.error(errorMsg);
        set({
          lastRejection: { commandId, message: errorMsg },
          ...(commandId === get().historyCommandId ? { historyLoading: false, historyCommandId: null } : {}),
        });
        return;
      }
      const historyReply = HistoryPageReply.safeParse(message.payload);
      if (historyReply.success) {
        set((state) => {
          if (commandId !== state.historyCommandId) {
            return {};
          }
          const page = historyReply.data.history;
          return {
            messages: mergeMessages(state.messages, mapHistoryItems(page.items, state.characters)),
            historyBeforeEventId: page.beforeEventId,
            historyHasMore: page.hasMore,
            historyLoading: false,
            historyCommandId: null,
            historyPagesLoaded: state.historyPagesLoaded + 1,
          };
        });
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
            dismissedChecks: state.dismissedChecks.filter((item) => item !== requestId),
          };
          if (hiddenRolled) {
            patch.messages = appendMessage(state.messages, {
              id: `check-ack-${requestId}`,
              sortKey: state.lastEventId,
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
      const payload = message.payload as { online?: OnlinePlayerDto[]; kickedPlayers?: KickedPlayerDto[] };
      set({
        presence: payload.online ?? [],
        presenceAvailable: true,
        ...(payload.kickedPlayers ? { kickedPlayers: payload.kickedPlayers } : {}),
      });
      return;
    }
    if ("type" in message && message.type === "session:kicked") {
      const payload = isRecord(message.payload) ? message.payload : {};
      const reason = typeof payload.reason === "string" ? payload.reason : null;
      set({ terminal: "kicked", kickedReason: reason, connected: false });
      toast.error("主持人尚未解除禁入，暂时无法进入本团");
      return;
    }
    if ("type" in message && message.type === "audio:se") {
      set((state) => applyEvent(state, "audio:se", message.payload));
    }
  },
  loadOlderHistory: () => {
    const state = get();
    if (state.historyLoading || !state.historyHasMore) {
      return;
    }
    const commandId = sendSessionCommand("history:page", {
      beforeEventId: state.historyBeforeEventId ?? undefined,
      limit: HISTORY_DEFAULT_LIMIT,
    });
    if (!commandId) {
      toast.error("尚未连接到团");
      return;
    }
    set({ historyLoading: true, historyCommandId: commandId });
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
  markHandoutRead: (grantId) =>
    set((state) => ({
      handouts: state.handouts.map((item) => (item.grantId === grantId ? { ...item, read: true } : item)),
    })),
  dismissCheck: (requestId) =>
    set((state) =>
      state.dismissedChecks.includes(requestId)
        ? {}
        : { dismissedChecks: [...state.dismissedChecks, requestId] },
    ),
  resumeChecks: () => set({ dismissedChecks: [] }),
  setMuted: (muted) => {
    writeLocalMuted(muted);
    set({ muted });
  },
  setLocalVolume: (localVolume) => {
    const next = normalizeLocalVolume(localVolume);
    writeLocalVolume(next);
    set({ localVolume: next });
  },
  clearSeCue: () => set({ seCue: null }),
  reset: () => set({ ...empty, localVolume: readLocalVolume(), muted: readLocalMuted() }),
}));
