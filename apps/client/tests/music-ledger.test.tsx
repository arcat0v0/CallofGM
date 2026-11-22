import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, within } from "@testing-library/react";
import type { LibraryTrack } from "../src/features/gm-music/music-library-model";

const { TrackLedger } = await import("../src/features/gm-music/track-ledger");
const { AuditionBar } = await import("../src/features/gm-music/audition-bar");

function track(overrides: Partial<LibraryTrack> & { id: string }): LibraryTrack {
	return {
		moduleId: "m1",
		name: overrides.id,
		source: "upload",
		audioAssetId: "asset",
		externalId: null,
		artists: [],
		album: null,
		sourceUrl: null,
		type: "bgm",
		duration: 180_000,
		audioSize: null,
		audioUploadedAt: null,
		createdAt: 1,
		moduleName: "雾港疑案",
		...overrides,
	};
}

const tracks: LibraryTrack[] = [
	track({ id: "夜航", duration: 214_000 }),
	track({
		id: "River",
		name: "River Flows In You",
		source: "netease",
		audioAssetId: null,
		artists: ["Yiruma"],
		album: "First Love",
		sourceUrl: "https://music.163.com/song?id=1",
	}),
	track({ id: "汽笛", type: "se", duration: 6_000 }),
];

function renderLedger(overrides: Partial<Parameters<typeof TrackLedger>[0]> = {}) {
	const handlers = {
		onToggleAudition: mock((_track: LibraryTrack) => undefined),
		onToggleSelect: mock((_track: LibraryTrack) => undefined),
		onAction: mock((_track: LibraryTrack, _action: string) => undefined),
		onRenameCommit: mock((_track: LibraryTrack, _name: string) => undefined),
		onRenameCancel: mock(() => undefined),
		onClearFilters: mock(() => undefined),
	};
	render(
		<TrackLedger
			tracks={tracks}
			groupByModule={false}
			moduleOrder={[]}
			empty={null}
			auditionId={null}
			auditionProgress={0}
			selection={new Set<string>()}
			renamingId={null}
			{...handlers}
			{...overrides}
		/>,
	);
	return handlers;
}

describe("TrackLedger", () => {
	test("splits BGM and SE into acts and numbers each act from 01", () => {
		renderLedger();
		const view = within(document.body);
		const bgm = view.getByRole("region", { name: "BGM" });
		const se = view.getByRole("region", { name: "SE" });
		expect(within(bgm).getByRole("heading", { name: "BGM" })).toBeTruthy();
		expect(within(bgm).getByText("循环 · 一次只放一首")).toBeTruthy();
		expect(within(se).getByText("点一下播一次")).toBeTruthy();
		expect(within(bgm).getAllByText(/^0[12]$/).map((n) => n.textContent)).toEqual([
			"01",
			"02",
		]);
		expect(within(se).getAllByText(/^01$/)).toHaveLength(1);
	});

	test("platform tracks show artist, album and source; uploads show none", () => {
		renderLedger();
		const view = within(document.body);
		expect(view.getAllByText("Yiruma · First Love").length).toBeGreaterThan(0);
		expect(view.getAllByText("网易云").length).toBeGreaterThan(0);
		expect(document.body.textContent).not.toContain("本地上传");
	});

	test("play button and title both toggle the audition", () => {
		const props = renderLedger();
		const view = within(document.body);
		fireEvent.click(view.getByRole("button", { name: "试听 夜航" }));
		expect(props.onToggleAudition).toHaveBeenCalledTimes(1);
		expect(props.onToggleAudition.mock.calls[0]?.[0].id).toBe("夜航");
		fireEvent.click(view.getByTitle("汽笛"));
		expect(props.onToggleAudition.mock.calls[1]?.[0].id).toBe("汽笛");
	});

	test("the sounding row exposes a pressed pause control", () => {
		renderLedger({ auditionId: "夜航", auditionProgress: 0.4 });
		const pause = within(document.body).getByRole("button", { name: "停止试听 夜航" });
		expect(pause.getAttribute("aria-pressed")).toBe("true");
		expect(document.querySelector("[data-active]")?.getAttribute("data-track-id")).toBe(
			"夜航",
		);
	});

	test("the row menu offers rename, retype and delete", async () => {
		const props = renderLedger();
		const view = within(document.body);
		fireEvent.pointerDown(view.getByRole("button", { name: "夜航 的更多操作" }), {
			button: 0,
			ctrlKey: false,
		});
		expect(await view.findByRole("menuitem", { name: "改为 SE" })).toBeTruthy();
		expect(view.queryByRole("menuitem", { name: /在.*打开/ })).toBeNull();
		fireEvent.click(view.getByRole("menuitem", { name: "删除" }));
		expect(props.onAction).toHaveBeenCalledTimes(1);
		expect(props.onAction.mock.calls[0]?.[1]).toBe("delete");
	});

	test("platform rows can open the official page", async () => {
		renderLedger();
		const view = within(document.body);
		fireEvent.pointerDown(view.getByRole("button", { name: "River Flows In You 的更多操作" }), {
			button: 0,
			ctrlKey: false,
		});
		const link = await view.findByRole("menuitem", { name: "在网易云音乐打开" });
		expect(link.getAttribute("href")).toBe("https://music.163.com/song?id=1");
	});

	test("rename mode commits on Enter and cancels on Escape", () => {
		const props = renderLedger({ renamingId: "夜航" });
		const input = within(document.body).getByRole("textbox", { name: "重命名 夜航" });
		fireEvent.input(input, { target: { value: "新名字" } });
		fireEvent.keyDown(input, { key: "Enter" });
		expect(props.onRenameCommit).toHaveBeenCalledWith(expect.objectContaining({ id: "夜航" }), "新名字");
		fireEvent.keyDown(input, { key: "Escape" });
		expect(props.onRenameCancel).toHaveBeenCalledTimes(1);
	});

	test("selecting a row reports it", () => {
		const props = renderLedger();
		const boxes = within(document.body).getAllByRole("checkbox", { name: "选择 夜航" });
		fireEvent.click(boxes[0] as HTMLElement);
		expect(props.onToggleSelect).toHaveBeenCalledTimes(1);
	});

	test("all-tracks view groups each act by module and restarts numbering", () => {
		renderLedger({
			groupByModule: true,
			tracks: [
				track({ id: "a1", moduleName: "雾港疑案" }),
				track({ id: "a2", moduleName: "雾港疑案" }),
				track({ id: "b1", moduleName: "沉默的灯塔", moduleId: "m2" }),
			],
		});
		const bgm = within(document.body).getByRole("region", { name: "BGM" });
		expect(within(bgm).getByText("雾港疑案")).toBeTruthy();
		expect(within(bgm).getByText("沉默的灯塔")).toBeTruthy();
		const numbers = within(bgm).getAllByText(/^0\d$/).map((n) => n.textContent);
		expect(numbers).toEqual(["01", "02", "01"]);
	});

	test("all-tracks groups follow the sidebar's module order", () => {
		renderLedger({
			groupByModule: true,
			moduleOrder: ["m2", "m1"],
			tracks: [
				track({ id: "a1", moduleName: "雾港疑案", moduleId: "m1" }),
				track({ id: "b1", moduleName: "沉默的灯塔", moduleId: "m2" }),
			],
		});
		const bgm = within(document.body).getByRole("region", { name: "BGM" });
		const labels = ["沉默的灯塔", "雾港疑案"].map((name) =>
			bgm.textContent?.indexOf(name) ?? -1,
		);
		expect(labels[0]).toBeGreaterThanOrEqual(0);
		expect(labels[0]).toBeLessThan(labels[1] as number);
	});

	test("an empty module draws a blank cue sheet with the way in", () => {
		renderLedger({ tracks: [], empty: "module" });
		const view = within(document.body);
		expect(view.getByText("这个模组还没有曲目")).toBeTruthy();
		expect(view.getByText(/点「添加曲目」/)).toBeTruthy();
		expect(document.body.textContent).toContain("--:--");
	});

	test("no matches offers to clear the filters", () => {
		const props = renderLedger({ tracks: [], empty: "filtered" });
		fireEvent.click(within(document.body).getByRole("button", { name: "清除筛选" }));
		expect(props.onClearFilters).toHaveBeenCalledTimes(1);
	});
});

describe("AuditionBar", () => {
	test("shows elapsed and total time and stops on request", () => {
		const onStop = mock(() => undefined);
		render(
			<AuditionBar
				track={track({ id: "夜航", duration: 214_000 })}
				positionMs={74_000}
				volume={0.8}
				onStop={onStop}
				onSeek={() => undefined}
				onVolume={() => undefined}
			/>,
		);
		const view = within(document.body);
		expect(view.getByRole("region", { name: "正在试听" })).toBeTruthy();
		expect(view.getAllByText("01:14").length).toBeGreaterThan(0);
		expect(view.getAllByText("03:34").length).toBeGreaterThan(0);
		expect(view.getByText("循环试听")).toBeTruthy();
		fireEvent.click(view.getByRole("button", { name: "停止试听" }));
		expect(onStop).toHaveBeenCalledTimes(1);
	});

	test("SE explains it plays once", () => {
		render(
			<AuditionBar
				track={track({ id: "汽笛", type: "se", duration: 6_000 })}
				positionMs={0}
				volume={0.5}
				onStop={() => undefined}
				onSeek={() => undefined}
				onVolume={() => undefined}
			/>,
		);
		expect(within(document.body).getByText("播放一次")).toBeTruthy();
	});
});
