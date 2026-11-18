import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import type {
	BgmState,
	MusicPlaylistDto,
	MusicTrackDto,
	TrackDto,
} from "@cogm/shared";
import {
	act,
	fireEvent,
	render,
	renderHook,
	waitFor,
} from "@testing-library/react";
import { AudioPanel } from "../src/features/gm-console/audio-panel";
import { useBgmPlayback } from "../src/features/gm-console/gm-audio";
import {
	addExternalTrack,
	resolveMusic,
	resolveMusicPlaylist,
	searchMusic,
} from "../src/features/gm-console/music-source";
import { type PlayState, usePlayStore } from "../src/stores/play-store";

const sent: Array<{ type: string; payload: Record<string, unknown> }> = [];

mock.module("@/lib/session-socket", () => ({
	sendSessionCommand: (type: string, payload: Record<string, unknown>) => {
		sent.push({ type, payload });
		return `audio-command-${sent.length}`;
	},
}));

const apiRequests: Array<{ path: string; init?: RequestInit }> = [];
let apiImplementation: (path: string, init?: RequestInit) => Promise<unknown> =
	() => Promise.reject(new Error("Unexpected API request"));

let restoreFetch: (() => void) | null = null;

const candidate: MusicTrackDto = {
	provider: "netease",
	externalId: "1913586094",
	name: "不合群",
	artists: ["测试艺术家"],
	album: "测试专辑",
	durationMs: 180_000,
	sourceUrl: "https://music.163.com/song?id=1913586094",
	availability: "unknown",
};

const externalTrack: TrackDto = {
	id: "track-netease",
	moduleId: "module-1",
	name: candidate.name,
	source: "netease",
	audioAssetId: null,
	externalId: candidate.externalId,
	artists: candidate.artists,
	album: candidate.album,
	sourceUrl: candidate.sourceUrl,
	type: "bgm",
	duration: candidate.durationMs,
	audioSize: null,
	audioUploadedAt: null,
	createdAt: 5,
};

const trackMetadata = {
	source: "upload" as const,
	externalId: null,
	artists: [] as string[],
	album: null,
	sourceUrl: null,
};

const tracks: TrackDto[] = [
	{
		...trackMetadata,
		id: "track-a",
		moduleId: "module-1",
		name: "雨夜车站",
		audioAssetId: "asset-a",
		type: "bgm",
		duration: 180_000,
		audioSize: 1000,
		audioUploadedAt: 1,
		createdAt: 1,
	},
	{
		...trackMetadata,
		id: "track-b",
		moduleId: "module-1",
		name: "旧宅回声",
		audioAssetId: "asset-b",
		type: "bgm",
		duration: 120_000,
		audioSize: 1000,
		audioUploadedAt: 1,
		createdAt: 2,
	},
	{
		...trackMetadata,
		id: "track-c",
		moduleId: "module-1",
		name: "雾中脚步",
		audioAssetId: "asset-c",
		type: "bgm",
		duration: 90_000,
		audioSize: 1000,
		audioUploadedAt: 1,
		createdAt: 3,
	},
	{
		...trackMetadata,
		id: "se-door",
		moduleId: "module-1",
		name: "开门声",
		audioAssetId: "asset-door",
		type: "se",
		duration: 2_000,
		audioSize: 100,
		audioUploadedAt: 1,
		createdAt: 4,
	},
];

function bgm(overrides: Partial<BgmState> = {}): BgmState {
	return {
		trackId: "track-a",
		playing: true,
		volume: 64,
		loop: true,
		seekOffsetMs: 65_000,
		startedAtMs: Date.now(),
		version: 4,
		durationMs: 180_000,
		name: "雨夜车站",
		audioAssetId: "asset-a",
		...overrides,
	};
}

function seed(overrides: Partial<PlayState> = {}) {
	usePlayStore.getState().reset();
	usePlayStore.setState({
		connected: true,
		snapshotReady: true,
		catalogStatus: "ready",
		catalogTracks: tracks,
		bgm: bgm(),
		...overrides,
	});
}

function renderPanel() {
	return render(<AudioPanel onClose={() => undefined} />);
}

beforeEach(() => {
	sent.length = 0;
	apiRequests.length = 0;
	apiImplementation = () => Promise.reject(new Error("Unexpected API request"));
	const fetchSpy = spyOn(globalThis, "fetch");
	fetchSpy.mockImplementation(
		Object.assign(
			async (input: RequestInfo | URL, init?: RequestInit) => {
				const rawUrl =
					typeof input === "string"
						? input
						: input instanceof URL
							? input.href
							: input.url;
				const url = new URL(rawUrl, "http://localhost");
				const path = `${url.pathname}${url.search}`;
				const apiPath = path.startsWith("/api/v1")
					? path.slice("/api/v1".length)
					: path;
				apiRequests.push({ path: apiPath, init });
				return Response.json(await apiImplementation(apiPath, init));
			},
			{
				preconnect: (
					url: string | URL,
					options?: {
						dns?: boolean;
						tcp?: boolean;
						http?: boolean;
						https?: boolean;
					},
				) => globalThis.fetch.preconnect(url, options),
			},
		),
	);
	restoreFetch = () => fetchSpy.mockRestore();
	seed({ moduleId: "module-1" });
});

afterEach(() => {
	restoreFetch?.();
	restoreFetch = null;
});

describe("sound panel hierarchy and states", () => {
	test("empty playback stays compact and exposes only one close action", () => {
		seed({ bgm: null, catalogTracks: [] });
		const view = renderPanel();
		expect(view.getByText("当前播放")).toBeTruthy();
		expect(view.getByText("还没有正在播放的曲目")).toBeTruthy();
		expect(view.queryByRole("slider", { name: "播放进度" })).toBeNull();
		expect(view.queryByRole("button", { name: "暂停" })).toBeNull();
		expect(view.queryByRole("button", { name: "完成" })).toBeNull();
		expect(view.getAllByRole("button", { name: "关闭" })).toHaveLength(1);
		expect(view.getByText("模组中还没有背景音乐")).toBeTruthy();
		expect(view.getByText("模组中还没有即兴音效")).toBeTruthy();
	});

	test("current track, progress and playback state are readable", () => {
		const view = renderPanel();
		expect(view.getAllByText("雨夜车站").length).toBeGreaterThan(0);
		expect(view.getByText("正在向全团同步")).toBeTruthy();
		const progress = view.getByRole("slider", { name: "播放进度" });
		expect(progress.getAttribute("aria-valuetext")).toBe(
			"已播放 01:05，共 03:00",
		);
		expect(view.getByRole("button", { name: "暂停" })).toBeTruthy();
	});

	test("loop and fade controls describe their actual behavior without duplication", () => {
		seed({ bgm: bgm({ loop: false }) });
		const view = renderPanel();
		expect(view.getByRole("switch", { name: "循环当前曲目" })).toBeTruthy();
		expect(view.getByText("播完自动停止")).toBeTruthy();
		expect(view.queryByText("单曲播放")).toBeNull();
		expect(view.getByRole("combobox", { name: "淡入淡出时长" })).toBeTruthy();
		expect(view.getByRole("button", { name: "淡出至无声" })).toBeTruthy();
		expect(view.queryByRole("button", { name: "淡入" })).toBeNull();
	});

	test("track rows select music and sound effects use explicit accessible names", () => {
		const view = renderPanel();
		fireEvent.click(view.getByRole("button", { name: "播放曲目：旧宅回声" }));
		expect(sent[0]).toEqual({
			type: "audio:bgm",
			payload: {
				action: "play",
				expectedVersion: 4,
				trackId: "track-b",
			},
		});
		fireEvent.click(view.getByRole("button", { name: "播放音效：开门声" }));
		expect(sent[1]).toEqual({
			type: "audio:se",
			payload: { trackId: "se-door" },
		});
	});

	test("catalog loading and failure are distinct and failure can retry", () => {
		seed({ catalogStatus: "loading", catalogTracks: [] });
		const loading = renderPanel();
		expect(loading.getByText("正在载入曲目与音效")).toBeTruthy();
		loading.unmount();
		seed({ catalogStatus: "error", catalogTracks: [] });
		const failed = renderPanel();
		expect(failed.getByRole("alert").textContent).toContain("曲目列表载入失败");
		const revision = usePlayStore.getState().catalogRevision;
		fireEvent.click(failed.getByRole("button", { name: "重试载入" }));
		expect(usePlayStore.getState().catalogRevision).toBe(revision + 1);
	});

	test("offline state disables broadcast controls and explains why", () => {
		seed({ connected: false });
		const view = renderPanel();
		expect(view.getByRole("alert").textContent).toContain("连接已断开");
		expect(
			view.getByRole("button", { name: "暂停" }).hasAttribute("disabled"),
		).toBe(true);
		expect(
			view
				.getByRole("button", { name: "播放音效：开门声" })
				.hasAttribute("disabled"),
		).toBe(true);
	});
});

describe("BGM command behavior", () => {
	test("previous from no selection chooses the last list item", () => {
		seed({ bgm: null });
		const hook = renderHook(() => useBgmPlayback());
		act(() => hook.result.current.previous());
		expect(sent[0]?.payload).toEqual({
			action: "play",
			expectedVersion: 0,
			trackId: "track-c",
		});
	});

	test("volume previews a draft and commits one authoritative command", () => {
		const hook = renderHook(() => useBgmPlayback());
		act(() => hook.result.current.setVolumeDraft(63));
		expect(hook.result.current.displayVolume).toBe(63);
		expect(sent).toHaveLength(0);
		act(() => hook.result.current.commitVolume(63));
		expect(sent).toHaveLength(1);
		expect(sent[0]?.payload).toEqual({
			action: "volume",
			expectedVersion: 4,
			volume: 63,
		});
	});

	test("BGM controls wait for the authoritative version before another command", async () => {
		const view = renderPanel();
		fireEvent.click(view.getByRole("button", { name: "暂停" }));
		expect(
			view
				.getByRole("button", { name: "下一首（按曲目列表）" })
				.hasAttribute("disabled"),
		).toBe(true);
		act(() => {
			usePlayStore.setState({ bgm: bgm({ playing: false, version: 5 }) });
		});
		await waitFor(() =>
			expect(
				view
					.getByRole("button", { name: "下一首（按曲目列表）" })
					.hasAttribute("disabled"),
			).toBe(false),
		);
	});

	test("a rejected BGM command restores controls and shows the error inline", async () => {
		const view = renderPanel();
		fireEvent.click(view.getByRole("button", { name: "暂停" }));
		act(() => {
			usePlayStore.getState().applyMessage({
				protocolVersion: 1,
				commandId: "audio-command-1",
				type: "command:rejected",
				payload: { code: "AUDIO_VERSION_CONFLICT" },
			});
		});
		await waitFor(() =>
			expect(view.getByRole("alert").textContent).toContain(
				"音频状态已更新，请重试",
			),
		);
		expect(
			view
				.getByRole("button", { name: "下一首（按曲目列表）" })
				.hasAttribute("disabled"),
		).toBe(false);
	});
});

describe("platform music sources", () => {
	test.skip("searches, marks availability unknown, and adds once from the panel [skip: happy-dom does not emit React controlled text onChange]", async () => {
		const pendingAdd = Promise.withResolvers<TrackDto>();
		apiImplementation = (path) => {
			if (path.startsWith("/gm/music/search")) {
				return Promise.resolve({ items: [candidate] });
			}
			return pendingAdd.promise;
		};
		const view = renderPanel();
		const input = view.getByRole("textbox", {
			name: "搜索歌曲",
		}) as HTMLInputElement;
		act(() => {
			const setter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				"value",
			)?.set;
			if (!setter) throw new Error("Missing input value setter");
			setter.call(input, "不合群");
			input.dispatchEvent(
				new window.InputEvent("input", {
					bubbles: true,
					composed: true,
					inputType: "insertText",
					data: "不合群",
				}),
			);
		});
		await waitFor(() =>
			expect(
				view.getByRole("button", { name: "搜索" }).hasAttribute("disabled"),
			).toBe(false),
		);
		expect(input.value).toBe("不合群");
		const searchButton = view.getByRole("button", { name: "搜索" });
		expect(searchButton.hasAttribute("disabled")).toBe(false);
		fireEvent.click(searchButton);
		expect(await view.findByText("可播性待验证")).toBeTruthy();
		const addButton = view.getByRole("button", { name: "添加歌曲：不合群" });
		fireEvent.click(addButton);
		fireEvent.click(addButton);
		expect(
			apiRequests.filter((request) => request.init?.method === "POST"),
		).toHaveLength(1);
		await act(async () => pendingAdd.resolve(externalTrack));
		await waitFor(() =>
			expect(
				usePlayStore
					.getState()
					.catalogTracks.some((track) => track.id === externalTrack.id),
			).toBe(true),
		);
		const post = apiRequests.find((request) => request.init?.method === "POST");
		expect(JSON.parse(String(post?.init?.body))).toEqual({
			source: "netease",
			reference: candidate.externalId,
			type: "bgm",
		});
	});

	test("uses the search, resolve and add REST contracts", async () => {
		apiImplementation = (path) => {
			if (path.startsWith("/gm/music/search")) {
				return Promise.resolve({ items: [candidate] });
			}
			if (path === "/gm/music/resolve") {
				return Promise.resolve(candidate);
			}
			return Promise.resolve(externalTrack);
		};
		await expect(searchMusic("netease", "不合群")).resolves.toEqual([
			candidate,
		]);
		await expect(
			resolveMusic("netease", candidate.externalId),
		).resolves.toEqual(candidate);
		await expect(
			addExternalTrack("module-1", "netease", candidate.externalId, "bgm"),
		).resolves.toEqual(externalTrack);
		expect(apiRequests[0]?.path).toContain("provider=netease");
		expect(apiRequests[0]?.path).toContain("query=%E4%B8%8D%E5%90%88%E7%BE%A4");
		expect(JSON.parse(String(apiRequests[1]?.init?.body))).toEqual({
			provider: "netease",
			reference: candidate.externalId,
		});
		expect(apiRequests[2]?.path).toBe("/gm/modules/module-1/tracks");
		expect(JSON.parse(String(apiRequests[2]?.init?.body))).toEqual({
			source: "netease",
			reference: candidate.externalId,
			type: "bgm",
		});
	});

	test("uses the playlist resolve REST contract and pagination defaults", async () => {
		const playlist = {
			provider: "netease",
			playlistId: "3778678",
			name: "热歌榜",
			coverUrl: null,
			description: null,
			creator: null,
			sourceUrl: "https://music.163.com/playlist?id=3778678",
			totalCount: 200,
			items: [candidate],
			nextOffset: 50,
		} satisfies MusicPlaylistDto;
		apiImplementation = (path) => {
			if (path === "/gm/music/playlists/resolve") {
				return Promise.resolve(playlist);
			}
			return Promise.reject(new Error("Unexpected API request"));
		};
		await expect(resolveMusicPlaylist("netease", "3778678")).resolves.toEqual(
			playlist,
		);
		await expect(
			resolveMusicPlaylist("netease", "3778678", 50, 50),
		).resolves.toEqual(playlist);
		expect(apiRequests[0]?.path).toBe("/gm/music/playlists/resolve");
		expect(JSON.parse(String(apiRequests[0]?.init?.body))).toEqual({
			provider: "netease",
			reference: "3778678",
			offset: 0,
			limit: 50,
		});
		expect(JSON.parse(String(apiRequests[1]?.init?.body))).toEqual({
			provider: "netease",
			reference: "3778678",
			offset: 50,
			limit: 50,
		});
	});

	test("propagates platform failures to the caller", async () => {
		apiImplementation = () =>
			Promise.reject(new Error("音乐平台暂时无法访问，请稍后重试"));
		await expect(searchMusic("qq", "失败")).rejects.toThrow(
			"音乐平台暂时无法访问",
		);
	});

	test("playback errors offer a real retry revision", () => {
		seed({
			audioPlaybackStatus: "error",
			audioPlaybackError: "音频加载或播放失败，请检查网络后重试",
		});
		const view = renderPanel();
		const revision = usePlayStore.getState().audioRetryRevision;
		fireEvent.click(view.getByRole("button", { name: "重试播放" }));
		expect(usePlayStore.getState().audioRetryRevision).toBe(revision + 1);
		expect(usePlayStore.getState().audioPlaybackStatus).toBe("loading");
	});
});
