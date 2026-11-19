import type { CheckRequestDto } from "@cogm/shared";
import type { PlaySliceCreator } from "../types";

export type ChecksSlice = {
	pendingChecks: CheckRequestDto[];
	dismissedChecks: string[];
	dismissCheck: (requestId: string) => void;
	resumeChecks: () => void;
};

export const checksDefaults = {
	pendingChecks: [] as CheckRequestDto[],
	dismissedChecks: [] as string[],
};

export const createChecksSlice: PlaySliceCreator<ChecksSlice> = (set) => ({
	...checksDefaults,
	dismissCheck: (requestId) =>
		set((state) =>
			state.dismissedChecks.includes(requestId)
				? {}
				: { dismissedChecks: [...state.dismissedChecks, requestId] },
		),
	resumeChecks: () => set({ dismissedChecks: [] }),
});
