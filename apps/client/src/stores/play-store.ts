import type { SessionSnapshotPayload } from "@cogm/shared";
import { create } from "zustand";
import { applyCommandReply } from "./play/command-reply-handlers";
import { applyDirectEvent, applyEvent } from "./play/event-handlers";
import {
	audioDefaults,
	createAudioSlice,
	readAudioPreferences,
} from "./play/slices/audio-slice";
import {
	catalogDefaults,
	createCatalogSlice,
} from "./play/slices/catalog-slice";
import { chatDefaults } from "./play/slices/chat-slice";
import { checksDefaults, createChecksSlice } from "./play/slices/checks-slice";
import {
	createHandoutsSlice,
	handoutsDefaults,
} from "./play/slices/handouts-slice";
import {
	createHistorySlice,
	historyDefaults,
} from "./play/slices/history-slice";
import { presenceDefaults } from "./play/slices/presence-slice";
import {
	createSessionSlice,
	sessionDefaults,
} from "./play/slices/session-slice";
import { stageDefaults } from "./play/slices/stage-slice";
import { hydrateSnapshot } from "./play/snapshot-hydrator";
import type {
	CoordinatorSlice,
	PlaySliceCreator,
	PlayState,
} from "./play/types";

export { showCommandError } from "./play/command-reply-handlers";
export type { ConnectionTerminal } from "./play/slices/session-slice";
export type { PlayState } from "./play/types";

const coordinatorDefaults = {
	lastEventId: 0,
	lastRejection: null,
};

const empty = {
	...sessionDefaults,
	...stageDefaults,
	...chatDefaults,
	...audioDefaults,
	...handoutsDefaults,
	...presenceDefaults,
	...checksDefaults,
	...historyDefaults,
	...catalogDefaults,
	...coordinatorDefaults,
};

const createCoordinatorSlice: PlaySliceCreator<CoordinatorSlice> = (
	set,
	get,
) => ({
	...coordinatorDefaults,
	applySnapshot: (payload, watermark) =>
		set(hydrateSnapshot(get(), payload, watermark)),
	applyMessage: (message) => {
		if (message.type === "snapshot" && "watermark" in message) {
			get().applySnapshot(
				message.payload as SessionSnapshotPayload,
				message.watermark,
			);
			return;
		}
		if (
			"type" in message &&
			(message.type === "command:accepted" ||
				message.type === "command:rejected")
		) {
			applyCommandReply(set, get, message);
			return;
		}
		if (
			"eventId" in message &&
			typeof message.eventId === "number" &&
			"type" in message
		) {
			set((state) => ({
				lastEventId: Math.max(state.lastEventId, message.eventId),
				...applyEvent(
					state,
					message.type,
					message.payload,
					message.eventId,
					"occurredAt" in message ? message.occurredAt : undefined,
				),
			}));
			return;
		}
		applyDirectEvent(set, message.type, message.payload);
	},
	reset: () => set({ ...empty, ...readAudioPreferences() }),
});

export const usePlayStore = create<PlayState>((...args) => ({
	...createSessionSlice(...args),
	...stageDefaults,
	...chatDefaults,
	...createAudioSlice(...args),
	...createHandoutsSlice(...args),
	...presenceDefaults,
	...createChecksSlice(...args),
	...createHistorySlice(...args),
	...createCatalogSlice(...args),
	...createCoordinatorSlice(...args),
}));
