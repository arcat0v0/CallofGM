import { describe, expect, test } from "bun:test";
import {
	type MusicFetch,
	MusicStreamTooLargeError,
	MusicUnavailableError,
	OfficialMusicService,
	parseMusicReference,
} from "@/modules/music";

function requestUrl(input: string | URL | Request): string {
	return input instanceof Request ? input.url : String(input);
}

describe("official music reference parsing", () => {
	test("accepts raw ids and canonical official share pages", () => {
		expect(parseMusicReference("netease", "1913586094")).toEqual({
			externalId: "1913586094",
			sourceUrl: "https://music.163.com/song?id=1913586094",
		});
		expect(
			parseMusicReference(
				"netease",
				"https://y.music.163.com/m/song?id=1913586094&userid=1",
			).externalId,
		).toBe("1913586094");
		expect(
			parseMusicReference(
				"qq",
				"https://y.qq.com/n/ryqq_v2/songDetail/002rROE10ibMXN",
			),
		).toEqual({
			externalId: "002rROE10ibMXN",
			sourceUrl: "https://y.qq.com/n/ryqq/songDetail/002rROE10ibMXN",
		});
	});

	test("rejects arbitrary URLs, wrong providers and malformed ids", () => {
		for (const [provider, reference] of [
			["netease", "https://example.com/song?id=1913586094"],
			["netease", "https://music.163.com.evil.test/song?id=1913586094"],
			["qq", "https://music.163.com/song?id=1913586094"],
			["qq", "not-a-mid"],
			["netease", "1913586094.mp3"],
		] as const) {
			expect(() => parseMusicReference(provider, reference)).toThrow();
		}
	});
});

describe("official music providers", () => {
	test("maps NetEase search metadata", async () => {
		const service = new OfficialMusicService((async (
			input: string | URL | Request,
		) => {
			expect(requestUrl(input)).toContain("music.163.com/api/search/get/web");
			return Response.json({
				result: {
					songs: [
						{
							id: 1913586094,
							name: "不合群",
							duration: 123456,
							artists: [{ name: "不成风" }],
							album: { name: "不合群" },
						},
					],
				},
			});
		}) as MusicFetch);
		expect(await service.search("netease", "不合群", 10)).toEqual([
			{
				provider: "netease",
				externalId: "1913586094",
				name: "不合群",
				artists: ["不成风"],
				album: "不合群",
				durationMs: 123456,
				sourceUrl: "https://music.163.com/song?id=1913586094",
				availability: "unknown",
			},
		]);
	});

	test("maps QQ search metadata", async () => {
		const service = new OfficialMusicService((async () => {
			return Response.json({
				code: 0,
				data: {
					song: {
						list: [
							{
								songmid: "002rROE10ibMXN",
								songname: "会呼吸的痛",
								interval: 127,
								singer: [{ name: "梁静茹" }],
								albumname: "崇拜",
							},
						],
					},
				},
			});
		}) as MusicFetch);
		expect(await service.search("qq", "会呼吸的痛", 10)).toEqual([
			{
				provider: "qq",
				externalId: "002rROE10ibMXN",
				name: "会呼吸的痛",
				artists: ["梁静茹"],
				album: "崇拜",
				durationMs: 127000,
				sourceUrl: "https://y.qq.com/n/ryqq/songDetail/002rROE10ibMXN",
				availability: "unknown",
			},
		]);
	});

	test("upgrades only whitelisted NetEase CDN redirects and forwards Range", async () => {
		const seen: Array<{ url: string; range: string | null }> = [];
		const service = new OfficialMusicService((async (
			input: string | URL | Request,
			init?: RequestInit,
		) => {
			const url = requestUrl(input);
			seen.push({ url, range: new Headers(init?.headers).get("range") });
			if (seen.length === 1) {
				return new Response(null, {
					status: 302,
					headers: { location: "http://m801.music.126.net/public.mp3" },
				});
			}
			return new Response(new Uint8Array([1, 2, 3, 4]), {
				status: 206,
				headers: {
					"content-type": "audio/mpeg",
					"content-length": "4",
					"content-range": "bytes 0-3/100",
				},
			});
		}) as MusicFetch);
		const response = await service.openStream(
			"netease",
			"1913586094",
			"bytes=0-3",
		);
		expect(response.status).toBe(206);
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(
			new Uint8Array([1, 2, 3, 4]),
		);
		expect(seen[1]?.url).toBe("https://m801.music.126.net/public.mp3");
		expect(seen[1]?.range).toBe("bytes=0-3");
	});

	test("resolves QQ metadata and a fresh official stream", async () => {
		const seen: string[] = [];
		const service = new OfficialMusicService((async (
			input: string | URL | Request,
		) => {
			const url = requestUrl(input);
			seen.push(url);
			if (url.includes("fcg_play_single_song")) {
				return Response.json({
					code: 0,
					data: [
						{
							mid: "002rROE10ibMXN",
							name: "会呼吸的痛",
							title: "会呼吸的痛",
							interval: 127,
							singer: [{ name: "梁静茹" }],
							album: { name: "崇拜" },
						},
					],
				});
			}
			if (url.includes("musicu.fcg")) {
				return Response.json({
					code: 0,
					req_0: {
						code: 0,
						data: {
							sip: ["http://sjy6.stream.qqmusic.qq.com/"],
							midurlinfo: [
								{
									songmid: "002rROE10ibMXN",
									purl: "C400002rROE10ibMXN.m4a?vkey=temporary",
								},
							],
						},
					},
				});
			}
			return new Response(new Uint8Array([0, 0, 0, 32]), {
				status: 206,
				headers: { "content-type": "audio/mp4", "content-length": "4" },
			});
		}) as MusicFetch);
		const track = await service.resolve("qq", "002rROE10ibMXN");
		expect(track).toMatchObject({
			provider: "qq",
			externalId: "002rROE10ibMXN",
			name: "会呼吸的痛",
			artists: ["梁静茹"],
			album: "崇拜",
			durationMs: 127000,
			availability: "available",
		});
		expect(seen.at(-1)).toBe(
			"https://sjy6.stream.qqmusic.qq.com/C400002rROE10ibMXN.m4a?vkey=temporary",
		);
	});

	test("retries a transient empty QQ purl with a fresh anonymous guid", async () => {
		let vkeyCalls = 0;
		const guids: string[] = [];
		const service = new OfficialMusicService((async (
			input: string | URL | Request,
			init?: RequestInit,
		) => {
			const url = requestUrl(input);
			if (url.includes("musicu.fcg")) {
				vkeyCalls += 1;
				const body = JSON.parse(String(init?.body)) as {
					req_0: { param: { guid: string } };
				};
				guids.push(body.req_0.param.guid);
				return Response.json({
					code: 0,
					req_0: {
						code: 0,
						data: {
							sip: ["http://sjy6.stream.qqmusic.qq.com/"],
							midurlinfo: [
								{
									songmid: "002rROE10ibMXN",
									purl:
										vkeyCalls === 1
											? ""
											: "C400002rROE10ibMXN.m4a?vkey=temporary",
								},
							],
						},
					},
				});
			}
			return new Response(new Uint8Array([0, 0, 0, 32]), {
				status: 206,
				headers: { "content-type": "audio/mp4", "content-length": "4" },
			});
		}) as MusicFetch);
		const response = await service.openStream(
			"qq",
			"002rROE10ibMXN",
			"bytes=0-3",
		);
		expect(response.status).toBe(206);
		expect(vkeyCalls).toBe(2);
		expect(guids).toHaveLength(2);
		expect(guids[0]).not.toBe(guids[1]);
		expect(guids[0]).toMatch(/^\d+$/);
	});

	test("rejects unavailable QQ songs instead of returning a fake stream", async () => {
		const service = new OfficialMusicService((async () => {
			return Response.json({
				code: 0,
				req_0: {
					code: 0,
					data: {
						sip: ["http://sjy6.stream.qqmusic.qq.com/"],
						midurlinfo: [{ songmid: "002A6j2q1tdUUP", purl: "" }],
					},
				},
			});
		}) as MusicFetch);
		await expect(
			service.openStream("qq", "002A6j2q1tdUUP"),
		).rejects.toBeInstanceOf(MusicUnavailableError);
	});

	test("blocks redirect SSRF and oversized audio", async () => {
		const unsafe = new OfficialMusicService((async () => {
			return new Response(null, {
				status: 302,
				headers: { location: "http://127.0.0.1/private" },
			});
		}) as MusicFetch);
		await expect(
			unsafe.openStream("netease", "1913586094"),
		).rejects.toMatchObject({
			code: "MUSIC_PROVIDER_RESPONSE_INVALID",
		});

		const oversized = new OfficialMusicService(
			(async () =>
				new Response(new Uint8Array([1, 2, 3]), {
					headers: { "content-type": "audio/mpeg", "content-length": "3" },
				})) as MusicFetch,
			{ maxBytes: 2 },
		);
		await expect(
			oversized.openStream("netease", "1913586094"),
		).rejects.toMatchObject({
			code: "MUSIC_STREAM_TOO_LARGE",
		});
	});

	test("enforces streaming size without Content-Length and rejects multi-ranges", async () => {
		const service = new OfficialMusicService(
			(async () => {
				return new Response(new Uint8Array([1, 2, 3]), {
					headers: { "content-type": "audio/mpeg" },
				});
			}) as MusicFetch,
			{ maxBytes: 2 },
		);
		const response = await service.openStream("netease", "1913586094");
		await expect(response.arrayBuffer()).rejects.toBeInstanceOf(
			MusicStreamTooLargeError,
		);
		await expect(
			service.openStream("netease", "1913586094", "bytes=0-1,3-4"),
		).rejects.toMatchObject({ code: "MUSIC_RANGE_INVALID" });
	});

	test("times out stalled provider requests", async () => {
		const service = new OfficialMusicService(
			((_: string | URL | Request, init?: RequestInit) => {
				const stalled = Promise.withResolvers<Response>();
				init?.signal?.addEventListener("abort", () => {
					stalled.reject(new DOMException("aborted", "AbortError"));
				});
				return stalled.promise;
			}) as MusicFetch,
			{ timeoutMs: 5 },
		);
		await expect(service.search("netease", "x", 1)).rejects.toMatchObject({
			code: "MUSIC_PROVIDER_TIMEOUT",
		});
	});
});
