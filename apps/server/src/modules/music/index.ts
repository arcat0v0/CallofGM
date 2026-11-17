export type { MusicService } from "./application/ports";
export {
	MusicNotFoundError,
	MusicProviderError,
	MusicProviderResponseInvalidError,
	MusicProviderTimeoutError,
	MusicRangeInvalidError,
	MusicReferenceInvalidError,
	MusicStreamTooLargeError,
	MusicUnavailableError,
} from "./domain/music-errors";
export {
	type MusicFetch,
	OfficialMusicService,
} from "./infrastructure/official-music-service";
export { parseMusicReference } from "./infrastructure/reference";
export { createMusicRoutes } from "./transport/routes";
