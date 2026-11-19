import type {
	MusicPlaylistDto,
	MusicProvider,
	MusicTrackDto,
} from "@cogm/shared";

export interface MusicProviderAdapter {
	readonly provider: MusicProvider;
	readonly referer: string;
	parseSongReference(reference: string): {
		externalId: string;
		sourceUrl: string;
	};
	parsePlaylistReference(reference: string): {
		playlistId: string;
		sourceUrl: string;
	};
	isAllowedAudioHost(hostname: string): boolean;
	isUnavailableRedirect?(url: URL): boolean;
	search(query: string, limit: number): Promise<MusicTrackDto[]>;
	fetchMetadata(
		externalId: string,
	): Promise<Pick<MusicTrackDto, "name" | "artists" | "album" | "durationMs">>;
	resolvePlaylist(
		playlistId: string,
		sourceUrl: string,
		offset: number,
		limit: number,
	): Promise<MusicPlaylistDto>;
	resolveStreamUrl(externalId: string): URL | Promise<URL>;
}
