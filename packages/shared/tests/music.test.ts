import { describe, expect, test } from "bun:test";
import {
	BgmState,
	CreateTrackRequest,
	MusicPlaylistDto,
	MusicSearchQuery,
	MusicTrackDto,
	ResolveMusicPlaylistRequest,
	ResolveMusicTrackRequest,
	SePlayedEvent,
} from "../src";

describe("external music protocol", () => {
	test("validates provider search and resolution requests", () => {
		expect(
			MusicSearchQuery.parse({
				provider: "netease",
				query: " 海阔天空 ",
				limit: 10,
			}),
		).toEqual({ provider: "netease", query: "海阔天空", limit: 10 });
		expect(
			ResolveMusicTrackRequest.parse({
				provider: "qq",
				reference: "https://y.qq.com/n/ryqq/songDetail/002rROE10ibMXN",
			}).provider,
		).toBe("qq");
		expect(
			MusicSearchQuery.safeParse({ provider: "other", query: "x", limit: 10 })
				.success,
		).toBe(false);
		expect(
			MusicSearchQuery.safeParse({ provider: "qq", query: " ", limit: 10 })
				.success,
		).toBe(false);
	});

	test("accepts upload and external track creation without sharing fields", () => {
		expect(
			CreateTrackRequest.parse({
				name: "local",
				audioAssetId: "asset-1",
				type: "bgm",
				duration: 1000,
			}),
		).toEqual({
			source: "upload",
			name: "local",
			audioAssetId: "asset-1",
			type: "bgm",
			duration: 1000,
		});
		expect(
			CreateTrackRequest.parse({
				source: "netease",
				reference: "1913586094",
				type: "bgm",
			}),
		).toEqual({ source: "netease", reference: "1913586094", type: "bgm" });
		expect(
			CreateTrackRequest.safeParse({
				source: "qq",
				audioAssetId: "asset-1",
				type: "se",
			}).success,
		).toBe(false);
	});

	test("exposes explicit availability and internal playback URLs", () => {
		const track = MusicTrackDto.parse({
			provider: "netease",
			externalId: "1913586094",
			name: "不合群",
			artists: ["不成风"],
			album: "不合群",
			durationMs: 1000,
			sourceUrl: "https://music.163.com/song?id=1913586094",
			availability: "available",
		});
		expect(track.availability).toBe("available");
		expect(
			BgmState.parse({
				trackId: "track-1",
				playing: true,
				volume: 100,
				mode: "single",
				seekOffsetMs: 0,
				startedAtMs: 1,
				version: 1,
				source: "netease",
				audioAssetId: null,
				playbackUrl: "/api/v1/music/tracks/track-1/stream",
			}).playbackUrl,
		).toBe("/api/v1/music/tracks/track-1/stream");
		expect(
			SePlayedEvent.parse({
				trackId: "track-2",
				volume: 80,
				source: "qq",
				playbackUrl: "/api/v1/music/tracks/track-2/stream",
			}).source,
		).toBe("qq");
	});

	test("validates playlist pages without inventing totals or availability", () => {
		expect(
			ResolveMusicPlaylistRequest.parse({
				provider: "netease",
				reference: "3778678",
			}),
		).toEqual({
			provider: "netease",
			reference: "3778678",
			offset: 0,
			limit: 50,
		});
		const page = MusicPlaylistDto.parse({
			provider: "qq",
			playlistId: "9063620918",
			name: "公开歌单",
			coverUrl: null,
			description: null,
			creator: "QQ音乐官方歌单",
			sourceUrl: "https://y.qq.com/n/ryqq/playlist/9063620918",
			totalCount: null,
			items: [],
			nextOffset: null,
		});
		expect(page.totalCount).toBeNull();
		expect(
			ResolveMusicPlaylistRequest.safeParse({
				provider: "qq",
				reference: "9063620918",
				offset: -1,
			}).success,
		).toBe(false);
		expect(
			ResolveMusicPlaylistRequest.safeParse({
				provider: "qq",
				reference: "9063620918",
				limit: 51,
			}).success,
		).toBe(false);
		expect(
			ResolveMusicPlaylistRequest.safeParse({
				provider: "qq",
				reference: "9063620918",
				limit: 0,
			}).success,
		).toBe(false);
	});
});
