import type { MusicPlaylistDto, MusicTrackDto } from "@cogm/shared";
import { z } from "zod";
import { AppError } from "@/platform/errors/app-error";
import {
	MusicNotFoundError,
	MusicPlaylistEmptyError,
	MusicPlaylistNotFoundError,
	MusicProviderResponseInvalidError,
	MusicUnavailableError,
} from "../domain/music-errors";
import type { MusicHttpClient } from "./music-http-client";
import type { MusicProviderAdapter } from "./provider-adapter";
import { parseMusicReference, parsePlaylistReference } from "./reference";

const qqSearchSong = z.object({
	songmid: z.string().regex(/^[A-Za-z0-9]{14}$/),
	songname: z.string().min(1),
	interval: z.number().int().min(0),
	singer: z.array(z.object({ name: z.string().min(1) })).default([]),
	albumname: z.string().optional(),
});

const qqDetailSong = z.object({
	mid: z.string().optional(),
	name: z.string().min(1),
	interval: z.number().int().min(0),
	singer: z.array(z.object({ name: z.string().min(1) })).default([]),
	album: z
		.object({ name: z.string().optional(), title: z.string().optional() })
		.optional(),
});

const qqPlaylistSong = qqDetailSong.extend({
	mid: z.string().regex(/^[A-Za-z0-9]{14}$/),
});

const qqPlaylistData = z.object({
	dirinfo: z.object({
		id: z.number().int().positive(),
		title: z.string().min(1),
		picurl: z.string().optional(),
		desc: z.string().optional(),
		host_nick: z.string().optional(),
	}),
	total_song_num: z.number().int().min(0),
	songlist: z.array(z.unknown()),
});

export class QqMusicAdapter implements MusicProviderAdapter {
	readonly provider: "qq" = "qq";
	readonly referer = "https://y.qq.com/";

	constructor(private readonly http: MusicHttpClient) {}

	parseSongReference(reference: string) {
		return parseMusicReference(this.provider, reference);
	}

	parsePlaylistReference(reference: string) {
		return parsePlaylistReference(this.provider, reference);
	}

	isAllowedAudioHost(hostname: string): boolean {
		return (
			hostname === "stream.qqmusic.qq.com" ||
			hostname.endsWith(".stream.qqmusic.qq.com") ||
			hostname === "aqqmusic.tc.qq.com"
		);
	}

	async search(query: string, limit: number): Promise<MusicTrackDto[]> {
		const url = new URL("https://c.y.qq.com/soso/fcgi-bin/client_search_cp");
		url.searchParams.set("w", query);
		url.searchParams.set("format", "json");
		url.searchParams.set("n", String(limit));
		const body = await this.http.requestJson(url, {
			headers: this.http.headers(this.referer),
		});
		const parsed = z
			.object({
				code: z.number(),
				data: z.object({
					song: z.object({ list: z.array(z.unknown()).default([]) }),
				}),
			})
			.safeParse(body);
		if (!parsed.success || parsed.data.code !== 0) {
			throw new MusicProviderResponseInvalidError();
		}
		const tracks: MusicTrackDto[] = [];
		for (const candidate of parsed.data.data.song.list) {
			const song = qqSearchSong.safeParse(candidate);
			if (!song.success) {
				continue;
			}
			tracks.push({
				provider: this.provider,
				externalId: song.data.songmid,
				name: song.data.songname,
				artists: song.data.singer.map((artist) => artist.name),
				album: song.data.albumname || null,
				durationMs: song.data.interval * 1000,
				sourceUrl: this.parseSongReference(song.data.songmid).sourceUrl,
				availability: "unknown",
			});
		}
		return tracks;
	}

	async fetchMetadata(externalId: string) {
		const url = new URL(
			"https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg",
		);
		url.searchParams.set("songmid", externalId);
		url.searchParams.set("format", "json");
		const body = await this.http.requestJson(url, {
			headers: this.http.headers(this.referer),
		});
		const parsed = z
			.object({ code: z.number(), data: z.array(z.unknown()) })
			.safeParse(body);
		if (!parsed.success || parsed.data.code !== 0) {
			throw new MusicProviderResponseInvalidError();
		}
		if (parsed.data.data.length === 0) {
			throw new MusicNotFoundError();
		}
		const song = qqDetailSong.safeParse(parsed.data.data[0]);
		if (!song.success || (song.data.mid && song.data.mid !== externalId)) {
			throw new MusicProviderResponseInvalidError();
		}
		return {
			name: song.data.name,
			artists: song.data.singer.map((artist) => artist.name),
			album: song.data.album?.name || song.data.album?.title || null,
			durationMs: song.data.interval * 1000,
		};
	}

	async resolvePlaylist(
		playlistId: string,
		sourceUrl: string,
		offset: number,
		limit: number,
	): Promise<MusicPlaylistDto> {
		const body = await this.http.requestJson(
			"https://u.y.qq.com/cgi-bin/musicu.fcg",
			{
				method: "POST",
				headers: {
					...this.http.headers(this.referer),
					"content-type": "application/json",
					origin: "https://y.qq.com",
				},
				body: JSON.stringify({
					req_0: {
						module: "srf_diss_info.DissInfoServer",
						method: "CgiGetDiss",
						param: {
							disstid: Number(playlistId),
							song_begin: offset,
							song_num: limit,
							onlysonglist: 0,
							userinfo: 1,
							orderlist: 1,
							tag: 1,
						},
					},
					comm: {
						uin: 0,
						format: "json",
						ct: 20,
						cv: 1803,
						platform: "wk_v17",
					},
				}),
			},
			new MusicPlaylistNotFoundError(),
		);
		const response = z
			.object({
				code: z.number(),
				req_0: z.object({ code: z.number(), data: z.unknown() }),
			})
			.safeParse(body);
		if (!response.success) {
			throw new MusicProviderResponseInvalidError();
		}
		if (
			[401, 403, 404].includes(response.data.code) ||
			[401, 403, 404].includes(response.data.req_0.code)
		) {
			throw new MusicPlaylistNotFoundError();
		}
		if (response.data.code !== 0 || response.data.req_0.code !== 0) {
			throw new MusicProviderResponseInvalidError();
		}
		const missing = z
			.object({ code: z.literal(-100006) })
			.safeParse(response.data.req_0.data);
		if (missing.success) {
			throw new MusicPlaylistNotFoundError();
		}
		const parsed = qqPlaylistData.safeParse(response.data.req_0.data);
		if (!parsed.success || String(parsed.data.dirinfo.id) !== playlistId) {
			throw new MusicProviderResponseInvalidError();
		}
		const data = parsed.data;
		if (data.total_song_num === 0) {
			throw new MusicPlaylistEmptyError();
		}
		const expectedCount = Math.max(
			0,
			Math.min(limit, data.total_song_num - offset),
		);
		if (data.songlist.length !== expectedCount) {
			throw new MusicProviderResponseInvalidError();
		}
		const items = data.songlist.map((candidate) => {
			const song = qqPlaylistSong.safeParse(candidate);
			if (!song.success) {
				throw new MusicProviderResponseInvalidError();
			}
			return {
				provider: this.provider,
				externalId: song.data.mid,
				name: song.data.name,
				artists: song.data.singer.map((artist) => artist.name),
				album: song.data.album?.name || song.data.album?.title || null,
				durationMs: song.data.interval * 1000,
				sourceUrl: this.parseSongReference(song.data.mid).sourceUrl,
				availability: "unknown" as const,
			};
		});
		const nextOffset = offset + items.length;
		return {
			provider: this.provider,
			playlistId,
			name: data.dirinfo.title,
			coverUrl: data.dirinfo.picurl || null,
			description: data.dirinfo.desc || null,
			creator: data.dirinfo.host_nick || null,
			sourceUrl,
			totalCount: data.total_song_num,
			items,
			nextOffset: nextOffset < data.total_song_num ? nextOffset : null,
		};
	}

	async resolveStreamUrl(externalId: string): Promise<URL> {
		for (let attempt = 0; attempt < 3; attempt += 1) {
			const random = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
			const guid = String(1_000_000_000 + (random % 9_000_000_000));
			const streamUrl = await this.qqVkeyStreamUrl(externalId, guid);
			if (streamUrl) {
				return streamUrl;
			}
			if (attempt < 2) {
				const delay = Promise.withResolvers<void>();
				setTimeout(delay.resolve, 150 * (attempt + 1));
				await delay.promise;
			}
		}
		throw new MusicUnavailableError();
	}

	private async qqVkeyStreamUrl(
		externalId: string,
		guid: string,
	): Promise<URL | null> {
		const body = await this.http.requestJson(
			"https://u.y.qq.com/cgi-bin/musicu.fcg",
			{
				method: "POST",
				headers: {
					...this.http.headers(this.referer),
					"content-type": "application/json",
					origin: "https://y.qq.com",
				},
				body: JSON.stringify({
					req_0: {
						module: "vkey.GetVkeyServer",
						method: "CgiGetVkey",
						param: {
							guid,
							songmid: [externalId],
							songtype: [0],
							uin: "0",
							loginflag: 1,
							platform: "20",
						},
					},
					comm: { uin: 0, format: "json", ct: 24, cv: 0 },
				}),
			},
		);
		const parsed = z
			.object({
				code: z.number(),
				req_0: z.object({
					code: z.number(),
					data: z.object({
						sip: z.array(z.string()),
						midurlinfo: z.array(
							z.object({ songmid: z.string(), purl: z.string() }),
						),
					}),
				}),
			})
			.safeParse(body);
		if (
			!parsed.success ||
			parsed.data.code !== 0 ||
			parsed.data.req_0.code !== 0
		) {
			throw new MusicProviderResponseInvalidError();
		}
		const info = parsed.data.req_0.data.midurlinfo.find(
			(candidate) => candidate.songmid === externalId,
		);
		if (!info?.purl) {
			return null;
		}
		for (const candidate of parsed.data.req_0.data.sip) {
			try {
				const base = new URL(candidate);
				const streamUrl = new URL(info.purl, base);
				if (this.isAllowedAudioHost(streamUrl.hostname)) {
					streamUrl.protocol = "https:";
					streamUrl.username = "";
					streamUrl.password = "";
					streamUrl.port = "";
					return streamUrl;
				}
			} catch (error) {
				if (error instanceof AppError) {
					throw error;
				}
			}
		}
		throw new MusicProviderResponseInvalidError();
	}
}
