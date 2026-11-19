import type {
	BgmState,
	UpdateSessionSettingsCommand,
	UpdateStageLayoutCommand,
} from "@cogm/shared";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { DbClient } from "@/platform/db/client";
import {
	characterPortraits,
	mediaAssets,
	scenes,
	sessionAudioState,
	sessionCharacters,
	sessions,
	tracks,
} from "@/platform/db/schema";
import type { StageCommandRepository } from "../application/stage-command-repository";

export async function loadAudioState(
	db: DbClient,
	sessionId: string,
): Promise<BgmState | null> {
	const [row] = await db
		.select({
			audio: sessionAudioState,
			duration: tracks.duration,
			name: tracks.name,
			source: tracks.source,
			audioAssetId: tracks.audioAssetId,
			audioMimeType: mediaAssets.mimeType,
		})
		.from(sessionAudioState)
		.leftJoin(tracks, eq(sessionAudioState.trackId, tracks.id))
		.leftJoin(mediaAssets, eq(tracks.audioAssetId, mediaAssets.id))
		.where(eq(sessionAudioState.sessionId, sessionId));
	if (!row) {
		return null;
	}
	const audio = row.audio;
	return {
		trackId: audio.trackId ?? null,
		playing: audio.playing === 1,
		volume: audio.volume,
		mode: audio.mode,
		seekOffsetMs: audio.seekOffsetMs,
		startedAtMs: audio.startedAtMs,
		version: audio.version,
		durationMs: row.duration ?? 0,
		name: row.name ?? undefined,
		source: (row.source ?? undefined) as BgmState["source"],
		audioAssetId: row.audioAssetId ?? null,
		audioMimeType: row.audioMimeType ?? undefined,
		playbackUrl:
			audio.trackId && row.source
				? row.source === "upload"
					? `/api/v1/media/${row.audioAssetId}`
					: `/api/v1/music/tracks/${audio.trackId}/stream`
				: undefined,
	};
}

function sessionCharacterCondition(sessionId: string, characterId: string) {
	return and(
		eq(sessionCharacters.sessionId, sessionId),
		eq(sessionCharacters.characterId, characterId),
	);
}

const playbackTrackColumns = {
	id: tracks.id,
	name: tracks.name,
	duration: tracks.duration,
	source: tracks.source,
	audioAssetId: tracks.audioAssetId,
};

export class DrizzleStageCommandRepository implements StageCommandRepository {
	constructor(private readonly tx: DbClient) {}

	async findScene(sceneId: string) {
		const [scene] = await this.tx
			.select({
				id: scenes.id,
				moduleId: scenes.moduleId,
				name: scenes.name,
				bgAssetId: scenes.bgAssetId,
			})
			.from(scenes)
			.where(eq(scenes.id, sceneId));
		return scene ?? null;
	}

	async updateCurrentScene(sessionId: string, sceneId: string): Promise<void> {
		await this.tx
			.update(sessions)
			.set({ currentSceneId: sceneId })
			.where(eq(sessions.id, sessionId));
	}

	async hasSessionCharacter(
		sessionId: string,
		characterId: string,
	): Promise<boolean> {
		const rows = await this.tx
			.select({ id: sessionCharacters.id })
			.from(sessionCharacters)
			.where(sessionCharacterCondition(sessionId, characterId));
		return rows.length > 0;
	}

	async hasActiveExpression(
		characterId: string,
		expressionKey: string,
	): Promise<boolean> {
		const rows = await this.tx
			.select({ id: characterPortraits.id })
			.from(characterPortraits)
			.where(
				and(
					eq(characterPortraits.characterId, characterId),
					eq(characterPortraits.expressionKey, expressionKey),
					isNull(characterPortraits.deletedAt),
				),
			);
		return rows.length > 0;
	}

	async updateExpression(
		sessionId: string,
		characterId: string,
		expressionKey: string,
	): Promise<void> {
		await this.tx
			.update(sessionCharacters)
			.set({ currentExpressionKey: expressionKey })
			.where(sessionCharacterCondition(sessionId, characterId));
	}

	async updateStageLayout(
		sessionId: string,
		{ layout, scale }: UpdateStageLayoutCommand,
	): Promise<void> {
		await this.tx
			.update(sessions)
			.set({ portraitLayout: layout, portraitScale: scale })
			.where(eq(sessions.id, sessionId));
	}

	loadAudioState(sessionId: string): Promise<BgmState | null> {
		return loadAudioState(this.tx, sessionId);
	}

	async findTrack(trackId: string) {
		const [track] = await this.tx
			.select({
				...playbackTrackColumns,
				moduleId: tracks.moduleId,
				type: tracks.type,
				deletedAt: tracks.deletedAt,
			})
			.from(tracks)
			.where(eq(tracks.id, trackId));
		return track ?? null;
	}

	async listActiveBgmTracks(moduleId: string) {
		return this.tx
			.select(playbackTrackColumns)
			.from(tracks)
			.where(
				and(
					eq(tracks.moduleId, moduleId),
					eq(tracks.type, "bgm"),
					isNull(tracks.deletedAt),
				),
			)
			.orderBy(asc(tracks.createdAt), asc(tracks.id));
	}

	async findAudioMimeType(assetId: string): Promise<string | undefined> {
		const [asset] = await this.tx
			.select({ mimeType: mediaAssets.mimeType })
			.from(mediaAssets)
			.where(eq(mediaAssets.id, assetId));
		return asset?.mimeType;
	}

	async saveAudioState(
		sessionId: string,
		state: BgmState,
		createdAt: number,
		nextId: () => string,
	): Promise<void> {
		const condition = eq(sessionAudioState.sessionId, sessionId);
		const existing = await this.tx
			.select({ id: sessionAudioState.id })
			.from(sessionAudioState)
			.where(condition);
		const values = {
			trackId: state.trackId,
			playing: state.playing ? 1 : 0,
			volume: state.volume,
			mode: state.mode,
			seekOffsetMs: state.seekOffsetMs,
			startedAtMs: state.startedAtMs,
			version: state.version,
		};
		if (existing.length > 0) {
			await this.tx.update(sessionAudioState).set(values).where(condition);
		} else {
			await this.tx.insert(sessionAudioState).values({
				...values,
				id: nextId(),
				sessionId,
				createdAt,
			});
		}
	}

	async updateSessionSettings(
		sessionId: string,
		settings: UpdateSessionSettingsCommand,
	): Promise<void> {
		await this.tx
			.update(sessions)
			.set({
				sharePcSheets: settings.sharePcSheets ? 1 : 0,
				obSeePcState: settings.obSeePcState ? 1 : 0,
				diceSkin: settings.diceSkin,
			})
			.where(eq(sessions.id, sessionId));
	}

	async findActiveSessionCharacter(sessionId: string, characterId: string) {
		const [character] = await this.tx
			.select({
				kind: sessionCharacters.kind,
				stateJson: sessionCharacters.stateJson,
			})
			.from(sessionCharacters)
			.where(
				and(
					sessionCharacterCondition(sessionId, characterId),
					isNull(sessionCharacters.deletedAt),
				),
			);
		return character ?? null;
	}

	async updateNpcStateVisibility(
		sessionId: string,
		characterId: string,
		fields: string[],
	): Promise<void> {
		await this.tx
			.update(sessionCharacters)
			.set({ publicStateFieldsJson: JSON.stringify(fields) })
			.where(sessionCharacterCondition(sessionId, characterId));
	}
}
