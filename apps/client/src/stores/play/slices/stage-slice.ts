import {
	PortraitLayout,
	PortraitScale,
	type SnapshotCharacter,
} from "@cogm/shared";
import { toast } from "sonner";
import { t } from "@/i18n";
import type { PlayState } from "../types";
import { withActivityMessage } from "./chat-slice";

export type StageSlice = {
	portraitLayout: PortraitLayout;
	portraitScale: PortraitScale;
	characters: SnapshotCharacter[];
	ruleState: unknown;
	scene: { id: string; name: string; bgAssetId: string | null } | null;
};

export const stageDefaults: StageSlice = {
	portraitLayout: "auto",
	portraitScale: "md",
	characters: [],
	ruleState: null,
	scene: null,
};

export function characterStatePatch(
	state: StageSlice,
	payload: Record<string, unknown>,
): Partial<StageSlice> {
	const characterId =
		typeof payload.characterId === "string" ? payload.characterId : null;
	if (!characterId) {
		return {};
	}
	return {
		characters: state.characters.map((character) =>
			character.characterId === characterId
				? {
						...character,
						state:
							payload.state === undefined ? character.state : payload.state,
						publicState:
							payload.publicState === undefined
								? character.publicState
								: payload.publicState,
						publicStateFields:
							payload.publicStateFields === undefined
								? character.publicStateFields
								: Array.isArray(payload.publicStateFields)
									? payload.publicStateFields.filter(
											(field): field is string => typeof field === "string",
										)
									: undefined,
					}
				: character,
		),
	};
}

export function reduceScene(
	state: PlayState,
	payload: Record<string, unknown>,
	_type: string,
	eventId?: number,
	occurredAt?: number,
): Partial<PlayState> {
	const id =
		typeof payload.sceneId === "string"
			? payload.sceneId
			: typeof payload.id === "string"
				? payload.id
				: null;
	const name = typeof payload.name === "string" ? payload.name : "";
	if (!id) {
		return {};
	}
	return withActivityMessage(
		state,
		"scene:changed",
		payload,
		eventId,
		occurredAt,
		{
			scene: {
				id,
				name,
				bgAssetId:
					typeof payload.bgAssetId === "string" ? payload.bgAssetId : null,
			},
		},
	);
}

export function reduceLayout(
	_state: PlayState,
	payload: Record<string, unknown>,
): Partial<StageSlice> {
	const layout = PortraitLayout.safeParse(payload.layout);
	const scale = PortraitScale.safeParse(payload.scale);
	if (!layout.success || !scale.success) {
		return {};
	}
	return { portraitLayout: layout.data, portraitScale: scale.data };
}

export function reduceExpression(
	state: PlayState,
	payload: Record<string, unknown>,
	_type: string,
	eventId?: number,
	occurredAt?: number,
): Partial<PlayState> {
	const characterId =
		typeof payload.characterId === "string" ? payload.characterId : null;
	const expressionKey =
		typeof payload.expressionKey === "string" ? payload.expressionKey : null;
	if (!characterId || !expressionKey) {
		return {};
	}
	const nextCharacters = state.characters.map((character) =>
		character.characterId === characterId
			? { ...character, currentExpressionKey: expressionKey }
			: character,
	);
	return withActivityMessage(
		state,
		"expression:changed",
		payload,
		eventId,
		occurredAt,
		{ characters: nextCharacters },
		nextCharacters,
	);
}

export function reduceCharacterActivity(
	state: PlayState,
	payload: Record<string, unknown>,
	_type: string,
	eventId?: number,
	occurredAt?: number,
): Partial<PlayState> {
	const patch = characterStatePatch(state, payload);
	return patch.characters && state.viewer.isGm
		? withActivityMessage(
				state,
				"state:changed",
				payload,
				eventId,
				occurredAt,
				patch,
			)
		: patch;
}

export function reduceRuleState(
	_state: PlayState,
	payload: Record<string, unknown>,
): Partial<StageSlice> {
	return { ruleState: payload.state ?? null };
}

export function reduceStateHint(
	state: StageSlice,
	payload: Record<string, unknown>,
): Partial<StageSlice> {
	const characterId =
		typeof payload.characterId === "string" ? payload.characterId : null;
	const name =
		state.characters.find((character) => character.characterId === characterId)
			?.name ?? t("chat.role.character");
	const hints = Array.isArray(payload.hints)
		? payload.hints.filter((item): item is string => typeof item === "string")
		: [];
	for (const hint of hints) {
		toast.warning(`${name}：${hint}`);
	}
	return {};
}
