import type { MusicPlaylistDto, MusicTrackDto } from "@cogm/shared";
import { z } from "zod";
import {
	MusicNotFoundError,
	MusicPlaylistEmptyError,
	MusicPlaylistNotFoundError,
	MusicProviderResponseInvalidError,
} from "../domain/music-errors";
import type { MusicHttpClient } from "./music-http-client";
import type { MusicProviderAdapter } from "./provider-adapter";
import { parseMusicReference, parsePlaylistReference } from "./reference";

const neteaseSearchSong = z.object({
	id: z.number().int().positive(),
	name: z.string().min(1),
	duration: z.number().int().min(0).default(0),
	artists: z.array(z.object({ name: z.string().min(1) })).default([]),
	album: z.object({ name: z.string() }).nullable().optional(),
});

const neteaseDetailSong = neteaseSearchSong.extend({
	dt: z.number().int().min(0).optional(),
});

const neteasePlaylistResponse = z.object({
	code: z.number(),
	playlist: z
		.object({
			id: z.number().int().positive(),
			name: z.string().min(1),
			coverImgUrl: z.string().url().nullable().optional(),
			description: z.string().nullable().optional(),
			creator: z
				.object({ nickname: z.string().nullable().optional() })
				.nullable()
				.optional(),
			trackCount: z.number().int().min(0),
			trackIds: z.array(z.object({ id: z.number().int().positive() })),
		})
		.nullable(),
});

export class NeteaseMusicAdapter implements MusicProviderAdapter {
	readonly provider: "netease" = "netease";
	readonly referer = "https://music.163.com/";

	constructor(private readonly http: MusicHttpClient) {}

	parseSongReference(reference: string) {
		return parseMusicReference(this.provider, reference);
	}

	parsePlaylistReference(reference: string) {
		return parsePlaylistReference(this.provider, reference);
	}

	isAllowedAudioHost(hostname: string): boolean {
		return (
			hostname === "music.163.com" ||
			hostname === "music.126.net" ||
			hostname.endsWith(".music.126.net")
		);
	}

	isUnavailableRedirect(url: URL): boolean {
		return url.hostname === "music.163.com" && url.pathname.startsWith("/404");
	}

	async search(query: string, limit: number): Promise<MusicTrackDto[]> {
		const url = new URL("https://music.163.com/api/search/get/web");
		url.searchParams.set("s", query);
		url.searchParams.set("type", "1");
		url.searchParams.set("limit", String(limit));
		url.searchParams.set("offset", "0");
		const body = await this.http.requestJson(url, {
			headers: this.http.headers(this.referer),
		});
		const parsed = z
			.object({
				result: z.object({ songs: z.array(z.unknown()).default([]) }),
			})
			.safeParse(body);
		if (!parsed.success) {
			throw new MusicProviderResponseInvalidError();
		}
		const tracks: MusicTrackDto[] = [];
		for (const candidate of parsed.data.result.songs) {
			const song = neteaseSearchSong.safeParse(candidate);
			if (!song.success) {
				continue;
			}
			const externalId = String(song.data.id);
			tracks.push({
				provider: this.provider,
				externalId,
				name: song.data.name,
				artists: song.data.artists.map((artist) => artist.name),
				album: song.data.album?.name || null,
				durationMs: song.data.duration,
				sourceUrl: this.parseSongReference(externalId).sourceUrl,
				availability: "unknown",
			});
		}
		return tracks;
	}

	async fetchMetadata(externalId: string) {
		const url = new URL("https://music.163.com/api/song/detail/");
		url.searchParams.set("id", externalId);
		url.searchParams.set("ids", `[${externalId}]`);
		const body = await this.http.requestJson(url, {
			headers: this.http.headers(this.referer),
		});
		const parsed = z.object({ songs: z.array(z.unknown()) }).safeParse(body);
		if (!parsed.success) {
			throw new MusicProviderResponseInvalidError();
		}
		if (parsed.data.songs.length === 0) {
			throw new MusicNotFoundError();
		}
		const song = neteaseDetailSong.safeParse(parsed.data.songs[0]);
		if (!song.success || String(song.data.id) !== externalId) {
			throw new MusicProviderResponseInvalidError();
		}
		return {
			name: song.data.name,
			artists: song.data.artists.map((artist) => artist.name),
			album: song.data.album?.name || null,
			durationMs: song.data.dt ?? song.data.duration,
		};
	}

	async resolvePlaylist(
		playlistId: string,
		sourceUrl: string,
		offset: number,
		limit: number,
	): Promise<MusicPlaylistDto> {
		const url = new URL("https://music.163.com/api/v6/playlist/detail");
		url.searchParams.set("id", playlistId);
		url.searchParams.set("n", "0");
		const body = await this.http.requestJson(
			url,
			{ headers: this.http.headers(this.referer) },
			new MusicPlaylistNotFoundError(),
		);
		const parsed = neteasePlaylistResponse.safeParse(body);
		if (!parsed.success) {
			throw new MusicProviderResponseInvalidError();
		}
		if ([401, 403, 404].includes(parsed.data.code) || !parsed.data.playlist) {
			throw new MusicPlaylistNotFoundError();
		}
		if (parsed.data.code !== 200) {
			throw new MusicProviderResponseInvalidError();
		}
		const playlist = parsed.data.playlist;
		if (
			String(playlist.id) !== playlistId ||
			playlist.trackIds.length !== playlist.trackCount
		) {
			throw new MusicProviderResponseInvalidError();
		}
		if (playlist.trackCount === 0) {
			throw new MusicPlaylistEmptyError();
		}
		const pageIds = playlist.trackIds.slice(offset, offset + limit);
		const songs = new Map<number, z.infer<typeof neteaseDetailSong>>();
		if (pageIds.length > 0) {
			const ids = pageIds.map((track) => track.id);
			const detailUrl = new URL("https://music.163.com/api/song/detail/");
			detailUrl.searchParams.set("id", String(ids[0]));
			detailUrl.searchParams.set("ids", JSON.stringify(ids));
			const detailBody = await this.http.requestJson(
				detailUrl,
				{ headers: this.http.headers(this.referer) },
				new MusicProviderResponseInvalidError(),
			);
			const details = z
				.object({ songs: z.array(z.unknown()) })
				.safeParse(detailBody);
			if (!details.success || details.data.songs.length !== ids.length) {
				throw new MusicProviderResponseInvalidError();
			}
			for (const candidate of details.data.songs) {
				const song = neteaseDetailSong.safeParse(candidate);
				if (!song.success) {
					throw new MusicProviderResponseInvalidError();
				}
				songs.set(song.data.id, song.data);
			}
		}
		const items = pageIds.map(({ id }) => {
			const song = songs.get(id);
			if (!song) {
				throw new MusicProviderResponseInvalidError();
			}
			const externalId = String(id);
			return {
				provider: this.provider,
				externalId,
				name: song.name,
				artists: song.artists.map((artist) => artist.name),
				album: song.album?.name || null,
				durationMs: song.dt ?? song.duration,
				sourceUrl: this.parseSongReference(externalId).sourceUrl,
				availability: "unknown" as const,
			};
		});
		const nextOffset = offset + pageIds.length;
		return {
			provider: this.provider,
			playlistId,
			name: playlist.name,
			coverUrl: playlist.coverImgUrl ?? null,
			description: playlist.description ?? null,
			creator: playlist.creator?.nickname ?? null,
			sourceUrl,
			totalCount: playlist.trackCount,
			items,
			nextOffset: nextOffset < playlist.trackIds.length ? nextOffset : null,
		};
	}

	resolveStreamUrl(externalId: string): URL {
		return new URL(
			`https://music.163.com/song/media/outer/url?id=${externalId}.mp3`,
		);
	}
}
