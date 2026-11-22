import { describe, expect, test } from "bun:test";
import type { TrackDto } from "@cogm/shared";
import {
	filterModulesByQuery,
	filterTracks,
	formatTotalDuration,
	guessTrackType,
	type LibraryTrack,
	libraryStats,
	sortTracks,
	splitSections,
	trackMetaParts,
	trackPlaybackPath,
	trackSourceTag,
} from "../src/features/gm-music/music-library-model";

function track(overrides: Partial<LibraryTrack> & { id: string }): LibraryTrack {
	return {
		moduleId: "m1",
		name: "曲目",
		source: "upload",
		audioAssetId: "asset-1",
		externalId: null,
		artists: [],
		album: null,
		sourceUrl: null,
		type: "bgm",
		duration: 120_000,
		audioSize: null,
		audioUploadedAt: null,
		createdAt: 1,
		...overrides,
	};
}

const tracks: LibraryTrack[] = [
	track({ id: "a", name: "雾港夜航", createdAt: 1, duration: 214_000 }),
	track({
		id: "b",
		name: "River Flows In You",
		source: "netease",
		audioAssetId: null,
		externalId: "5264842",
		artists: ["Yiruma"],
		album: "First Love",
		sourceUrl: "https://music.163.com/song?id=5264842",
		createdAt: 3,
		duration: 187_000,
		moduleName: "雾港疑案",
	}),
	track({
		id: "c",
		name: "汽笛 · 远",
		type: "se",
		createdAt: 2,
		duration: 6_000,
	}),
];

describe("filterTracks", () => {
	test("filters by type", () => {
		expect(filterTracks(tracks, { type: "se", query: "" }).map((t) => t.id)).toEqual(["c"]);
		expect(filterTracks(tracks, { type: "all", query: "" })).toHaveLength(3);
	});

	test("matches name, artist, album and module name case-insensitively", () => {
		const ids = (query: string) =>
			filterTracks(tracks, { type: "all", query }).map((item) => item.id);
		expect(ids("river")).toEqual(["b"]);
		expect(ids("YIRUMA")).toEqual(["b"]);
		expect(ids("first love")).toEqual(["b"]);
		expect(ids("雾港疑案")).toEqual(["b"]);
		expect(ids("汽笛")).toEqual(["c"]);
		expect(ids("   ")).toHaveLength(3);
		expect(ids("nothing-matches")).toEqual([]);
	});

	test("combines type and query", () => {
		expect(filterTracks(tracks, { type: "bgm", query: "汽笛" })).toEqual([]);
	});
});

describe("sortTracks", () => {
	test("added: newest first", () => {
		expect(sortTracks(tracks, "added").map((t) => t.id)).toEqual(["b", "c", "a"]);
	});

	test("duration: longest first", () => {
		expect(sortTracks(tracks, "duration").map((t) => t.id)).toEqual(["a", "b", "c"]);
	});

	test("name: numeric aware and does not mutate the input", () => {
		const numbered = [
			track({ id: "10", name: "第10首" }),
			track({ id: "2", name: "第2首" }),
		];
		expect(sortTracks(numbered, "name").map((t) => t.id)).toEqual(["2", "10"]);
		expect(numbered.map((t) => t.id)).toEqual(["10", "2"]);
	});
});

describe("sections and stats", () => {
	test("splits BGM and SE keeping order", () => {
		const sections = splitSections(tracks);
		expect(sections.bgm.map((t) => t.id)).toEqual(["a", "b"]);
		expect(sections.se.map((t) => t.id)).toEqual(["c"]);
	});

	test("counts tracks and sums durations", () => {
		expect(libraryStats(tracks)).toEqual({ count: 3, totalMs: 407_000 });
		expect(libraryStats([])).toEqual({ count: 0, totalMs: 0 });
	});

	test("formats total duration as a timecode", () => {
		expect(formatTotalDuration(20 * 60_000 + 59_000)).toBe("20:59");
		expect(formatTotalDuration(0)).toBe("00:00");
		expect(formatTotalDuration(77 * 60_000 + 3_000)).toBe("1:17:03");
	});
});

describe("guessTrackType", () => {
	test("short clips become SE, long or unknown lengths stay BGM", () => {
		expect(guessTrackType(2_000)).toBe("se");
		expect(guessTrackType(30_000)).toBe("se");
		expect(guessTrackType(30_001)).toBe("bgm");
		expect(guessTrackType(0)).toBe("bgm");
	});
});

describe("trackMetaParts and trackSourceTag", () => {
	test("uploads carry no filler text and no source tag", () => {
		expect(trackMetaParts(tracks[0] as LibraryTrack)).toEqual([]);
		expect(trackSourceTag(tracks[0] as LibraryTrack)).toBeNull();
	});

	test("platform tracks show artists and album, with the platform as a short tag", () => {
		expect(trackMetaParts(tracks[1] as LibraryTrack)).toEqual(["Yiruma", "First Love"]);
		expect(trackSourceTag(tracks[1] as LibraryTrack)).toBe("网易云");
		expect(trackSourceTag(track({ id: "q", source: "qq" }))).toBe("QQ");
	});

	test("multiple artists are joined", () => {
		expect(
			trackMetaParts(
				track({ id: "m", source: "netease", artists: ["Erik Satie", "Alexandre Tharaud"] }),
			),
		).toEqual(["Erik Satie / Alexandre Tharaud"]);
	});
});

describe("trackPlaybackPath", () => {
	test("uploads play from the media library", () => {
		expect(trackPlaybackPath(track({ id: "a", audioAssetId: "asset 1" }))).toBe(
			"/api/v1/media/asset%201",
		);
	});

	test("platform tracks are proxied through the server", () => {
		const platform: Pick<TrackDto, "id" | "source" | "audioAssetId"> = {
			id: "t/1",
			source: "qq",
			audioAssetId: null,
		};
		expect(trackPlaybackPath(platform)).toBe("/api/v1/music/tracks/t%2F1/stream");
	});

	test("an upload without audio has no source", () => {
		expect(trackPlaybackPath(track({ id: "a", audioAssetId: null }))).toBeNull();
	});
});

describe("filterModulesByQuery", () => {
	const modules = [{ name: "雾港疑案" }, { name: "沉默的灯塔" }, { name: "Gloom" }];

	test("empty query keeps everything in order", () => {
		expect(filterModulesByQuery(modules, " ").map((m) => m.name)).toEqual([
			"雾港疑案",
			"沉默的灯塔",
			"Gloom",
		]);
	});

	test("matches substrings case-insensitively", () => {
		expect(filterModulesByQuery(modules, "灯塔")).toEqual([{ name: "沉默的灯塔" }]);
		expect(filterModulesByQuery(modules, "GLOO")).toEqual([{ name: "Gloom" }]);
	});
});
