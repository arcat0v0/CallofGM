import type {
	MusicPlaylistDto,
	MusicProvider,
	MusicTrackDto,
	TrackDto,
} from "@cogm/shared";
import { api } from "@/lib/api";

export async function searchMusic(
	provider: MusicProvider,
	query: string,
	limit = 10,
): Promise<MusicTrackDto[]> {
	const params = new URLSearchParams({
		provider,
		query,
		limit: String(limit),
	});
	const response = await api<{ items: MusicTrackDto[] }>(
		`/gm/music/search?${params.toString()}`,
	);
	return response.items;
}

export function resolveMusic(
	provider: MusicProvider,
	reference: string,
): Promise<MusicTrackDto> {
	return api<MusicTrackDto>("/gm/music/resolve", {
		method: "POST",
		body: JSON.stringify({ provider, reference }),
	});
}

export function resolveMusicPlaylist(
	provider: MusicProvider,
	reference: string,
	offset = 0,
	limit = 50,
): Promise<MusicPlaylistDto> {
	return api<MusicPlaylistDto>("/gm/music/playlists/resolve", {
		method: "POST",
		body: JSON.stringify({ provider, reference, offset, limit }),
	});
}

export function addExternalTrack(
	moduleId: string,
	provider: MusicProvider,
	reference: string,
	type: TrackDto["type"],
): Promise<TrackDto> {
	return api<TrackDto>(`/gm/modules/${encodeURIComponent(moduleId)}/tracks`, {
		method: "POST",
		body: JSON.stringify({ source: provider, reference, type }),
	});
}
