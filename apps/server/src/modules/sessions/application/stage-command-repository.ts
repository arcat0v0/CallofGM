import type {
	BgmState,
	PortraitLayout,
	PortraitScale,
	UpdateSessionSettingsCommand,
} from "@cogm/shared";
import type { DbClient } from "@/platform/db/client";

interface PlaybackTrack {
	id: string;
	name: string;
	duration: number;
	source: string;
	audioAssetId: string | null;
}

interface StageTrack extends PlaybackTrack {
	moduleId: string;
	type: string;
	deletedAt: number | null;
}

export interface StageCommandRepository {
	findScene(sceneId: string): Promise<{
		id: string;
		moduleId: string;
		name: string;
		bgAssetId: string | null;
	} | null>;
	updateCurrentScene(sessionId: string, sceneId: string): Promise<void>;
	hasSessionCharacter(sessionId: string, characterId: string): Promise<boolean>;
	hasActiveExpression(
		characterId: string,
		expressionKey: string,
	): Promise<boolean>;
	updateExpression(
		sessionId: string,
		characterId: string,
		expressionKey: string,
	): Promise<void>;
	listActiveSessionCharacterIds(sessionId: string): Promise<string[]>;
	updateStageLayout(
		sessionId: string,
		layout: {
			layout: PortraitLayout;
			scale: PortraitScale;
			stageCompositionJson: string | null;
		},
	): Promise<void>;
	loadAudioState(sessionId: string): Promise<BgmState | null>;
	findTrack(trackId: string): Promise<StageTrack | null>;
	listActiveBgmTracks(moduleId: string): Promise<PlaybackTrack[]>;
	findAudioMimeType(assetId: string): Promise<string | undefined>;
	saveAudioState(
		sessionId: string,
		state: BgmState,
		createdAt: number,
		nextId: () => string,
	): Promise<void>;
	updateSessionSettings(
		sessionId: string,
		settings: UpdateSessionSettingsCommand,
	): Promise<void>;
	findActiveSessionCharacter(
		sessionId: string,
		characterId: string,
	): Promise<{ kind: string; stateJson: string } | null>;
	updateNpcStateVisibility(
		sessionId: string,
		characterId: string,
		fields: string[],
	): Promise<void>;
}

export type StageCommandRepositoryFactory = (
	tx: DbClient,
) => StageCommandRepository;
