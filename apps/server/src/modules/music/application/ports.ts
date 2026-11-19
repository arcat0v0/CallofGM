import type {
	MusicPlaylistDto,
	MusicProvider,
	MusicTrackDto,
} from "@cogm/shared";
import type { ActorContext } from "@/modules/identity";

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

export interface MusicTrackAccess {
	source: string;
	externalId: string | null;
	moduleId: string;
	ownerId: string;
}

export interface MusicTrackAccessRepository {
	findById(id: string): Promise<MusicTrackAccess | undefined>;
	hasActiveClaim(moduleId: string, actor: ActorContext): Promise<boolean>;
}
