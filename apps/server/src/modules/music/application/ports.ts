import type { MusicProvider, MusicTrackDto } from "@cogm/shared";

export interface MusicService {
	search(
		provider: MusicProvider,
		query: string,
		limit: number,
	): Promise<MusicTrackDto[]>;
	resolve(provider: MusicProvider, reference: string): Promise<MusicTrackDto>;
	openStream(
		provider: MusicProvider,
		externalId: string,
		range?: string,
	): Promise<Response>;
}
