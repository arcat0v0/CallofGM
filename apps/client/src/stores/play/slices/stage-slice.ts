import {
	type PortraitLayout,
	type PortraitScale,
	type SnapshotCharacter,
	type StageComposition,
	StageLayoutChangedEvent,
	type StagePresetDto,
} from "@cogm/shared";
import { toast } from "sonner";
import { stageCompositionsEqual } from "@/features/session-stage/portrait-layout";
import { t } from "@/i18n";
import type { PlaySliceCreator, PlayState } from "../types";
import { withActivityMessage } from "./chat-slice";

export type StageSliceData = {
	portraitLayout: PortraitLayout;
	portraitScale: PortraitScale;
	stageComposition: StageComposition | null;
	stagePresets: StagePresetDto[];
	stageDraft: StageComposition | null;
	stageExpressionDraft: Record<string, string>;
	stageDraftBaseRevision: number;
	stageLiveRevision: number;
	stageLiveSync: boolean;
	characters: SnapshotCharacter[];
	ruleState: unknown;
	scene: { id: string; name: string; bgAssetId: string | null } | null;
};

export type StageSliceActions = {
	setStageDraft: (draft: StageComposition | null) => void;
	setStageExpressionDraft: (draft: Record<string, string>) => void;
	clearStageDraft: () => void;
	setStageLiveSync: (enabled: boolean) => void;
	setStagePresets: (presets: StagePresetDto[]) => void;
};

export type StageSlice = StageSliceData & StageSliceActions;

export const stageDefaults: StageSliceData = {
	portraitLayout: "auto",
	portraitScale: "md",
	stageComposition: null,
	stagePresets: [],
	stageDraft: null,
	stageExpressionDraft: {},
	stageDraftBaseRevision: 0,
	stageLiveRevision: 0,
	stageLiveSync: false,
	characters: [],
	ruleState: null,
	scene: null,
};

export const createStageSlice: PlaySliceCreator<StageSlice> = (set) => ({
	...stageDefaults,
	setStageDraft: (draft) =>
		set((state) => ({
			stageDraft: draft,
			stageDraftBaseRevision:
				!state.stageDraft &&
				Object.keys(state.stageExpressionDraft).length === 0
					? state.stageLiveRevision
					: state.stageDraftBaseRevision,
		})),
	setStageExpressionDraft: (draft) =>
		set((state) => ({
			stageExpressionDraft: draft,
			stageDraftBaseRevision:
				!state.stageDraft &&
				Object.keys(state.stageExpressionDraft).length === 0
					? state.stageLiveRevision
					: state.stageDraftBaseRevision,
		})),
	clearStageDraft: () =>
		set((state) => ({
			stageDraft: null,
			stageExpressionDraft: {},
			stageDraftBaseRevision: state.stageLiveRevision,
		})),
	setStageLiveSync: (enabled) => set({ stageLiveSync: enabled }),
	setStagePresets: (presets) => set({ stagePresets: presets }),
});

export function keepUnappliedStageExpressions(
	draft: Record<string, string>,
	characters: SnapshotCharacter[],
): Record<string, string> {
	return Object.fromEntries(
		characters.flatMap(({ characterId, currentExpressionKey }) => {
			const expressionKey = draft[characterId];
			return expressionKey && expressionKey !== currentExpressionKey
				? [[characterId, expressionKey]]
				: [];
		}),
	);
}

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
	state: PlayState,
	payload: Record<string, unknown>,
): Partial<StageSliceData> {
	const parsed = StageLayoutChangedEvent.safeParse(payload);
	if (!parsed.success) return {};
	const {
		layout,
		scale,
		composition: nextComposition = null,
		expressions,
	} = parsed.data;
	const expressionsById = new Map(
		expressions?.map(({ characterId, expressionKey }) => [
			characterId,
			expressionKey,
		]),
	);
	const characters = expressionsById.size
		? state.characters.map((character) => {
				const expressionKey = expressionsById.get(character.characterId);
				return expressionKey
					? { ...character, currentExpressionKey: expressionKey }
					: character;
			})
		: state.characters;
	const nextRevision = state.stageLiveRevision + 1;
	const draftMatchesLive =
		state.stageDraft !== null &&
		nextComposition !== null &&
		stageCompositionsEqual(state.stageDraft, nextComposition);
	return {
		portraitLayout: layout,
		portraitScale: scale,
		stageComposition: nextComposition,
		stageLiveRevision: nextRevision,
		characters,
		stageExpressionDraft: keepUnappliedStageExpressions(
			state.stageExpressionDraft,
			characters,
		),
		...(draftMatchesLive
			? { stageDraft: null, stageDraftBaseRevision: nextRevision }
			: {}),
	};
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
		{
			characters: nextCharacters,
			stageExpressionDraft: keepUnappliedStageExpressions(
				state.stageExpressionDraft,
				nextCharacters,
			),
		},
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
): Partial<StageSliceData> {
	return { ruleState: payload.state ?? null };
}

export function reduceStateHint(
	state: StageSlice,
	payload: Record<string, unknown>,
): Partial<StageSliceData> {
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
