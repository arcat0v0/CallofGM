import {
	type SeatRole,
	type SessionPhase,
	type SessionSettings,
	SessionSettingsDefaults,
	type SessionStatus,
} from "@cogm/shared";
import type { PlaySliceCreator } from "../types";

export type ConnectionTerminal =
	| "kicked"
	| "loginExpired"
	| "unavailable"
	| "replaced"
	| "released";

export type SessionSlice = {
	sessionId: string | null;
	moduleId: string | null;
	moduleName: string | null;
	ruleId: string | null;
	sessionName: string | null;
	themeId: string | null;
	status: SessionStatus | null;
	phase: SessionPhase | null;
	settings: SessionSettings;
	viewer: {
		isGm: boolean;
		seatRole: SeatRole | null;
		holderKind: "user" | "anonymous" | null;
		holderId: string | null;
	};
	connected: boolean;
	snapshotReady: boolean;
	terminal: ConnectionTerminal | null;
	setConnected: (connected: boolean) => void;
	setTerminal: (terminal: ConnectionTerminal | null) => void;
	setThemeId: (themeId: string | null) => void;
	setStatus: (status: SessionStatus) => void;
	markEnded: () => void;
};

export const sessionDefaults = {
	sessionId: null as string | null,
	moduleId: null as string | null,
	moduleName: null as string | null,
	ruleId: null as string | null,
	sessionName: null as string | null,
	themeId: null as string | null,
	status: null as SessionStatus | null,
	phase: null as SessionPhase | null,
	settings: SessionSettingsDefaults,
	viewer: {
		isGm: false,
		seatRole: null,
		holderKind: null,
		holderId: null,
	} as SessionSlice["viewer"],
	connected: false,
	snapshotReady: false,
	terminal: null as ConnectionTerminal | null,
};

export const createSessionSlice: PlaySliceCreator<SessionSlice> = (set) => ({
	...sessionDefaults,
	setConnected: (connected) => set({ connected }),
	setTerminal: (terminal) => set({ terminal }),
	setThemeId: (themeId) => set({ themeId }),
	setStatus: (status) => set({ status }),
	markEnded: () => set({ status: "ended" }),
});
