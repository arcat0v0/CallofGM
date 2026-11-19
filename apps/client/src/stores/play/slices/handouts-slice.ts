import {
	type GrantedHandoutDto,
	type HandoutGrantDetailDto,
	HandoutGrantOverviewDto,
} from "@cogm/shared";
import type { PlaySet, PlaySliceCreator, PlayState } from "../types";
import { withActivityMessage } from "./chat-slice";

export type HandoutsSlice = {
	handouts: GrantedHandoutDto[];
	handoutGrants: HandoutGrantDetailDto[];
	markHandoutRead: (grantId: string) => void;
};

export const handoutsDefaults = {
	handouts: [] as GrantedHandoutDto[],
	handoutGrants: [] as HandoutGrantDetailDto[],
};

export const createHandoutsSlice: PlaySliceCreator<HandoutsSlice> = (set) => ({
	...handoutsDefaults,
	markHandoutRead: (grantId) =>
		set((state) => ({
			handouts: state.handouts.map((item) =>
				item.grantId === grantId ? { ...item, read: true } : item,
			),
		})),
});

export function reduceHandoutGrant(
	state: PlayState,
	payload: Record<string, unknown>,
	_type: string,
	eventId?: number,
	occurredAt?: number,
): Partial<PlayState> {
	const grant = (payload.grant ?? payload) as GrantedHandoutDto;
	if (!grant?.grantId) {
		return {};
	}
	if (state.handouts.some((item) => item.grantId === grant.grantId)) {
		return withActivityMessage(
			state,
			"handout:granted",
			payload,
			eventId,
			occurredAt,
			{
				handouts: state.handouts.map((item) =>
					item.grantId === grant.grantId ? grant : item,
				),
			},
		);
	}
	return withActivityMessage(
		state,
		"handout:granted",
		payload,
		eventId,
		occurredAt,
		{
			handouts: [...state.handouts, grant],
		},
	);
}

export function applyHandoutOverview(set: PlaySet, rawPayload: unknown): void {
	const overview = HandoutGrantOverviewDto.safeParse(rawPayload);
	if (overview.success) {
		set({ handoutGrants: overview.data.grants });
	}
}
