export type {
	MusicService,
	MusicTrackAccessRepository,
} from "./application/ports";
export {
	MusicNotFoundError,
	MusicPlaylistEmptyError,
	MusicPlaylistNotFoundError,
	MusicPlaylistReferenceInvalidError,
	MusicProviderError,
	MusicProviderResponseInvalidError,
	MusicProviderTimeoutError,
	MusicRangeInvalidError,
	MusicReferenceInvalidError,
	MusicStreamTooLargeError,
	MusicUnavailableError,
} from "./domain/music-errors";
export { DrizzleMusicTrackAccessRepository } from "./infrastructure/drizzle-music-track-access-repository";
export {
	type MusicFetch,
	OfficialMusicService,
} from "./infrastructure/official-music-service";
export {
	parseMusicReference,
	parsePlaylistReference,
} from "./infrastructure/reference";
export { createMusicRoutes } from "./transport/routes";
