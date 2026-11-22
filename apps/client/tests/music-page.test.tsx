import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { act, fireEvent, render, waitFor, within } from "@testing-library/react";
import { type ReactNode, useSyncExternalStore } from "react";

// ---- 路由：用一个小 store 模拟 URL 搜索参数 ----
const searchStore = {
	value: {} as { module?: string },
	listeners: new Set<() => void>(),
	set(next: { module?: string }) {
		this.value = next;
		for (const listener of this.listeners) listener();
	},
};
mock.module("@tanstack/react-router", () => ({
	createFileRoute: () => (options: Record<string, unknown>) => ({
		...options,
		fullPath: "/gm/music",
		useSearch: () =>
			useSyncExternalStore(
				(listener) => {
					searchStore.listeners.add(listener);
					return () => searchStore.listeners.delete(listener);
				},
				() => searchStore.value,
			),
	}),
	useNavigate: () => (options: { search: { module?: string } }) => {
		searchStore.set(options.search);
	},
	Link: ({ to, children }: { to: string; children: ReactNode }) => (
		<a href={to}>{children}</a>
	),
}));
mock.module("@/features/gm-admin/admin-layout", () => ({
	AdminLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
mock.module("@/lib/identity", () => ({ requireGmAuth: () => undefined }));
mock.module("@/lib/use-media-query", () => ({ useMediaQuery: () => true }));
mock.module("@/lib/audio-duration", () => ({
	audioDurationMs: async (file: File) => (file.name.startsWith("敲门") ? 2000 : 200_000),
}));

// ---- 提示 ----
const toasts = { success: [] as string[], error: [] as string[], message: [] as string[] };
mock.module("sonner", () => ({
	toast: {
		success: (text: string) => toasts.success.push(text),
		error: (text: string) => toasts.error.push(text),
		message: (text: string) => toasts.message.push(text),
	},
}));

// ---- 试听：假的 Howl ----
type HowlOptions = {
	src: string[];
	format?: string[];
	loop?: boolean;
	volume?: number;
};
const howls: Array<{ options: HowlOptions; unloaded: boolean; played: boolean }> = [];
mock.module("howler", () => ({
	Howl: class {
		record: { options: HowlOptions; unloaded: boolean; played: boolean };
		constructor(options: HowlOptions) {
			this.record = { options, unloaded: false, played: false };
			howls.push(this.record);
		}
		once() {}
		on() {}
		play() {
			this.record.played = true;
		}
		unload() {
			this.record.unloaded = true;
		}
		seek() {
			return 12;
		}
		duration() {
			return 200;
		}
		volume() {}
	},
}));

// ---- 接口 ----
type Track = {
	id: string;
	moduleId: string;
	name: string;
	source: "upload" | "netease" | "qq";
	audioAssetId: string | null;
	externalId: string | null;
	artists: string[];
	album: string | null;
	sourceUrl: string | null;
	type: "bgm" | "se";
	duration: number;
	audioSize: number | null;
	audioUploadedAt: number | null;
	createdAt: number;
};
const baseTrack = (overrides: Partial<Track> & { id: string; moduleId: string }): Track => ({
	name: overrides.id,
	source: "upload",
	audioAssetId: `asset-${overrides.id}`,
	externalId: null,
	artists: [],
	album: null,
	sourceUrl: null,
	type: "bgm",
	duration: 180_000,
	audioSize: null,
	audioUploadedAt: null,
	createdAt: 1,
	...overrides,
});

const MODULES = [
	{ id: "m1", name: "雾港疑案" },
	{ id: "m2", name: "沉默的灯塔" },
];
let db: Track[] = [];
const calls: Array<{ method: string; path: string; body?: unknown }> = [];

function resetDb() {
	db = [
		baseTrack({ id: "夜航", moduleId: "m1", createdAt: 3 }),
		baseTrack({
			id: "River",
			moduleId: "m1",
			name: "River Flows In You",
			source: "netease",
			audioAssetId: null,
			artists: ["Yiruma"],
			album: "First Love",
			createdAt: 2,
		}),
		baseTrack({ id: "汽笛", moduleId: "m1", type: "se", duration: 6000, createdAt: 1 }),
		baseTrack({ id: "灯塔风", moduleId: "m2", createdAt: 4 }),
	];
}

function respond(path: string, method: string, body?: unknown): unknown {
	if (path === "/gm/modules/summaries") {
		return MODULES.map((module) => ({
			moduleId: module.id,
			trackCount: db.filter((track) => track.moduleId === module.id).length,
		}));
	}
	if (path === "/media/upload") {
		return { id: "asset-new" };
	}
	const create = path.match(/^\/gm\/modules\/([^/]+)\/tracks$/);
	if (create && method === "POST") {
		const payload = body as { name: string; type: "bgm" | "se"; duration: number };
		const created = baseTrack({
			id: `new-${db.length}`,
			moduleId: create[1] as string,
			name: payload.name,
			type: payload.type,
			duration: payload.duration,
			createdAt: 99,
		});
		db.push(created);
		return created;
	}
	const one = path.match(/^\/gm\/modules\/tracks\/([^/]+)$/);
	if (one && method === "PATCH") {
		const track = db.find((item) => item.id === decodeURIComponent(one[1] as string));
		Object.assign(track as Track, body as object);
		return track;
	}
	if (one && method === "DELETE") {
		db = db.filter((item) => item.id !== decodeURIComponent(one[1] as string));
		return { success: true };
	}
	return null;
}

mock.module("@/lib/api", () => ({
	api: async (path: string, init: { method?: string; body?: unknown } = {}) => {
		const method = init.method ?? "GET";
		const parsed =
			typeof init.body === "string" ? JSON.parse(init.body) : init.body ? "form" : undefined;
		calls.push({ method, path, body: parsed });
		return respond(path, method, parsed);
	},
	fetchAllPages: async (path: string) => {
		calls.push({ method: "GET", path });
		if (path === "/gm/modules") return MODULES;
		if (path === "/gm/modules/tracks") {
			return db.map((track) => ({
				...track,
				moduleName: MODULES.find((module) => module.id === track.moduleId)?.name,
			}));
		}
		const match = path.match(/^\/gm\/modules\/([^/]+)\/tracks$/);
		return db.filter((track) => track.moduleId === match?.[1]);
	},
	isApiError: () => false,
	mediaUrl: (id: string | null | undefined) => (id ? `/api/v1/media/${id}` : null),
}));

const { Route } = await import("../src/routes/gm/music");
const Page = (Route as unknown as { component: () => ReactNode }).component;

// 弹层打开时 happy-dom 的角色查询很慢，给这些用例更长的时间
const SLOW_MS = 30_000;
const view = () => within(document.body);

async function renderPage(initial: { module?: string } = {}) {
	searchStore.value = initial;
	render(<Page />);
	await waitFor(() => expect(view().getByRole("heading", { level: 1 })).toBeTruthy());
}

beforeEach(() => {
	resetDb();
	calls.length = 0;
	howls.length = 0;
	toasts.success.length = 0;
	toasts.error.length = 0;
	toasts.message.length = 0;
	localStorage.clear();
	searchStore.value = {};
});
afterEach(() => {
	searchStore.listeners.clear();
});

describe("music page", () => {
	test("opens the first module with BGM and SE acts and live counts in the nav", async () => {
		await renderPage();
		await waitFor(() => expect(view().getByText("River Flows In You")).toBeTruthy());
		expect(view().getByRole("heading", { level: 1 }).textContent).toBe("雾港疑案");
		expect(view().getByRole("region", { name: "SE" })).toBeTruthy();
		expect(document.querySelector("[data-music-stats]")?.textContent).toBe("3 首 · 06:06");
		const nav = view().getByRole("navigation", { name: "模组" });
		expect(within(nav).getByRole("button", { name: /雾港疑案/ }).textContent).toContain("3");
		expect(within(nav).getByRole("button", { name: /全部曲目/ }).textContent).toContain("4");
		expect(localStorage.getItem("cogm.gmMusicModule")).toBe("m1");
	});

	test("switching module loads that module's tracks and remembers it", async () => {
		await renderPage();
		await waitFor(() => view().getByText("River Flows In You"));
		fireEvent.click(
			within(view().getByRole("navigation", { name: "模组" })).getByRole("button", {
				name: /沉默的灯塔/,
			}),
		);
		await waitFor(() => expect(view().getByText("灯塔风")).toBeTruthy());
		expect(view().queryByText("River Flows In You")).toBeNull();
		expect(localStorage.getItem("cogm.gmMusicModule")).toBe("m2");
	});

	test("restores the last module from storage", async () => {
		localStorage.setItem("cogm.gmMusicModule", "m2");
		await renderPage();
		await waitFor(() => expect(view().getByText("灯塔风")).toBeTruthy());
	});

	test("search and type filter narrow the ledger and can be cleared", async () => {
		await renderPage();
		await waitFor(() => view().getByText("River Flows In You"));
		const search = view().getByRole("searchbox", { name: "搜索曲目" });
		fireEvent.input(search, { target: { value: "yiruma" } });
		await waitFor(() => expect(view().queryByText("夜航")).toBeNull());
		expect(view().getByText("River Flows In You")).toBeTruthy();

		fireEvent.input(search, { target: { value: "没有这首" } });
		await waitFor(() => expect(view().getByText("没有符合的曲目")).toBeTruthy());
		fireEvent.click(view().getByRole("button", { name: "清除筛选" }));
		await waitFor(() => expect(view().getByText("夜航")).toBeTruthy());

		fireEvent.click(view().getByRole("radio", { name: "SE" }));
		await waitFor(() => expect(view().queryByText("夜航")).toBeNull());
		expect(view().getByText("汽笛")).toBeTruthy();
	});

	test("all-tracks view lists every module's tracks grouped by module", async () => {
		await renderPage();
		await waitFor(() => view().getByText("River Flows In You"));
		fireEvent.click(
			within(view().getByRole("navigation", { name: "模组" })).getByRole("button", {
				name: /全部曲目/,
			}),
		);
		await waitFor(() => expect(view().getByText("灯塔风")).toBeTruthy());
		expect(calls.some((call) => call.path === "/gm/modules/tracks")).toBe(true);
		const bgm = view().getByRole("region", { name: "BGM" });
		expect(within(bgm).getByText("沉默的灯塔")).toBeTruthy();
		expect(within(bgm).getByText("雾港疑案")).toBeTruthy();
		// 全部曲目里不能直接添加：需要先选模组
		expect(view().queryByRole("button", { name: "添加曲目" })).toBeNull();
	});

	test("deleting a track asks first, then removes it everywhere", async () => {
		await renderPage();
		await waitFor(() => view().getByText("River Flows In You"));
		fireEvent.pointerDown(view().getByRole("button", { name: "夜航 的更多操作" }), {
			button: 0,
			ctrlKey: false,
		});
		fireEvent.click(await view().findByRole("menuitem", { name: "删除" }));
		expect(await view().findByText(/确认删除「夜航」/)).toBeTruthy();
		expect(calls.some((call) => call.method === "DELETE")).toBe(false);
		const dialog = view().getByRole("alertdialog");
		fireEvent.click(within(dialog).getByRole("button", { name: "删除" }));
		await waitFor(() => expect(view().queryByText("夜航")).toBeNull());
		expect(calls.filter((call) => call.method === "DELETE")).toEqual([
			{ method: "DELETE", path: "/gm/modules/tracks/%E5%A4%9C%E8%88%AA", body: undefined },
		]);
		await waitFor(() =>
			expect(document.querySelector("[data-music-stats]")?.textContent).toBe("2 首 · 03:06"),
		);
	}, SLOW_MS);

	test("renaming goes through the menu and Enter", async () => {
		await renderPage();
		await waitFor(() => view().getByText("River Flows In You"));
		fireEvent.pointerDown(view().getByRole("button", { name: "夜航 的更多操作" }), {
			button: 0,
			ctrlKey: false,
		});
		fireEvent.click(await view().findByRole("menuitem", { name: "重命名" }));
		const input = await view().findByRole("textbox", { name: "重命名 夜航" });
		fireEvent.input(input, { target: { value: "雾港夜航（长）" } });
		fireEvent.keyDown(input, { key: "Enter" });
		await waitFor(() => expect(view().getByText("雾港夜航（长）")).toBeTruthy());
		expect(calls.find((call) => call.method === "PATCH")?.body).toEqual({
			name: "雾港夜航（长）",
		});
	}, SLOW_MS);

	test("changing type moves the track to the other act", async () => {
		await renderPage();
		await waitFor(() => view().getByText("River Flows In You"));
		fireEvent.pointerDown(view().getByRole("button", { name: "夜航 的更多操作" }), {
			button: 0,
			ctrlKey: false,
		});
		fireEvent.click(await view().findByRole("menuitem", { name: "改为 SE" }));
		await waitFor(() =>
			expect(within(view().getByRole("region", { name: "SE" })).getByText("夜航")).toBeTruthy(),
		);
	}, SLOW_MS);

	test("bulk selection retypes and deletes with a single confirmation", async () => {
		await renderPage();
		await waitFor(() => view().getByText("River Flows In You"));
		fireEvent.click(view().getAllByRole("checkbox", { name: "选择 夜航" })[0] as HTMLElement);
		fireEvent.click(
			view().getAllByRole("checkbox", { name: "选择 River Flows In You" })[0] as HTMLElement,
		);
		expect(await view().findByText("已选 2 首")).toBeTruthy();

		fireEvent.click(view().getByRole("button", { name: "设为 SE" }));
		await waitFor(() => expect(toasts.success).toContain("已处理 2 首"));
		expect(calls.filter((call) => call.method === "PATCH")).toHaveLength(2);

		fireEvent.click(view().getAllByRole("checkbox", { name: "选择 夜航" })[0] as HTMLElement);
		fireEvent.click(
			view().getAllByRole("checkbox", { name: "选择 汽笛" })[0] as HTMLElement,
		);
		fireEvent.click(view().getByRole("button", { name: "删除" }));
		expect(await view().findByText("删除 2 首曲目")).toBeTruthy();
		fireEvent.click(within(view().getByRole("alertdialog")).getByRole("button", { name: "删除" }));
		await waitFor(() => expect(view().queryByText("汽笛")).toBeNull());
		expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(2);
	}, SLOW_MS);

	test("auditioning plays from the media library, loops BGM and stops on request", async () => {
		await renderPage();
		await waitFor(() => view().getByText("River Flows In You"));
		fireEvent.click(view().getByRole("button", { name: "试听 夜航" }));
		expect(howls).toHaveLength(1);
		expect(howls[0]?.options.src).toEqual(["/api/v1/media/asset-夜航"]);
		expect(howls[0]?.options.loop).toBe(true);
		expect(howls[0]?.played).toBe(true);
		expect(view().getByRole("region", { name: "正在试听" })).toBeTruthy();

		// 切到另一个模组，试听条仍在，可以停止
		fireEvent.click(
			within(view().getByRole("navigation", { name: "模组" })).getByRole("button", {
				name: /沉默的灯塔/,
			}),
		);
		await waitFor(() => view().getByText("灯塔风"));
		expect(view().getByRole("region", { name: "正在试听" })).toBeTruthy();
		fireEvent.click(view().getByRole("button", { name: "停止试听" }));
		expect(howls[0]?.unloaded).toBe(true);
		expect(view().queryByRole("region", { name: "正在试听" })).toBeNull();
	});

	test("platform tracks audition through the server stream and SE plays once", async () => {
		await renderPage();
		await waitFor(() => view().getByText("River Flows In You"));
		fireEvent.click(view().getByRole("button", { name: "试听 River Flows In You" }));
		expect(howls[0]?.options.src).toEqual(["/api/v1/music/tracks/River/stream"]);
		expect(howls[0]?.options.format).toEqual(["mp3"]);
		fireEvent.click(view().getByRole("button", { name: "试听 汽笛" }));
		expect(howls[0]?.unloaded).toBe(true);
		expect(howls[1]?.options.loop).toBe(false);
	});

	test("deleting the track being auditioned stops it", async () => {
		await renderPage();
		await waitFor(() => view().getByText("River Flows In You"));
		fireEvent.click(view().getByRole("button", { name: "试听 夜航" }));
		fireEvent.pointerDown(view().getByRole("button", { name: "夜航 的更多操作" }), {
			button: 0,
			ctrlKey: false,
		});
		fireEvent.click(await view().findByRole("menuitem", { name: "删除" }));
		fireEvent.click(within(await view().findByRole("alertdialog")).getByRole("button", { name: "删除" }));
		await waitFor(() => expect(view().queryByRole("region", { name: "正在试听" })).toBeNull());
		expect(howls[0]?.unloaded).toBe(true);
	}, SLOW_MS);

	test("adding opens the dialog; uploads guess the type from duration and add the tracks", async () => {
		await renderPage();
		await waitFor(() => view().getByText("River Flows In You"));
		fireEvent.click(view().getByRole("button", { name: "添加曲目" }));
		const dialog = await view().findByRole("dialog");
		expect(within(dialog).getByText("到「雾港疑案」")).toBeTruthy();

		const input = within(dialog).getByTestId("music-file-input") as HTMLInputElement;
		const files = [
			new File(["a"], "夜雨.mp3", { type: "audio/mpeg" }),
			new File(["b"], "敲门声.wav", { type: "audio/wav" }),
			new File(["c"], "说明.txt", { type: "text/plain" }),
		];
		await act(async () => {
			fireEvent.change(input, { target: { files } });
		});
		await waitFor(() => expect(within(dialog).getAllByRole("textbox")).toHaveLength(2));
		expect(toasts.error).toContain("只能上传音频文件");
		// 2 秒的“敲门声”被猜成 SE，200 秒的“夜雨”保持 BGM
		await waitFor(() => {
			const knock = within(dialog).getByRole("radiogroup", { name: "敲门声 的类型" });
			expect(within(knock).getByRole("radio", { name: "SE" }).getAttribute("aria-checked")).toBe(
				"true",
			);
		});
		const rain = within(dialog).getByRole("radiogroup", { name: "夜雨 的类型" });
		expect(within(rain).getByRole("radio", { name: "BGM" }).getAttribute("aria-checked")).toBe(
			"true",
		);

		fireEvent.click(within(dialog).getByRole("button", { name: "添加 2 首" }));
		await waitFor(() => expect(within(dialog).getByRole("button", { name: "完成" })).toBeTruthy());
		const created = calls.filter(
			(call) => call.method === "POST" && /\/gm\/modules\/m1\/tracks$/.test(call.path),
		);
		expect(created.map((call) => call.body)).toEqual([
			{ name: "夜雨", audioAssetId: "asset-new", type: "bgm", duration: 200_000 },
			{ name: "敲门声", audioAssetId: "asset-new", type: "se", duration: 2000 },
		]);
		fireEvent.click(within(dialog).getByRole("button", { name: "完成" }));
		await waitFor(() => expect(view().queryByRole("dialog")).toBeNull());
		expect(view().getByText("夜雨")).toBeTruthy();
		expect(within(view().getByRole("region", { name: "SE" })).getByText("敲门声")).toBeTruthy();
	}, SLOW_MS);

	test("dropping audio files on the page opens the upload queue", async () => {
		await renderPage();
		await waitFor(() => view().getByText("River Flows In You"));
		const stage = document.querySelector("[data-music-dropzone]");
		const file = new File(["x"], "落雨.mp3", { type: "audio/mpeg" });
		await act(async () => {
			fireEvent.drop(stage as HTMLElement, {
				dataTransfer: { files: [file], types: ["Files"] },
			});
		});
		const dialog = await view().findByRole("dialog");
		await waitFor(() =>
			expect((within(dialog).getByRole("textbox") as HTMLInputElement).value).toBe("落雨"),
		);
	}, SLOW_MS);

	test("dropping in the all-tracks view asks to pick a module first", async () => {
		await renderPage({ module: "all" });
		await waitFor(() => view().getByText("灯塔风"));
		const stage = document.querySelector("[data-music-dropzone]");
		fireEvent.drop(stage as HTMLElement, {
			dataTransfer: { files: [new File(["x"], "落雨.mp3", { type: "audio/mpeg" })], types: ["Files"] },
		});
		expect(toasts.message).toContain("先在左侧选一个模组，再拖入文件");
		expect(view().queryByRole("dialog")).toBeNull();
	});
});
