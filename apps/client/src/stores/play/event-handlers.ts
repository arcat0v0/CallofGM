import {
	type ChatMessageDto,
	type CheckRequestDto,
	DiceSealedEvent,
	type DirectControlMessageType,
	RewindEvent,
	SessionSettingsChangedEvent,
} from "@cogm/shared";
import { toast } from "sonner";
import { t } from "@/i18n";
import {
	mapActivityEvent,
	mapChatMessage,
	resolveActivityPayload,
} from "@/lib/chat-map";
import { reduceBgm, reduceSeCue } from "./slices/audio-slice";
import {
	appendLiveMessage,
	appendMessage,
	applyChatQueue,
	applyPendingChat,
	applyRejectedChat,
	withActivityMessage,
} from "./slices/chat-slice";
import {
	applyHandoutOverview,
	reduceHandoutGrant,
} from "./slices/handouts-slice";
import { applyKick, applyPresence } from "./slices/presence-slice";
import {
	characterStatePatch,
	reduceCharacterActivity,
	reduceExpression,
	reduceLayout,
	reduceRuleState,
	reduceScene,
	reduceStateHint,
} from "./slices/stage-slice";
import { isEventPayload, type PlaySet, type PlayState } from "./types";

type EventType =
	| "chat:message"
	| "dice:rolled"
	| "dice:sealed"
	| "check:amended"
	| "check:resolved"
	| "session:status-changed"
	| "session:settings-changed"
	| "session:phase-changed"
	| "scene:changed"
	| "stage:layout-changed"
	| "expression:changed"
	| "audio:bgm"
	| "handout:granted"
	| "check:requested"
	| "state:changed"
	| "luck:recovered"
	| "state:public-changed"
	| "npc:state-visibility-changed"
	| "rule:state-changed"
	| "state:hint"
	| "session:rewound"
	| "audio:se";

type EventReducer = (
	state: PlayState,
	payload: Record<string, unknown>,
	type: EventType,
	eventId?: number,
	occurredAt?: number,
) => Partial<PlayState>;

const reduceRollActivity: EventReducer = (
	state,
	payload,
	type,
	eventId,
	occurredAt,
) => {
	if (type === "dice:sealed" && !DiceSealedEvent.safeParse(payload).success) {
		return {};
	}
	const activityPayload = resolveActivityPayload(
		type,
		payload,
		state.characters,
	);
	const next = mapActivityEvent(
		type,
		activityPayload,
		eventId ?? Date.now(),
		occurredAt,
		state.characters,
		{ isGm: state.viewer.isGm },
	);
	const patch: Partial<PlayState> = {
		messages: appendMessage(state.messages, next),
	};
	if (type === "check:resolved") {
		const requestId =
			typeof payload.requestId === "string" ? payload.requestId : null;
		if (requestId) {
			patch.pendingChecks = state.pendingChecks.filter(
				(item) => item.id !== requestId,
			);
			patch.dismissedChecks = state.dismissedChecks.filter(
				(item) => item !== requestId,
			);
		}
	}
	return patch;
};

const eventHandlers: Record<EventType, EventReducer> = {
	"dice:rolled": reduceRollActivity,
	"dice:sealed": reduceRollActivity,
	"check:amended": reduceRollActivity,
	"check:resolved": reduceRollActivity,
	"state:public-changed": characterStatePatch,
	"npc:state-visibility-changed": characterStatePatch,
	"audio:se": (_state, payload) => reduceSeCue(payload),
	"chat:message": (state, payload) => {
		const dto = (payload.message ?? payload) as ChatMessageDto;
		if (!dto?.id) {
			return {};
		}
		return {
			messages: appendLiveMessage(state.messages, mapChatMessage(dto)),
		};
	},
	"session:status-changed": (_state, payload) => {
		const status = payload.status;
		if (
			status === "waiting" ||
			status === "preparing" ||
			status === "active" ||
			status === "ended"
		) {
			return { status };
		}
		return {};
	},
	"session:settings-changed": (_state, payload) => {
		const parsed = SessionSettingsChangedEvent.safeParse(payload);
		if (!parsed.success) {
			return {};
		}
		return {
			settings: parsed.data,
		};
	},
	"session:phase-changed": (state, payload, type, eventId, occurredAt) => {
		const phase = payload.phase;
		if (
			phase === "free_discussion" ||
			phase === "performance_time" ||
			phase === "forced_cg" ||
			phase === "free_performance"
		) {
			return withActivityMessage(state, type, payload, eventId, occurredAt, {
				phase,
			});
		}
		return {};
	},
	"scene:changed": reduceScene,
	"stage:layout-changed": reduceLayout,
	"expression:changed": reduceExpression,
	"audio:bgm": reduceBgm,
	"handout:granted": reduceHandoutGrant,
	"check:requested": (state, payload) => {
		const request = (payload.request ?? payload) as CheckRequestDto;
		if (!request?.id) {
			return {};
		}
		if (state.pendingChecks.some((item) => item.id === request.id)) {
			return {};
		}
		return { pendingChecks: [...state.pendingChecks, request] };
	},
	"state:changed": reduceCharacterActivity,
	"luck:recovered": (state, payload, type, eventId, occurredAt) => {
		return withActivityMessage(state, type, payload, eventId, occurredAt, {});
	},
	"rule:state-changed": reduceRuleState,
	"state:hint": reduceStateHint,
	"session:rewound": (_state, payload, _type, eventId, occurredAt) => {
		const rewind = RewindEvent.safeParse(payload);
		if (!rewind.success) {
			return {};
		}
		toast.info(
			rewind.data.action === "rewind"
				? t("history.rewoundNotice")
				: t("history.undoNotice"),
		);
		return {
			lastRewind: {
				id: rewind.data.rewindId,
				action: rewind.data.action,
				eventId: eventId ?? 0,
				anchorEventId: rewind.data.anchorEventId,
				occurredAt: occurredAt ?? Date.now(),
			},
			lastRewindSeenId: eventId ?? 0,
		};
	},
};

export function applyEvent(
	state: PlayState,
	type: string,
	payload: unknown,
	eventId?: number,
	occurredAt?: number,
): Partial<PlayState> {
	if (!isEventPayload(payload) || !Object.hasOwn(eventHandlers, type)) {
		return {};
	}
	const eventType = type as EventType;
	return eventHandlers[eventType](
		state,
		payload,
		eventType,
		eventId,
		occurredAt,
	);
}

type DirectEventType =
	| Exclude<
			(typeof DirectControlMessageType.options)[number],
			"session:refresh"
	  >
	| "audio:se";

const directEventHandlers: Record<
	DirectEventType,
	(set: PlaySet, payload: unknown) => void
> = {
	"chat:pending": applyPendingChat,
	"chat:rejected": applyRejectedChat,
	"chat:queue": applyChatQueue,
	"handout:grants": applyHandoutOverview,
	"presence:updated": applyPresence,
	"session:kicked": applyKick,
	"audio:se": (set, payload) => {
		set(() => reduceSeCue(payload));
	},
};

export function applyDirectEvent(
	set: PlaySet,
	type: string,
	payload: unknown,
): void {
	if (Object.hasOwn(directEventHandlers, type)) {
		directEventHandlers[type as DirectEventType](set, payload);
	}
}
