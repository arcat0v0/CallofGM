import type {
	MusicPlaylistDto,
	MusicProvider,
	MusicTrackDto,
} from "@cogm/shared";

export interface MusicService {
	search(
		provider: MusicProvider,
		query: string,
		limit: number,
	): Promise<MusicTrackDto[]>;
	resolve(provider: MusicProvider, reference: string): Promise<MusicTrackDto>;
	resolvePlaylist(
		provider: MusicProvider,
		reference: string,
		offset: number,
		limit: number,
	): Promise<MusicPlaylistDto>;
	openStream(
		provider: MusicProvider,
		externalId: string,
		range?: string,
	): Promise<Response>;
}
