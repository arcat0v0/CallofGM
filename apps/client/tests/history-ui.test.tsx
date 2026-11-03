import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { ChatMessageView } from "@cogm/theme-sdk";
import { act, fireEvent, render } from "@testing-library/react";
import { toast } from "sonner";
import type { ChatMessage } from "../src/features/chat/types";
import {
	filterTimelineMessages,
	GmHistoryOverlay,
} from "../src/features/history/gm-history-overlay";
import { PlayerHistoryOverlay } from "../src/features/history/player-history-overlay";
import { usePlayStore } from "../src/stores/play-store";

function playerMessage(
	overrides: Partial<ChatMessageView> = {},
): ChatMessageView {
	return {
		id: "p1",
		speakerName: "主持人",
		speakerRoleLabel: "主持人",
		avatarInitials: "KP",
		avatarBg: "bg-accent",
		avatarFg: "text-accent-foreground",
		time: "21:02",
		body: "雨声忽然变大了。",
		tone: "ic",
		isSystem: false,
		self: false,
		continued: false,
		showRoleBadge: true,
		...overrides,
	};
}

function typeInto(element: HTMLElement, value: string) {
	const key = Object.keys(element).find((item) =>
		item.startsWith("__reactProps$"),
	);
	const props = key
		? (
				element as unknown as Record<
					string,
					{ onChange?: (event: { target: { value: string } }) => void }
				>
			)[key]
		: undefined;
	act(() => {
		props?.onChange?.({ target: { value } });
	});
}

const playerBase = {
	open: true,
	onClose: () => undefined,
	selfName: "远野 澪",
	hasOlder: false,
	loadingOlder: false,
	onLoadOlder: () => undefined,
};

describe("player history overlay", () => {
	test("renders timeline messages but hides pending and rejected entries", () => {
		const view = render(
			<PlayerHistoryOverlay
				{...playerBase}
				messages={[
					playerMessage(),
					playerMessage({
						id: "p2",
						speakerName: "远野 澪",
						body: "我推开门。",
						self: true,
					}),
					playerMessage({ id: "p3", body: "待审发言", pending: true }),
					playerMessage({ id: "p4", body: "未通过发言", rejected: true }),
				]}
			/>,
		);

		expect(view.getByText("历史")).toBeTruthy();
		expect(view.getByText("雨声忽然变大了。")).toBeTruthy();
		expect(view.getByText("我推开门。")).toBeTruthy();
		expect(view.queryByText("待审发言")).toBeNull();
		expect(view.queryByText("未通过发言")).toBeNull();
	});

	test("filters by content and speaker name", () => {
		const view = render(
			<PlayerHistoryOverlay
				{...playerBase}
				messages={[
					playerMessage(),
					playerMessage({
						id: "p2",
						speakerName: "远野 澪",
						body: "我推开门。",
					}),
				]}
			/>,
		);
		const search = view.getByRole("textbox", { name: "搜索历史" });

		typeInto(search, "推开");
		expect(view.queryByText("雨声忽然变大了。")).toBeNull();
		expect(view.getByText("我推开门。")).toBeTruthy();

		typeInto(search, "主持人");
		expect(view.getByText("雨声忽然变大了。")).toBeTruthy();
		expect(view.queryByText("我推开门。")).toBeNull();
	});

	test("closes through the close button and Escape", () => {
		let closed = 0;
		const view = render(
			<PlayerHistoryOverlay
				{...playerBase}
				messages={[playerMessage()]}
				onClose={() => {
					closed += 1;
				}}
			/>,
		);

		fireEvent.click(view.getByRole("button", { name: "关闭历史" }));
		expect(closed).toBe(1);

		fireEvent.keyDown(window, { key: "Escape" });
		expect(closed).toBe(2);
	});

	test("renders nothing while closed", () => {
		const view = render(
			<PlayerHistoryOverlay
				{...playerBase}
				open={false}
				messages={[playerMessage()]}
			/>,
		);
		expect(view.queryByText("历史")).toBeNull();
	});
});

function gmMessage(
	overrides: Partial<ChatMessage> & { id: string },
): ChatMessage {
	return {
		sortKey: 1,
		speakerName: "主持人",
		speakerRoleLabel: "主持人",
		avatarInitials: "KP",
		avatarBg: "bg-accent",
		avatarFg: "text-accent-foreground",
		time: "21:00",
		body: overrides.id,
		tone: "ic",
		...overrides,
	};
}

describe("gm history overlay", () => {
	beforeEach(() => {
		usePlayStore.getState().reset();
	});

	test("filters the timeline by search and shows the no-match hint", () => {
		usePlayStore.setState({
			messages: [
				gmMessage({
					id: "m1",
					eventId: 1,
					anchorable: true,
					body: "雨声忽然变大了。",
				}),
				gmMessage({
					id: "m2",
					eventId: 2,
					anchorable: true,
					speakerName: "远野 澪",
					body: "我推开门。",
				}),
			],
			historyHasMore: false,
			historyLoading: false,
		});

		const view = render(
			<GmHistoryOverlay open onOpenChange={() => undefined} />,
		);
		const search = view.getByRole("textbox", { name: "搜索消息" });

		typeInto(search, "推开");
		expect(view.queryByText("雨声忽然变大了。")).toBeNull();
		expect(view.getByText("我推开门。")).toBeTruthy();

		typeInto(search, "不存在的内容");
		expect(view.getByText("没有符合筛选条件的记录")).toBeTruthy();
	});

	test("combines event type, speaker and keyword filters", () => {
		const dialogue = gmMessage({
			id: "dialogue",
			speakerName: "远野 澪",
			body: "我推开门。",
		});
		const dice = gmMessage({
			id: "dice",
			activityType: "dice:rolled",
			body: "侦查 1d100 = 42",
		});
		const check = gmMessage({
			id: "check",
			activityType: "check:resolved",
			body: "侦查成功",
		});
		const state = gmMessage({
			id: "state",
			activityType: "state:changed",
			body: "HP -1",
		});
		const scene = gmMessage({
			id: "scene",
			activityType: "scene:changed",
			body: "书房",
		});
		const phase = gmMessage({
			id: "phase",
			activityType: "session:phase-changed",
			body: "演绎时间",
		});
		const handout = gmMessage({
			id: "handout",
			activityType: "handout:granted",
			body: "日记",
		});
		const expression = gmMessage({
			id: "expression",
			activityType: "expression:changed",
			body: "微笑",
		});
		const rewind = gmMessage({
			id: "rewind",
			activityType: "session:rewound",
			body: "回溯",
		});
		const messages = [
			dialogue,
			dice,
			check,
			state,
			scene,
			phase,
			handout,
			expression,
			rewind,
		];

		const cases = [
			["dialogue", "dialogue"],
			["dice", "dice"],
			["check", "check"],
			["state", "state"],
			["scene", "scene"],
			["phase", "phase"],
			["handout", "handout"],
			["expression", "expression"],
			["rewind", "rewind"],
		] as const;

		for (const [eventType, expected] of cases) {
			expect(
				filterTimelineMessages(messages, {
					query: "",
					speakers: [],
					eventType,
				}).map((message) => message.id),
			).toEqual([expected]);
		}

		expect(
			filterTimelineMessages(messages, {
				query: "推开",
				speakers: ["远野 澪"],
				eventType: "dialogue",
			}).map((message) => message.id),
		).toEqual(["dialogue"]);

		expect(
			filterTimelineMessages(messages, {
				query: "",
				speakers: ["主持人"],
				eventType: "all",
			}).map((message) => message.id),
		).toEqual([
			"dice",
			"check",
			"state",
			"scene",
			"phase",
			"handout",
			"expression",
			"rewind",
		]);

		expect(
			filterTimelineMessages(messages, {
				query: "不存在",
				speakers: [],
				eventType: "all",
			}),
		).toHaveLength(0);
	});

	test("passes the optional undo reason to the command", () => {
		const errorSpy = spyOn(toast, "error").mockImplementation(() => "id");
		usePlayStore.setState({
			messages: [],
			archiveGroups: [
				{
					id: "r1",
					action: "rewind",
					createdAt: 100,
					anchorEventId: 2,
					anchorOccurredAt: 200,
					reason: "走错方向",
					undoneAt: null,
					targetRewindId: null,
					archivedMessageCount: 3,
					archivedEventCount: 1,
				},
			],
			archiveLoading: false,
		});
		const undoSpy = spyOn(
			usePlayStore.getState(),
			"requestUndoRewind",
		).mockImplementation(() => undefined);

		try {
			const view = render(
				<GmHistoryOverlay open onOpenChange={() => undefined} />,
			);
			fireEvent.click(view.getByRole("radio", { name: "已归档" }));
			fireEvent.click(view.getByRole("button", { name: "撤销本次回溯" }));
			typeInto(view.getByPlaceholderText("撤销原因（可选）"), "改错了");
			fireEvent.click(view.getByRole("button", { name: "确认撤销" }));

			expect(undoSpy).toHaveBeenCalledWith("r1", "改错了");
		} finally {
			undoSpy.mockRestore();
			errorSpy.mockRestore();
		}
	});

	test("disables timeline anchors and undo actions after the session ended", () => {
		const errorSpy = spyOn(toast, "error").mockImplementation(() => "id");
		usePlayStore.setState({
			status: "ended",
			messages: [
				gmMessage({
					id: "m1",
					eventId: 1,
					anchorable: true,
					body: "雨声忽然变大了。",
				}),
			],
			archiveGroups: [
				{
					id: "r1",
					action: "rewind",
					createdAt: 100,
					anchorEventId: 2,
					anchorOccurredAt: 200,
					reason: "走错方向",
					undoneAt: null,
					targetRewindId: null,
					archivedMessageCount: 3,
					archivedEventCount: 1,
				},
			],
			historyHasMore: false,
			historyLoading: false,
			archiveLoading: false,
		});

		try {
			const view = render(
				<GmHistoryOverlay open onOpenChange={() => undefined} />,
			);

			expect(view.getByText("已结团，仅可回看")).toBeTruthy();
			expect(
				view.getByText("雨声忽然变大了。").closest("[role='button']"),
			).toBeNull();

			fireEvent.click(view.getByRole("radio", { name: "已归档" }));
			expect(view.getByText("走错方向")).toBeTruthy();
			expect(view.queryByRole("button", { name: "撤销本次回溯" })).toBeNull();
		} finally {
			errorSpy.mockRestore();
		}
	});

	test("renders the timeline and archive segments", () => {
		const errorSpy = spyOn(toast, "error").mockImplementation(() => "id");
		usePlayStore.setState({
			messages: [
				{
					id: "m1",
					sortKey: 1,
					eventId: 1,
					anchorable: true,
					speakerName: "主持人",
					speakerRoleLabel: "主持人",
					avatarInitials: "KP",
					avatarBg: "bg-accent",
					avatarFg: "text-accent-foreground",
					time: "21:02",
					body: "雨声忽然变大了。",
					tone: "ic",
				},
				{
					id: "m2",
					sortKey: 2,
					eventId: 2,
					anchorable: true,
					speakerName: "远野 澪",
					speakerRoleLabel: "PC",
					avatarInitials: "澪",
					avatarBg: "bg-default",
					avatarFg: "text-foreground",
					time: "21:03",
					body: "我推开门。",
					tone: "ic",
				},
				{
					id: "m3",
					sortKey: 3,
					speakerName: "远野 澪",
					speakerRoleLabel: "PC",
					avatarInitials: "澪",
					avatarBg: "bg-default",
					avatarFg: "text-foreground",
					time: "21:04",
					body: "待审发言",
					tone: "ic",
					pending: true,
				},
				{
					id: "m4",
					sortKey: 4,
					speakerName: "远野 澪",
					speakerRoleLabel: "PC",
					avatarInitials: "澪",
					avatarBg: "bg-default",
					avatarFg: "text-foreground",
					time: "21:05",
					body: "未通过发言",
					tone: "ic",
					rejected: true,
				},
			],
			archiveGroups: [
				{
					id: "r1",
					action: "rewind",
					createdAt: 100,
					anchorEventId: 2,
					anchorOccurredAt: 200,
					reason: "走错方向",
					undoneAt: null,
					targetRewindId: null,
					archivedMessageCount: 3,
					archivedEventCount: 1,
				},
				{
					id: "r2",
					action: "rewind",
					createdAt: 300,
					anchorEventId: 1,
					anchorOccurredAt: 400,
					reason: "撤销记录",
					undoneAt: 500,
					targetRewindId: "r1",
					archivedMessageCount: 0,
					archivedEventCount: 0,
				},
			],
			historyHasMore: false,
			historyLoading: false,
			archiveLoading: false,
			archiveItems: [],
			auditItems: [],
		});

		try {
			const view = render(
				<GmHistoryOverlay open onOpenChange={() => undefined} />,
			);

			expect(view.getByText("雨声忽然变大了。")).toBeTruthy();
			expect(view.getByText("我推开门。")).toBeTruthy();
			expect(view.queryByText("待审发言")).toBeNull();
			expect(view.queryByText("未通过发言")).toBeNull();

			fireEvent.click(view.getByRole("radio", { name: "已归档" }));

			expect(view.getByText("走错方向")).toBeTruthy();
			expect(view.getByText("撤销记录")).toBeTruthy();
			expect(view.getAllByText("撤销本次回溯")).toHaveLength(1);
			expect(view.getByText(/撤销于/)).toBeTruthy();
		} finally {
			errorSpy.mockRestore();
		}
	});
});
