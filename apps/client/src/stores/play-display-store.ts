import { create } from "zustand";
import {
	PLAY_DISPLAY_DEFAULTS,
	type PlayDisplayKey,
	type PlayDisplaySettings,
	readPlayDisplay,
	writePlayDisplay,
} from "@/lib/storage";

type PlayDisplayState = {
	settings: PlayDisplaySettings;
	setVisible: (key: PlayDisplayKey, visible: boolean) => void;
	reset: () => void;
};

export const usePlayDisplayStore = create<PlayDisplayState>((set) => ({
	settings: readPlayDisplay(),
	setVisible: (key, visible) =>
		set((state) => {
			const settings = { ...state.settings, [key]: visible };
			writePlayDisplay(settings);
			return { settings };
		}),
	reset: () => {
		const settings = { ...PLAY_DISPLAY_DEFAULTS };
		writePlayDisplay(settings);
		set({ settings });
	},
}));
