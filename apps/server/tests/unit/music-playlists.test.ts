import { describe, expect, test } from "bun:test";
import {
	type MusicFetch,
	MusicPlaylistEmptyError,
	MusicPlaylistNotFoundError,
	MusicPlaylistReferenceInvalidError,
	MusicProviderResponseInvalidError,
	OfficialMusicService,
	parsePlaylistReference,
} from "@/modules/music";

function requestUrl(input: string | URL | Request): string {
	return input instanceof Request ? input.url : String(input);
}

function json(body: unknown): Response {
	return Response.json(body);
}

function neteaseSong(id: number) {
	return {
		id,
		name: `曲目 ${id}`,
		duration: 180000 + id,
		artists: [{ name: `歌手 ${id}` }],
		album: { name: `专辑 ${id}` },
	};
}

const qqMids = ["001lsv3G44QK38", "001lIveP0mQR5u", "003DoFAw1DW7Jr"];

function qqSong(index: number) {
	return {
		mid: qqMids[index],
		name: `QQ 曲目 ${index + 1}`,
		interval: 180 + index,
		singer: [{ name: `QQ 歌手 ${index + 1}` }],
		album: { name: `QQ 专辑 ${index + 1}` },
	};
}

function qqPlaylistBody(offset: number, limit: number, total = 3) {
	return {
		code: 0,
		req_0: {
			code: 0,
			data: {
				dirinfo: {
					id: 9063620918,
					title: "江河行龙的新歌推荐",
					picurl: "https://y.gtimg.cn/music/cover.jpg",
					desc: "公开歌单简介",
					host_nick: "QQ音乐官方歌单",
				},
				total_song_num: total,
				songlist: Array.from({ length: total }, (_, index) =>
					qqSong(index),
				).slice(offset, offset + limit),
			},
		},
	};
}

describe("official playlist reference parsing", () => {
	test("accepts numeric ids and canonical official playlist pages", () => {
		expect(parsePlaylistReference("netease", "3778678")).toEqual({
			playlistId: "3778678",
			sourceUrl: "https://music.163.com/playlist?id=3778678",
		});
		for (const reference of [
			"https://music.163.com/#/playlist?id=3778678",
			"https://music.163.com/playlist?id=3778678&uct2=share",
			"https://y.music.163.com/m/playlist?id=3778678&userid=1",
			"http://music.163.com/outchain/1/3778678/",
		]) {
			expect(parsePlaylistReference("netease", reference).playlistId).toBe(
				"3778678",
			);
		}
		expect(
			parsePlaylistReference(
				"qq",
				"https://y.qq.com/n/ryqq/playlist/9063620918",
			),
		).toEqual({
			playlistId: "9063620918",
			sourceUrl: "https://y.qq.com/n/ryqq/playlist/9063620918",
		});
		expect(
			parsePlaylistReference(
				"qq",
				"https://y.qq.com/n/ryqq_v2/playlist/9063620918",
			).playlistId,
		).toBe("9063620918");
		expect(
			parsePlaylistReference(
				"qq",
				"https://i.y.qq.com/n2/m/share/details/taoge.html?id=9063620918",
			).playlistId,
		).toBe("9063620918");
	});

	test("rejects song pages, short links, arbitrary URLs and malformed ids", () => {
		for (const [provider, reference] of [
			["netease", "https://music.163.com/song?id=1913586094"],
			["netease", "https://example.com/playlist?id=3778678"],
			["netease", "0"],
			["qq", "https://y.qq.com/n/ryqq/songDetail/001lsv3G44QK38"],
			["qq", "https://c.y.qq.com/base/fcgi-bin/u?__=short"],
			["qq", "9063620918/extra"],
			["qq", "1234567890123456"],
		] as const) {
			expect(() => parsePlaylistReference(provider, reference)).toThrow(
				MusicPlaylistReferenceInvalidError,
			);
		}
	});
});

describe("official playlist providers", () => {
	test("maps NetEase metadata and chunks song details in playlist order", async () => {
		const urls: string[] = [];
		const fetchImpl: MusicFetch = async (input) => {
			const url = requestUrl(input);
			urls.push(url);
			if (url.includes("/api/v6/playlist/detail")) {
				return json({
					code: 200,
					playlist: {
						id: 3778678,
						name: "热歌榜",
						coverImgUrl: "https://p1.music.126.net/cover.jpg",
						description: "热歌简介",
						creator: { nickname: "网易云音乐" },
						trackCount: 3,
						trackIds: [{ id: 101 }, { id: 102 }, { id: 103 }],
					},
				});
			}
			return json({ code: 200, songs: [neteaseSong(103), neteaseSong(102)] });
		};
		const page = await new OfficialMusicService(fetchImpl).resolvePlaylist(
			"netease",
			"3778678",
			1,
			2,
		);
		expect(page).toEqual({
			provider: "netease",
			playlistId: "3778678",
			name: "热歌榜",
			coverUrl: "https://p1.music.126.net/cover.jpg",
			description: "热歌简介",
			creator: "网易云音乐",
			sourceUrl: "https://music.163.com/playlist?id=3778678",
			totalCount: 3,
			items: [102, 103].map((id) => ({
				provider: "netease",
				externalId: String(id),
				name: `曲目 ${id}`,
				artists: [`歌手 ${id}`],
				album: `专辑 ${id}`,
				durationMs: 180000 + id,
				sourceUrl: `https://music.163.com/song?id=${id}`,
				availability: "unknown",
			})),
			nextOffset: null,
		});
		expect(urls).toHaveLength(2);
		expect(new URL(urls[0] ?? "").searchParams.get("n")).toBe("0");
		expect(new URL(urls[1] ?? "").searchParams.get("ids")).toBe("[102,103]");
	});

	test("reports the next NetEase offset and permits an offset beyond the end", async () => {
		const fetchImpl: MusicFetch = async (input) => {
			const url = requestUrl(input);
			if (url.includes("/api/v6/playlist/detail")) {
				return json({
					code: 200,
					playlist: {
						id: 3778678,
						name: "热歌榜",
						trackCount: 3,
						trackIds: [{ id: 101 }, { id: 102 }, { id: 103 }],
					},
				});
			}
			return json({ code: 200, songs: [neteaseSong(101)] });
		};
		const service = new OfficialMusicService(fetchImpl);
		expect(
			(await service.resolvePlaylist("netease", "3778678", 0, 1)).nextOffset,
		).toBe(1);
		expect(
			(await service.resolvePlaylist("netease", "3778678", 5, 1)).items,
		).toEqual([]);
	});

	test("maps QQ metadata and requests bounded sequential pages", async () => {
		const params: Array<{ song_begin: number; song_num: number }> = [];
		const fetchImpl: MusicFetch = async (_input, init) => {
			const body = JSON.parse(String(init?.body));
			const param = body.req_0.param;
			params.push(param);
			return json(qqPlaylistBody(param.song_begin, param.song_num));
		};
		const service = new OfficialMusicService(fetchImpl);
		const first = await service.resolvePlaylist("qq", "9063620918", 0, 2);
		expect(first).toMatchObject({
			provider: "qq",
			playlistId: "9063620918",
			name: "江河行龙的新歌推荐",
			coverUrl: "https://y.gtimg.cn/music/cover.jpg",
			description: "公开歌单简介",
			creator: "QQ音乐官方歌单",
			sourceUrl: "https://y.qq.com/n/ryqq/playlist/9063620918",
			totalCount: 3,
			nextOffset: 2,
		});
		expect(first.items.map((track) => track.externalId)).toEqual(
			qqMids.slice(0, 2),
		);
		expect(first.items[0]).toMatchObject({
			name: "QQ 曲目 1",
			artists: ["QQ 歌手 1"],
			album: "QQ 专辑 1",
			durationMs: 180000,
			availability: "unknown",
		});
		const second = await service.resolvePlaylist(
			"qq",
			"https://y.qq.com/n/ryqq/playlist/9063620918",
			2,
			2,
		);
		expect(second.items.map((track) => track.externalId)).toEqual(
			qqMids.slice(2),
		);
		expect(second.nextOffset).toBeNull();
		expect(params).toEqual([
			expect.objectContaining({
				disstid: 9063620918,
				song_begin: 0,
				song_num: 2,
			}),
			expect.objectContaining({
				disstid: 9063620918,
				song_begin: 2,
				song_num: 2,
			}),
		]);
	});

	test("returns stable empty and unavailable playlist errors", async () => {
		const emptyNetEase = new OfficialMusicService(async () =>
			json({
				code: 200,
				playlist: {
					id: 3778678,
					name: "空歌单",
					trackCount: 0,
					trackIds: [],
				},
			}),
		);
		await expect(
			emptyNetEase.resolvePlaylist("netease", "3778678", 0, 50),
		).rejects.toBeInstanceOf(MusicPlaylistEmptyError);
		const missingNetEase = new OfficialMusicService(async () =>
			json({ code: 404, playlist: null }),
		);
		await expect(
			missingNetEase.resolvePlaylist("netease", "3778678", 0, 50),
		).rejects.toBeInstanceOf(MusicPlaylistNotFoundError);
		const privateQq = new OfficialMusicService(async () =>
			json({ code: 0, req_0: { code: 403, data: {} } }),
		);
		await expect(
			privateQq.resolvePlaylist("qq", "9063620918", 0, 50),
		).rejects.toBeInstanceOf(MusicPlaylistNotFoundError);
		const missingQq = new OfficialMusicService(async () =>
			json({ code: 0, req_0: { code: 0, data: { code: -100006 } } }),
		);
		await expect(
			missingQq.resolvePlaylist("qq", "9063620918", 0, 50),
		).rejects.toBeInstanceOf(MusicPlaylistNotFoundError);
		const emptyQq = new OfficialMusicService(async () =>
			json(qqPlaylistBody(0, 50, 0)),
		);
		await expect(
			emptyQq.resolvePlaylist("qq", "9063620918", 0, 50),
		).rejects.toBeInstanceOf(MusicPlaylistEmptyError);
	});

	test("rejects changed provider responses instead of inventing pages", async () => {
		const missingSongs = new OfficialMusicService(async (input) => {
			if (requestUrl(input).includes("/api/v6/playlist/detail")) {
				return json({
					code: 200,
					playlist: {
						id: 3778678,
						name: "热歌榜",
						trackCount: 1,
						trackIds: [{ id: 101 }],
					},
				});
			}
			return json({ code: 200, songs: [] });
		});
		await expect(
			missingSongs.resolvePlaylist("netease", "3778678", 0, 50),
		).rejects.toBeInstanceOf(MusicProviderResponseInvalidError);
		const invalidQq = new OfficialMusicService(async () =>
			json({ code: 0, req_0: { code: 0, data: { dirinfo: {} } } }),
		);
		await expect(
			invalidQq.resolvePlaylist("qq", "9063620918", 0, 50),
		).rejects.toBeInstanceOf(MusicProviderResponseInvalidError);
	});
});
