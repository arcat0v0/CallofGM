import { describe, expect, test } from "bun:test";
import { TrackDto } from "@cogm/shared";
import { MusicUnavailableError, OfficialMusicService } from "@/modules/music";
import { setupTestApp } from "../helpers/setup";

const service = new OfficialMusicService();

describe("official music public network behavior", () => {
	test("NetEase search, metadata, MP3 bytes and Range", async () => {
		const results = await service.search("netease", "不合群 不成风", 5);
		expect(results.some((track) => track.externalId === "1913586094")).toBe(
			true,
		);
		const track = await service.resolve("netease", "1913586094");
		expect(track).toMatchObject({
			externalId: "1913586094",
			name: "不合群",
			availability: "available",
		});
		const response = await service.openStream(
			"netease",
			track.externalId,
			"bytes=0-1023",
		);
		const bytes = new Uint8Array(await response.arrayBuffer());
		expect(response.status).toBe(206);
		expect(response.headers.get("content-type")).toContain("audio/mpeg");
		expect(response.headers.get("content-range")).toMatch(
			/^bytes 0-1023\/\d+$/,
		);
		expect(bytes).toHaveLength(1024);
		expect(bytes[0]).toBe(0x49);
		expect(bytes[1]).toBe(0x44);
		expect(bytes[2]).toBe(0x33);
	}, 30_000);

	test("QQ search, metadata, M4A bytes and Range", async () => {
		const results = await service.search("qq", "免费", 20);
		expect(results.length).toBeGreaterThan(0);
		for (const expected of [
			{ externalId: "002rROE10ibMXN", name: "会呼吸的痛" },
			{ externalId: "001e7VNQ43nv4W", name: "牵丝戏" },
		]) {
			const track = await service.resolve("qq", expected.externalId);
			expect(track).toMatchObject({
				externalId: expected.externalId,
				name: expected.name,
				availability: "available",
			});
			const response = await service.openStream(
				"qq",
				track.externalId,
				"bytes=0-1023",
			);
			const bytes = new Uint8Array(await response.arrayBuffer());
			expect(response.status).toBe(206);
			expect(response.headers.get("content-type")).toContain("audio/mp4");
			expect(response.headers.get("content-range")).toMatch(
				/^bytes 0-1023\/\d+$/,
			);
			expect(bytes).toHaveLength(1024);
			expect(new TextDecoder().decode(bytes.slice(4, 8))).toBe("ftyp");
		}
	}, 30_000);

	test("app routes add and stream a current public QQ song", async () => {
		const ctx = await setupTestApp({ musicService: service });
		try {
			const created = await ctx.app.handle(
				new Request("http://localhost/api/v1/gm/modules/module-test/tracks", {
					method: "POST",
					headers: {
						"content-type": "application/json",
						authorization: `Bearer ${ctx.gmToken}`,
					},
					body: JSON.stringify({
						source: "qq",
						reference: "002rROE10ibMXN",
						type: "bgm",
					}),
				}),
			);
			expect(created.status).toBe(200);
			const track = TrackDto.parse(await created.json());
			expect(track).toMatchObject({
				source: "qq",
				externalId: "002rROE10ibMXN",
				name: "会呼吸的痛",
				audioAssetId: null,
			});
			const streamed = await ctx.app.handle(
				new Request(`http://localhost/api/v1/music/tracks/${track.id}/stream`, {
					headers: {
						authorization: `Bearer ${ctx.gmToken}`,
						range: "bytes=0-1023",
					},
				}),
			);
			const bytes = new Uint8Array(await streamed.arrayBuffer());
			expect(streamed.status).toBe(206);
			expect(streamed.headers.get("content-type")).toContain("audio/mp4");
			expect(bytes).toHaveLength(1024);
			expect(new TextDecoder().decode(bytes.slice(4, 8))).toBe("ftyp");
		} finally {
			ctx.container.dbContext.sqlite.close();
		}
	}, 30_000);

	test("NetEase public playlist metadata and sequential pages", async () => {
		const first = await service.resolvePlaylist(
			"netease",
			"https://music.163.com/playlist?id=3778678",
			0,
			2,
		);
		expect(first).toMatchObject({
			playlistId: "3778678",
			name: "热歌榜",
			creator: "网易云音乐",
			nextOffset: 2,
		});
		expect(first.totalCount).toBeGreaterThan(2);
		expect(first.items).toHaveLength(2);
		expect(first.items[0]?.name.length).toBeGreaterThan(0);
		expect(first.items.every((track) => track.availability === "unknown")).toBe(
			true,
		);
		const second = await service.resolvePlaylist(
			"netease",
			"3778678",
			first.nextOffset ?? 0,
			2,
		);
		expect(second.items).toHaveLength(2);
		expect(second.items[0]?.externalId).not.toBe(first.items[0]?.externalId);
	}, 30_000);

	test("QQ public playlist metadata and sequential pages", async () => {
		const first = await service.resolvePlaylist(
			"qq",
			"https://y.qq.com/n/ryqq/playlist/9063620918",
			0,
			2,
		);
		expect(first).toMatchObject({
			playlistId: "9063620918",
			name: "江河行龙的新歌推荐",
			creator: "QQ音乐官方歌单",
			totalCount: 30,
			nextOffset: 2,
		});
		expect(first.items).toHaveLength(2);
		expect(first.items[0]?.name.length).toBeGreaterThan(0);
		expect(first.items.every((track) => track.availability === "unknown")).toBe(
			true,
		);
		const second = await service.resolvePlaylist(
			"qq",
			"9063620918",
			first.nextOffset ?? 0,
			2,
		);
		expect(second.items).toHaveLength(2);
		expect(second.items[0]?.externalId).not.toBe(first.items[0]?.externalId);
	}, 30_000);

	test("restricted songs return explicit unavailable errors", async () => {
		await expect(
			service.openStream("netease", "347230", "bytes=0-0"),
		).rejects.toBeInstanceOf(MusicUnavailableError);
		await expect(
			service.openStream("qq", "002A6j2q1tdUUP", "bytes=0-0"),
		).rejects.toBeInstanceOf(MusicUnavailableError);
	}, 30_000);
});
