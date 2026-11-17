import { describe, expect, test } from "bun:test";
import {
	BgmState,
	CreateTrackRequest,
	MusicSearchQuery,
	MusicTrackDto,
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
				loop: true,
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
});
