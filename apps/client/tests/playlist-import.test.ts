import { afterEach, describe, expect, mock, test } from "bun:test";
import type { MusicTrackDto, TrackDto } from "@cogm/shared";
import {
	createPlaylistImportRunner,
	mergePlaylistItems,
	runPlaylistImport,
} from "../src/features/gm-console/playlist-import";
import { usePlayStore } from "../src/stores/play-store";

function candidate(
	externalId: string,
	name = `歌曲 ${externalId}`,
): MusicTrackDto {
	return {
		provider: "netease",
		externalId,
		name,
		artists: [`艺术家 ${externalId}`],
		album: null,
		durationMs: 60_000,
		sourceUrl: `https://music.163.com/song?id=${externalId}`,
		availability: "unknown",
	};
}

function track(externalId: string, type: TrackDto["type"] = "bgm"): TrackDto {
	return {
		id: `track-${externalId}`,
		moduleId: "module-1",
		name: `歌曲 ${externalId}`,
		source: "netease",
		audioAssetId: null,
		externalId,
		artists: [`艺术家 ${externalId}`],
		album: null,
		sourceUrl: `https://music.163.com/song?id=${externalId}`,
		type,
		duration: 60_000,
		audioSize: null,
		audioUploadedAt: null,
		createdAt: 1,
	};
}

const formatError = (reason: unknown) =>
	reason instanceof Error ? reason.message : "未知错误";

afterEach(() => {
	usePlayStore.getState().reset();
});

describe("playlist candidate merging", () => {
	test("deduplicates across pages and excludes another provider", () => {
		const first = candidate("a");
		const second = candidate("b");
		const otherProvider = { ...candidate("c"), provider: "qq" as const };
		const merged = mergePlaylistItems(
			[first],
			[{ ...first, name: "重复项" }, second, otherProvider],
			"netease",
		);
		expect(merged.items).toEqual([first, second]);
		expect(merged.added).toEqual([second]);
	});
});

describe("playlist import orchestration", () => {
	test("adds serially, reports real progress, and stores each success immediately", async () => {
		const first = Promise.withResolvers<TrackDto>();
		const second = Promise.withResolvers<TrackDto>();
		const order: string[] = [];
		const progress: Array<{
			completed: number;
			total: number;
			currentId: string | null;
		}> = [];
		const runner = createPlaylistImportRunner();
		const running = runner.run({
			moduleId: "module-1",
			provider: "netease",
			type: "bgm",
			candidates: [candidate("a"), candidate("b")],
			existingTracks: [],
			formatError,
			addTrack: (_moduleId, _provider, externalId) => {
				order.push(externalId);
				return externalId === "a" ? first.promise : second.promise;
			},
			onAdded: usePlayStore.getState().addCatalogTrack,
			onProgress: (event) => {
				progress.push({
					completed: event.completed,
					total: event.total,
					currentId: event.current?.externalId ?? null,
				});
			},
		});
		await Promise.resolve();
		expect(order).toEqual(["a"]);
		first.resolve(track("a"));
		await Promise.resolve();
		await Promise.resolve();
		expect(order).toEqual(["a", "b"]);
		expect(
			usePlayStore.getState().catalogTracks.map((item) => item.externalId),
		).toContain("a");
		expect(usePlayStore.getState().catalogTracks).toHaveLength(1);
		expect(progress).toContainEqual({ completed: 1, total: 2, currentId: "a" });
		expect(progress.at(-1)).toEqual({ completed: 1, total: 2, currentId: "b" });
		second.resolve(track("b"));
		const result = await running;
		expect(result?.added.map((item) => item.externalId)).toEqual(["a", "b"]);
		expect(result?.completed).toBe(2);
		expect(result?.total).toBe(2);
		expect(result?.failures).toEqual([]);
		expect(progress.at(-1)).toEqual({
			completed: 2,
			total: 2,
			currentId: null,
		});
	});

	test("deduplicates and skips existing IDs regardless of track type", async () => {
		const addTrack = mock(() => Promise.resolve(track("a")));
		const result = await runPlaylistImport({
			moduleId: "module-1",
			provider: "netease",
			type: "bgm",
			candidates: [candidate("a"), candidate("a"), candidate("b")],
			existingTracks: [track("b", "se")],
			formatError,
			addTrack,
		});
		expect(addTrack).toHaveBeenCalledTimes(1);
		expect(result.total).toBe(2);
		expect(result.completed).toBe(2);
		expect(result.added).toHaveLength(1);
		expect(result.existing.map((item) => item.externalId)).toEqual(["b"]);
		expect(result.failures).toEqual([]);
	});

	test("continues after a failure and records the song and Chinese error", async () => {
		const order: string[] = [];
		const added: string[] = [];
		const result = await runPlaylistImport({
			moduleId: "module-1",
			provider: "netease",
			type: "se",
			candidates: [candidate("a"), candidate("b", "受限歌曲"), candidate("c")],
			existingTracks: [],
			formatError,
			addTrack: (_moduleId, _provider, externalId) => {
				order.push(externalId);
				if (externalId === "b") {
					return Promise.reject(new Error("这首歌曲当前不可公开播放"));
				}
				return Promise.resolve(track(externalId, "se"));
			},
			onAdded: (item) => added.push(item.externalId ?? ""),
		});
		expect(order).toEqual(["a", "b", "c"]);
		expect(added).toEqual(["a", "c"]);
		expect(result.added).toHaveLength(2);
		expect(result.failures).toEqual([
			{
				candidate: candidate("b", "受限歌曲"),
				message: "这首歌曲当前不可公开播放",
			},
		]);
		expect(result.completed).toBe(3);
	});

	test("protects against duplicate runs", async () => {
		const pending = Promise.withResolvers<TrackDto>();
		const addTrack = mock(() => pending.promise);
		const runner = createPlaylistImportRunner();
		const options = {
			moduleId: "module-1",
			provider: "netease" as const,
			type: "bgm" as const,
			candidates: [candidate("a")],
			existingTracks: [],
			formatError,
			addTrack,
		};
		const first = runner.run(options);
		await expect(runner.run(options)).resolves.toBeNull();
		expect(addTrack).toHaveBeenCalledTimes(1);
		pending.resolve(track("a"));
		await expect(first).resolves.not.toBeNull();
	});

	test("stop takes effect between tracks without cancelling the active request", async () => {
		const pending = Promise.withResolvers<TrackDto>();
		const addTrack = mock(() => pending.promise);
		const runner = createPlaylistImportRunner();
		const running = runner.run({
			moduleId: "module-1",
			provider: "netease",
			type: "bgm",
			candidates: [candidate("a"), candidate("b")],
			existingTracks: [],
			formatError,
			addTrack,
		});
		await Promise.resolve();
		runner.requestStop();
		expect(addTrack).toHaveBeenCalledTimes(1);
		pending.resolve(track("a"));
		const result = await running;
		expect(result?.added.map((item) => item.externalId)).toEqual(["a"]);
		expect(result?.completed).toBe(1);
		expect(result?.total).toBe(2);
		expect(result?.stopped).toBe(true);
		expect(addTrack).toHaveBeenCalledTimes(1);
	});
});
