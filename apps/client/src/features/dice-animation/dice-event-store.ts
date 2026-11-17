import type { SessionEvent } from "@cogm/shared";
import { create } from "zustand";

type DiceEventState = {
	latest: SessionEvent | null;
	activeId: number | null;
	observe: (message: SessionEvent) => void;
	setActive: (eventId: number | null) => void;
};

const useDiceEventStore = create<DiceEventState>((set) => ({
	latest: null,
	activeId: null,
	observe: (message) => set({ latest: message }),
	setActive: (eventId) => set({ activeId: eventId }),
}));

export { useDiceEventStore };
