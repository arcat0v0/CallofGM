import type { ServerMessage, SessionSnapshotPayload } from "@cogm/shared";
import type { StateCreator, StoreApi } from "zustand";
import type { AudioSlice } from "./slices/audio-slice";
import type { CatalogSlice } from "./slices/catalog-slice";
import type { ChatSlice } from "./slices/chat-slice";
import type { ChecksSlice } from "./slices/checks-slice";
import type { HandoutsSlice } from "./slices/handouts-slice";
import type { HistorySlice } from "./slices/history-slice";
import type { PresenceSlice } from "./slices/presence-slice";
import type { SessionSlice } from "./slices/session-slice";
import type { StageSlice } from "./slices/stage-slice";

export type CoordinatorSlice = {
	lastEventId: number;
	lastRejection: { commandId: string; message: string } | null;
	applySnapshot: (payload: SessionSnapshotPayload, watermark: number) => void;
	applyMessage: (message: ServerMessage) => void;
	reset: () => void;
};

export type PlayState = SessionSlice &
	StageSlice &
	ChatSlice &
	AudioSlice &
	HandoutsSlice &
	PresenceSlice &
	ChecksSlice &
	HistorySlice &
	CatalogSlice &
	CoordinatorSlice;

export type PlaySliceCreator<Slice> = StateCreator<PlayState, [], [], Slice>;
export type PlaySet = StoreApi<PlayState>["setState"];
export type PlayGet = StoreApi<PlayState>["getState"];

export function isEventPayload(
	value: unknown,
): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
