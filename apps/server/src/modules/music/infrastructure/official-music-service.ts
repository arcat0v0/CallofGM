import type { MusicProvider, MusicTrackDto } from "@cogm/shared";
import { z } from "zod";
import { AppError } from "@/platform/errors/app-error";
import type { MusicService } from "../application/ports";
import {
	MusicNotFoundError,
	MusicProviderError,
	MusicProviderResponseInvalidError,
	MusicProviderTimeoutError,
	MusicRangeInvalidError,
	MusicStreamTooLargeError,
	MusicUnavailableError,
} from "../domain/music-errors";
import { parseMusicReference } from "./reference";

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

export type MusicFetch = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>;

export class OfficialMusicService implements MusicService {
	private readonly timeoutMs: number;
	private readonly maxBytes: number;

	constructor(
		private readonly fetchImpl: MusicFetch = fetch,
		options: { timeoutMs?: number; maxBytes?: number } = {},
	) {
		this.timeoutMs = options.timeoutMs ?? 10_000;
		this.maxBytes = options.maxBytes ?? 64 * 1024 * 1024;
	}

	async search(
		provider: MusicProvider,
		query: string,
		limit: number,
	): Promise<MusicTrackDto[]> {
		if (provider === "netease") {
			const url = new URL("https://music.163.com/api/search/get/web");
			url.searchParams.set("s", query);
			url.searchParams.set("type", "1");
			url.searchParams.set("limit", String(limit));
			url.searchParams.set("offset", "0");
			const body = await this.requestJson(url, {
				headers: this.headers("https://music.163.com/"),
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
					provider,
					externalId,
					name: song.data.name,
					artists: song.data.artists.map((artist) => artist.name),
					album: song.data.album?.name || null,
					durationMs: song.data.duration,
					sourceUrl: parseMusicReference(provider, externalId).sourceUrl,
					availability: "unknown",
				});
			}
			return tracks;
		}

		const url = new URL("https://c.y.qq.com/soso/fcgi-bin/client_search_cp");
		url.searchParams.set("w", query);
		url.searchParams.set("format", "json");
		url.searchParams.set("n", String(limit));
		const body = await this.requestJson(url, {
			headers: this.headers("https://y.qq.com/"),
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
				provider,
				externalId: song.data.songmid,
				name: song.data.songname,
				artists: song.data.singer.map((artist) => artist.name),
				album: song.data.albumname || null,
				durationMs: song.data.interval * 1000,
				sourceUrl: parseMusicReference(provider, song.data.songmid).sourceUrl,
				availability: "unknown",
			});
		}
		return tracks;
	}

	async resolve(
		provider: MusicProvider,
		reference: string,
	): Promise<MusicTrackDto> {
		const { externalId, sourceUrl } = parseMusicReference(provider, reference);
		const metadata =
			provider === "netease"
				? await this.neteaseMetadata(externalId)
				: await this.qqMetadata(externalId);
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

	async openStream(
		provider: MusicProvider,
		externalId: string,
		range?: string,
	): Promise<Response> {
		const normalized = parseMusicReference(provider, externalId).externalId;
		if (provider === "netease") {
			return this.fetchAudio(
				provider,
				new URL(
					`https://music.163.com/song/media/outer/url?id=${normalized}.mp3`,
				),
				"https://music.163.com/",
				range,
			);
		}
		const streamUrl = await this.qqStreamUrl(normalized);
		return this.fetchAudio(provider, streamUrl, "https://y.qq.com/", range);
	}

	private async neteaseMetadata(externalId: string) {
		const url = new URL("https://music.163.com/api/song/detail/");
		url.searchParams.set("id", externalId);
		url.searchParams.set("ids", `[${externalId}]`);
		const body = await this.requestJson(url, {
			headers: this.headers("https://music.163.com/"),
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

	private async qqMetadata(externalId: string) {
		const url = new URL(
			"https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg",
		);
		url.searchParams.set("songmid", externalId);
		url.searchParams.set("format", "json");
		const body = await this.requestJson(url, {
			headers: this.headers("https://y.qq.com/"),
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

	private async qqStreamUrl(externalId: string): Promise<URL> {
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
		const body = await this.requestJson(
			"https://u.y.qq.com/cgi-bin/musicu.fcg",
			{
				method: "POST",
				headers: {
					...this.headers("https://y.qq.com/"),
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
				if (this.allowedAudioHost("qq", streamUrl.hostname)) {
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

	private async fetchAudio(
		provider: MusicProvider,
		initialUrl: URL,
		referer: string,
		range?: string,
	): Promise<Response> {
		if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) {
			throw new MusicRangeInvalidError();
		}
		let current = new URL(initialUrl);
		for (let redirect = 0; redirect < 5; redirect += 1) {
			if (!this.allowedAudioHost(provider, current.hostname)) {
				throw new MusicProviderResponseInvalidError();
			}
			if (current.protocol === "http:") {
				current.protocol = "https:";
			}
			if (
				current.protocol !== "https:" ||
				current.username ||
				current.password ||
				current.port
			) {
				throw new MusicProviderResponseInvalidError();
			}
			const response = await this.fetchWithTimeout(current, {
				redirect: "manual",
				headers: {
					...this.headers(referer),
					accept: "audio/*",
					...(range ? { range } : {}),
				},
			});
			const contentRange = response.headers.get("content-range");
			const contentLength = response.headers.get("content-length");
			const acceptRanges = response.headers.get("accept-ranges");
			if ([301, 302, 303, 307, 308].includes(response.status)) {
				await response.body?.cancel();
				const location = response.headers.get("location");
				if (!location) {
					throw new MusicProviderResponseInvalidError();
				}
				const next = new URL(location, current);
				if (
					provider === "netease" &&
					next.hostname === "music.163.com" &&
					next.pathname.startsWith("/404")
				) {
					throw new MusicUnavailableError();
				}
				current = next;
				continue;
			}
			if ([401, 403, 404, 451].includes(response.status)) {
				await response.body?.cancel();
				throw new MusicUnavailableError();
			}
			if (response.status === 416) {
				await response.body?.cancel();
				return new Response(null, {
					status: 416,
					headers: {
						...(contentRange ? { "content-range": contentRange } : {}),
						"cache-control": "no-store",
					},
				});
			}
			if (response.status !== 200 && response.status !== 206) {
				await response.body?.cancel();
				throw new MusicProviderError();
			}
			const contentType =
				response.headers.get("content-type")?.toLowerCase() ?? "";
			if (!contentType.startsWith("audio/")) {
				await response.body?.cancel();
				if (contentType.startsWith("text/html")) {
					throw new MusicUnavailableError();
				}
				throw new MusicProviderResponseInvalidError();
			}
			const length = Number(contentLength ?? 0);
			const rangeTotal = Number(contentRange?.match(/\/(\d+)$/)?.[1] ?? 0);
			if (length > this.maxBytes || rangeTotal > this.maxBytes) {
				await response.body?.cancel();
				throw new MusicStreamTooLargeError();
			}
			if (!response.body) {
				throw new MusicProviderResponseInvalidError();
			}
			return new Response(this.limitedBody(response.body), {
				status: response.status,
				headers: {
					"content-type": contentType,
					...(contentLength ? { "content-length": contentLength } : {}),
					...(contentRange ? { "content-range": contentRange } : {}),
					...(acceptRanges ? { "accept-ranges": acceptRanges } : {}),
					"cache-control": "no-store",
					"x-content-type-options": "nosniff",
				},
			});
		}
		throw new MusicProviderResponseInvalidError();
	}

	private limitedBody(
		body: ReadableStream<Uint8Array>,
	): ReadableStream<Uint8Array> {
		const reader = body.getReader();
		let bytes = 0;
		let timer: ReturnType<typeof setTimeout> | undefined;
		return new ReadableStream<Uint8Array>({
			pull: async (controller) => {
				const timeout = Promise.withResolvers<never>();
				timer = setTimeout(
					() => timeout.reject(new MusicProviderTimeoutError()),
					this.timeoutMs,
				);
				try {
					const result = await Promise.race([reader.read(), timeout.promise]);
					bytes += result.value?.byteLength ?? 0;
					if (bytes > this.maxBytes) {
						throw new MusicStreamTooLargeError();
					}
					if (result.done) {
						controller.close();
					} else if (result.value) {
						controller.enqueue(result.value);
					}
				} catch (error) {
					await reader.cancel().catch(() => undefined);
					controller.error(error);
				} finally {
					clearTimeout(timer);
				}
			},
			cancel: async (reason) => {
				clearTimeout(timer);
				await reader.cancel(reason);
			},
		});
	}

	private async requestJson(
		url: string | URL,
		init: RequestInit,
	): Promise<unknown> {
		const response = await this.fetchWithTimeout(url, init);
		if (!response.ok) {
			await response.body?.cancel();
			if (response.status === 404) {
				throw new MusicNotFoundError();
			}
			throw new MusicProviderError();
		}
		try {
			return await response.json();
		} catch {
			throw new MusicProviderResponseInvalidError();
		}
	}

	private async fetchWithTimeout(
		url: string | URL,
		init: RequestInit,
	): Promise<Response> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		try {
			return await this.fetchImpl(url, { ...init, signal: controller.signal });
		} catch (error) {
			if (controller.signal.aborted) {
				throw new MusicProviderTimeoutError();
			}
			if (error instanceof AppError) {
				throw error;
			}
			throw new MusicProviderError();
		} finally {
			clearTimeout(timer);
		}
	}

	private allowedAudioHost(provider: MusicProvider, hostname: string): boolean {
		if (provider === "netease") {
			return (
				hostname === "music.163.com" ||
				hostname === "music.126.net" ||
				hostname.endsWith(".music.126.net")
			);
		}
		return (
			hostname === "stream.qqmusic.qq.com" ||
			hostname.endsWith(".stream.qqmusic.qq.com") ||
			hostname === "aqqmusic.tc.qq.com"
		);
	}

	private headers(referer: string): Record<string, string> {
		return {
			"user-agent": "Mozilla/5.0",
			referer,
		};
	}
}
