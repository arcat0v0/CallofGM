import type {
	MusicPlaylistDto,
	MusicProvider,
	MusicTrackDto,
} from "@cogm/shared";
import type { MusicService } from "../application/ports";
import { MusicProviderResponseInvalidError } from "../domain/music-errors";
import { MusicHttpClient } from "./music-http-client";
import { NeteaseMusicAdapter } from "./netease-music-adapter";
import type { MusicProviderAdapter } from "./provider-adapter";
import { QqMusicAdapter } from "./qq-music-adapter";

export type MusicFetch = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>;

export class OfficialMusicService implements MusicService {
	private readonly http: MusicHttpClient;
	private readonly adapters: Record<MusicProvider, MusicProviderAdapter>;

	constructor(
		fetchImpl: MusicFetch = fetch,
		options: { timeoutMs?: number; maxBytes?: number } = {},
	) {
		this.http = new MusicHttpClient(fetchImpl, options);
		this.adapters = {
			netease: new NeteaseMusicAdapter(this.http),
			qq: new QqMusicAdapter(this.http),
		};
	}

	async search(
		provider: MusicProvider,
		query: string,
		limit: number,
	): Promise<MusicTrackDto[]> {
		return this.adapters[provider].search(query, limit);
	}

	async resolve(
		provider: MusicProvider,
		reference: string,
	): Promise<MusicTrackDto> {
		const adapter = this.adapters[provider];
		const { externalId, sourceUrl } = adapter.parseSongReference(reference);
		const metadata = await adapter.fetchMetadata(externalId);
		const response = await this.openStream(provider, externalId, "bytes=0-0");
		if (!response.body) {
			throw new MusicProviderResponseInvalidError();
		}
		const reader = response.body.getReader();
		const first = await reader.read();
		await reader.cancel();
		if (!first.value || first.value.byteLength === 0) {
			throw new MusicProviderResponseInvalidError();
		}
		return {
			provider,
			externalId,
			...metadata,
			sourceUrl,
			availability: "available",
		};
	}

	async resolvePlaylist(
		provider: MusicProvider,
		reference: string,
		offset: number,
		limit: number,
	): Promise<MusicPlaylistDto> {
		const adapter = this.adapters[provider];
		const { playlistId, sourceUrl } = adapter.parsePlaylistReference(reference);
		return adapter.resolvePlaylist(playlistId, sourceUrl, offset, limit);
	}

	async openStream(
		provider: MusicProvider,
		externalId: string,
		range?: string,
	): Promise<Response> {
		const adapter = this.adapters[provider];
		const { externalId: normalized } = adapter.parseSongReference(externalId);
		const streamUrl = adapter.resolveStreamUrl(normalized);
		return this.http.fetchAudio(
			adapter,
			streamUrl instanceof URL ? streamUrl : await streamUrl,
			range,
		);
	}
}
