import {
	PortraitLayout,
	PortraitScale,
	type SnapshotCharacter,
	StageComposition,
	type StageComposition as StageCompositionType,
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
	stageComposition: StageCompositionType | null;
	stagePresets: StagePresetDto[];
	stageDraft: StageCompositionType | null;
	stageDraftBaseRevision: number;
	stageLiveRevision: number;
	stageLiveSync: boolean;
	characters: SnapshotCharacter[];
	ruleState: unknown;
	scene: { id: string; name: string; bgAssetId: string | null } | null;
};

export type StageSliceActions = {
	setStageDraft: (draft: StageCompositionType | null) => void;
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
				draft === null
					? state.stageLiveRevision
					: state.stageDraft === null
						? state.stageLiveRevision
						: state.stageDraftBaseRevision,
		})),
	clearStageDraft: () =>
		set((state) => ({
			stageDraft: null,
			stageDraftBaseRevision: state.stageLiveRevision,
		})),
	setStageLiveSync: (enabled) => set({ stageLiveSync: enabled }),
	setStagePresets: (presets) => set({ stagePresets: presets }),
});

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
	const layout = PortraitLayout.safeParse(payload.layout);
	const scale = PortraitScale.safeParse(payload.scale);
	const hasCompositionKey = "composition" in payload;
	const parsedComposition =
		hasCompositionKey && payload.composition !== null
			? StageComposition.safeParse(payload.composition)
			: null;
	if (parsedComposition && !parsedComposition.success) {
		return {};
	}
	if (!layout.success || !scale.success) {
		return {};
	}
	const nextComposition = hasCompositionKey
		? (parsedComposition?.data ?? null)
		: null;
	const nextRevision = state.stageLiveRevision + 1;
	const draftMatchesLive =
		state.stageDraft !== null &&
		nextComposition !== null &&
		stageCompositionsEqual(state.stageDraft, nextComposition);
	return {
		portraitLayout: layout.data,
		portraitScale: scale.data,
		stageComposition: nextComposition,
		stageLiveRevision: nextRevision,
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
