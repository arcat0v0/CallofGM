import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import { toast } from "sonner";
import { usePlayStore } from "../src/stores/play-store";

describe("play-store draft-loss and command rejection tracking", () => {
	beforeEach(() => {
		usePlayStore.getState().reset();
	});

	test("command:rejected records lastRejection with commandId and Chinese copy for the code", () => {
		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			commandId: "cmd-xyz-123",
			type: "command:rejected",
			payload: {
				code: "VALIDATION_FAILED",
				message: "Expression portrait not found",
			},
		});

		const rejection = usePlayStore.getState().lastRejection;
		expect(rejection).not.toBeNull();
		expect(rejection?.commandId).toBe("cmd-xyz-123");
		expect(rejection?.message).toBe("提交的内容不符合要求，请检查后重试");
	});

	test("snapshot viewer carries the server-provided seat role", () => {
		usePlayStore.getState().applySnapshot(
			{
				viewer: {
					isGm: false,
					seatRole: "ob",
					holderKind: null,
					holderId: null,
				},
				session: {
					id: "s1",
					name: null,
					moduleId: "m1",
					moduleName: "模组",
					ruleId: "coc7e",
					themeId: null,
					status: "active",
					phase: "free_discussion",
					currentSceneId: null,
					lastEventId: 0,
					settings: { sharePcSheets: true, obSeePcState: true, diceSkin: "olive" },
				},
				currentScene: null,
				characters: [],
				bgm: null,
				recentHistory: [],
				history: { beforeEventId: null, hasMore: false },
				visibleHandouts: [],
				pendingCheckRequests: [],
			},
			0,
		);
		expect(usePlayStore.getState().viewer).toEqual({
			isGm: false,
			seatRole: "ob",
			holderKind: null,
			holderId: null,
		});
	});

	test("snapshot settings drive visibility toggles", () => {
		usePlayStore.getState().applySnapshot(
			{
				viewer: {
					isGm: true,
					seatRole: null,
					holderKind: null,
					holderId: null,
				},
				session: {
					id: "s1",
					name: "灯塔之夜",
					moduleId: "m1",
					moduleName: "模组",
					ruleId: "coc7e",
					themeId: null,
					status: "active",
					phase: "free_discussion",
					currentSceneId: null,
					lastEventId: 0,
					settings: { sharePcSheets: false, obSeePcState: false, diceSkin: "olive" },
				},
				currentScene: null,
				characters: [],
				bgm: null,
				recentHistory: [],
				history: { beforeEventId: null, hasMore: false },
				visibleHandouts: [],
				pendingCheckRequests: [],
			},
			0,
		);
		expect(usePlayStore.getState().sessionName).toBe("灯塔之夜");
		expect(usePlayStore.getState().settings).toEqual({
			sharePcSheets: false,
			obSeePcState: false,
			diceSkin: "olive",
		});

		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			eventId: 1,
			type: "session:settings-changed",
			occurredAt: Date.now(),
			payload: {
				sharePcSheets: true,
				obSeePcState: false,
				diceSkin: "olive",
			},
		});
		expect(usePlayStore.getState().settings).toEqual({
			sharePcSheets: true,
			obSeePcState: false,
			diceSkin: "olive",
		});
	});

	test("acknowledged handouts are marked read and skipped by the prompt", () => {
		const handout = {
			grantId: "grant-1",
			handout: {
				id: "h1",
				title: "潮汐日志",
				content: "…",
				imageAssetId: null,
			},
			isPublic: false,
			grantedAt: 1,
			read: false,
		};
		usePlayStore.getState().applySnapshot(
			{
				viewer: {
					isGm: false,
					seatRole: "pc",
					holderKind: null,
					holderId: null,
				},
				session: {
					id: "s1",
					name: null,
					moduleId: "m1",
					moduleName: "模组",
					ruleId: "coc7e",
					themeId: null,
					status: "active",
					phase: "free_discussion",
					currentSceneId: null,
					lastEventId: 0,
					settings: { sharePcSheets: true, obSeePcState: true, diceSkin: "olive" },
				},
				currentScene: null,
				characters: [],
				bgm: null,
				recentHistory: [],
				history: { beforeEventId: null, hasMore: false },
				visibleHandouts: [handout],
				pendingCheckRequests: [],
			},
			0,
		);
		expect(
			usePlayStore.getState().handouts.filter((item) => !item.read),
		).toHaveLength(1);

		usePlayStore.getState().markHandoutRead("grant-1");
		expect(
			usePlayStore.getState().handouts.filter((item) => !item.read),
		).toHaveLength(0);
	});

	test("expression changed activity resolves the label from the snapshot roster", () => {
		usePlayStore.getState().applySnapshot(
			{
				...snapshotPayload,
				characters: [
					{
						characterId: "c1",
						name: "陈默",
						kind: "pc",
						ruleId: "coc7e",
						currentExpressionKey: "smile",
						state: null,
						portraits: [
							{
								expressionKey: "smile",
								label: "微笑脸",
								portraitAssetId: "asset-smile",
								isDefault: true,
								sortOrder: 0,
							},
						],
						claim: null,
						sheet: null,
					},
				],
			},
			0,
		);
		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			eventId: 7,
			type: "expression:changed",
			occurredAt: 1_700_000_000_007,
			payload: { characterId: "c1", expressionKey: "smile" },
		});
		const activity = usePlayStore
			.getState()
			.messages.find((message) => message.activityType === "expression:changed");
		expect(activity?.body).toBe("表情切换为「微笑脸」");
	});

	test("reset clears lastRejection", () => {
		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			commandId: "cmd-xyz-123",
			type: "command:rejected",
			payload: { code: "FORBIDDEN", message: "Access forbidden" },
		});
		expect(usePlayStore.getState().lastRejection).not.toBeNull();
		usePlayStore.getState().reset();
		expect(usePlayStore.getState().lastRejection).toBeNull();
	});
});

const snapshotPayload = {
	session: {
		id: "s1",
		name: null,
		moduleId: "m1",
		moduleName: "灯塔",
		ruleId: "coc7e",
		themeId: null,
		status: "active" as const,
		phase: "free_discussion" as const,
		currentSceneId: null,
		lastEventId: 0,
		settings: {
			sharePcSheets: true,
			obSeePcState: true,
			diceSkin: "olive" as const,
		},
	},
	currentScene: null,
	viewer: { isGm: false, seatRole: null, holderKind: null, holderId: null },
	characters: [],
	bgm: null,
	recentHistory: [],
	history: { beforeEventId: null, hasMore: false },
	visibleHandouts: [],
	pendingCheckRequests: [],
};

function chatItem(eventId: number, content: string) {
	return {
		kind: "chat" as const,
		eventId,
		message: {
			id: `msg-${eventId}`,
			sessionId: "s1",
			senderId: null,
			senderType: "gm" as const,
			characterId: null,
			characterName: null,
			channel: "ooc" as const,
			content,
			expressionKey: null,
			queueOrder: 0,
			eventId,
			presentedAt: 1_700_000_000_000 + eventId,
			createdAt: 1_700_000_000_000 + eventId,
		},
	};
}

describe("chat history paging", () => {
	beforeEach(() => {
		usePlayStore.getState().reset();
	});

	test("snapshot merges chat and activity into one eventId-ordered timeline", () => {
		usePlayStore.getState().applySnapshot(
			{
				...snapshotPayload,
				recentHistory: [
					chatItem(2, "第二句"),
					{
						kind: "activity",
						eventId: 3,
						type: "dice:rolled",
						occurredAt: 1_700_000_000_003,
						payload: {
							rollerType: "gm",
							result: { total: 42, expression: "1d100", detail: "42" },
						},
					},
					chatItem(4, "第四句"),
				],
				history: { beforeEventId: 2, hasMore: true },
			},
			4,
		);

		const state = usePlayStore.getState();
		expect(state.messages.map((message) => message.id)).toEqual([
			"msg-2",
			"dice-3",
			"msg-4",
		]);
		expect(state.historyBeforeEventId).toBe(2);
		expect(state.historyHasMore).toBe(true);
		expect(state.historyLoading).toBe(false);
	});

	test("history reply prepends sorted items, dedupes existing ids and advances the cursor", () => {
		usePlayStore.getState().applySnapshot(
			{
				...snapshotPayload,
				recentHistory: [chatItem(30, "已有"), chatItem(31, "最新")],
				history: { beforeEventId: 30, hasMore: true },
			},
			31,
		);
		usePlayStore.setState({ historyLoading: true, historyCommandId: "cmd-1" });

		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			commandId: "cmd-1",
			type: "command:accepted",
			payload: {
				history: {
					items: [
						chatItem(10, "更早"),
						chatItem(30, "已有"),
						chatItem(20, "介于"),
					],
					hasMore: true,
					beforeEventId: 10,
				},
			},
		});

		const state = usePlayStore.getState();
		expect(state.messages.map((message) => message.id)).toEqual([
			"msg-10",
			"msg-20",
			"msg-30",
			"msg-31",
		]);
		expect(state.historyBeforeEventId).toBe(10);
		expect(state.historyHasMore).toBe(true);
		expect(state.historyLoading).toBe(false);
		expect(state.historyCommandId).toBeNull();
		expect(state.historyPagesLoaded).toBe(1);
	});

	test("last page hides further loading and keeps ordering stable", () => {
		usePlayStore.getState().applySnapshot(
			{
				...snapshotPayload,
				recentHistory: [chatItem(5, "最新")],
				history: { beforeEventId: 5, hasMore: true },
			},
			5,
		);
		usePlayStore.setState({ historyLoading: true, historyCommandId: "cmd-2" });

		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			commandId: "cmd-2",
			type: "command:accepted",
			payload: {
				history: {
					items: [chatItem(1, "最早")],
					hasMore: false,
					beforeEventId: null,
				},
			},
		});

		const state = usePlayStore.getState();
		expect(state.messages.map((message) => message.id)).toEqual([
			"msg-1",
			"msg-5",
		]);
		expect(state.historyHasMore).toBe(false);
		expect(state.historyBeforeEventId).toBeNull();
		expect(state.historyPagesLoaded).toBe(1);
	});

	test("stale or unrelated accepted replies do not mutate the timeline", () => {
		usePlayStore.getState().applySnapshot(
			{
				...snapshotPayload,
				recentHistory: [chatItem(8, "最新")],
				history: { beforeEventId: 8, hasMore: true },
			},
			8,
		);
		usePlayStore.setState({ historyLoading: true, historyCommandId: "cmd-3" });

		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			commandId: "cmd-other",
			type: "command:accepted",
			payload: {
				history: {
					items: [chatItem(2, "越权的更早")],
					hasMore: false,
					beforeEventId: null,
				},
			},
		});

		const state = usePlayStore.getState();
		expect(state.messages.map((message) => message.id)).toEqual(["msg-8"]);
		expect(state.historyLoading).toBe(true);
		expect(state.historyPagesLoaded).toBe(0);
	});

	test("rejected history command clears the loading state", () => {
		usePlayStore.getState().applySnapshot(
			{
				...snapshotPayload,
				recentHistory: [chatItem(8, "最新")],
				history: { beforeEventId: 8, hasMore: true },
			},
			8,
		);
		usePlayStore.setState({ historyLoading: true, historyCommandId: "cmd-4" });

		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			commandId: "cmd-4",
			type: "command:rejected",
			payload: { code: "RATE_LIMITED", message: "Too many commands" },
		});

		const state = usePlayStore.getState();
		expect(state.historyLoading).toBe(false);
		expect(state.historyCommandId).toBeNull();
		expect(state.historyHasMore).toBe(true);
	});

	test("live events append after paged history without duplicates", () => {
		usePlayStore.getState().applySnapshot(
			{
				...snapshotPayload,
				recentHistory: [chatItem(10, "十")],
				history: { beforeEventId: 10, hasMore: true },
			},
			10,
		);
		usePlayStore.setState({ historyLoading: true, historyCommandId: "cmd-5" });
		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			commandId: "cmd-5",
			type: "command:accepted",
			payload: {
				history: {
					items: [chatItem(9, "九")],
					hasMore: false,
					beforeEventId: null,
				},
			},
		});

		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			eventId: 11,
			occurredAt: 1_700_000_000_011,
			type: "chat:message",
			payload: { message: chatItem(11, "十一").message },
		});
		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			eventId: 12,
			occurredAt: 1_700_000_000_012,
			type: "chat:message",
			payload: { message: chatItem(12, "十二").message },
		});

		const state = usePlayStore.getState();
		expect(state.messages.map((message) => message.id)).toEqual([
			"msg-9",
			"msg-10",
			"msg-11",
			"msg-12",
		]);
		expect(state.lastEventId).toBe(12);
	});

	test("session:kicked puts the player into the terminal kick state with the GM reason", () => {
		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			type: "session:kicked",
			payload: {
				code: "SESSION_KICKED",
				reason: "干扰他人发言",
				createdAt: 1_700_000_000_000,
			},
		});

		const state = usePlayStore.getState();
		expect(state.terminal).toBe("kicked");
		expect(state.kickedReason).toBe("干扰他人发言");
		expect(state.connected).toBe(false);
	});

	test("GM presence push and snapshot carry the kicked list", () => {
		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			type: "presence:updated",
			payload: {
				online: [],
				kickedPlayers: [
					{
						holderKind: "anonymous",
						holderId: "p1",
						displayName: "调查员甲",
						reason: null,
						createdAt: 1,
					},
				],
			},
		});
		expect(usePlayStore.getState().kickedPlayers).toEqual([
			{
				holderKind: "anonymous",
				holderId: "p1",
				displayName: "调查员甲",
				reason: null,
				createdAt: 1,
			},
		]);

		usePlayStore.getState().applySnapshot(
			{
				viewer: {
					isGm: true,
					seatRole: null,
					holderKind: null,
					holderId: null,
				},
				session: {
					id: "s1",
					name: null,
					moduleId: "m1",
					moduleName: "模组",
					ruleId: "coc7e",
					themeId: null,
					status: "active",
					phase: "free_discussion",
					currentSceneId: null,
					lastEventId: 0,
					settings: { sharePcSheets: true, obSeePcState: true, diceSkin: "olive" },
				},
				currentScene: null,
				characters: [],
				bgm: null,
				recentHistory: [],
				history: { beforeEventId: null, hasMore: false },
				visibleHandouts: [],
				pendingCheckRequests: [],
				kickedPlayers: [
					{
						holderKind: "anonymous",
						holderId: "p2",
						displayName: null,
						reason: "测试",
						createdAt: 2,
					},
				],
			},
			0,
		);
		expect(usePlayStore.getState().kickedPlayers).toEqual([
			{
				holderKind: "anonymous",
				holderId: "p2",
				displayName: null,
				reason: "测试",
				createdAt: 2,
			},
		]);
	});
});

const rewindPreview = {
	anchorEventId: 12,
	anchorOccurredAt: 1_700_000_000_012,
	messageCount: 4,
	activityCount: 2,
	pendingCount: 1,
	revokedHandoutTitles: ["潮汐日志"],
	revertedCheckCount: 3,
	characterChanges: [{ characterId: "c1", name: "陈默" }],
	phaseChange: null,
	sceneChange: null,
	hasCheckpoint: true,
};

const rewindEvent = {
	action: "rewind" as const,
	rewindId: "r1",
	anchorEventId: 12,
	anchorOccurredAt: 1_700_000_000_012,
	archivedMessageCount: 4,
	archivedEventCount: 6,
	discardedPendingCount: 1,
	reason: null,
};

const archiveGroup = {
	id: "r1",
	action: "rewind" as const,
	createdAt: 1_700_000_000_030,
	anchorEventId: 12,
	anchorOccurredAt: 1_700_000_000_012,
	reason: null,
	undoneAt: null,
	targetRewindId: null,
	archivedMessageCount: 4,
	archivedEventCount: 6,
};

function auditDto(id: string, createdAt: number) {
	return {
		id,
		sessionId: "s1",
		senderId: null,
		senderType: "gm" as const,
		characterId: null,
		characterName: null,
		channel: "ooc" as const,
		content: id,
		expressionKey: null,
		queueOrder: 0,
		eventId: null,
		presentedAt: createdAt,
		createdAt,
	};
}

describe("history rewind and archive state", () => {
	beforeEach(() => {
		usePlayStore.getState().reset();
	});

	test("preview accepted stores the preview and clears the loading flag", () => {
		usePlayStore.setState({
			historyPreviewLoading: true,
			historyPreviewCommandId: "cmd-preview",
		});

		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			commandId: "cmd-preview",
			type: "command:accepted",
			payload: { preview: rewindPreview },
		});

		const state = usePlayStore.getState();
		expect(state.historyPreview?.anchorEventId).toBe(12);
		expect(state.historyPreview?.revokedHandoutTitles).toEqual(["潮汐日志"]);
		expect(state.historyPreviewLoading).toBe(false);
		expect(state.historyPreviewCommandId).toBeNull();

		usePlayStore.getState().clearRewindPreview();
		expect(usePlayStore.getState().historyPreview).toBeNull();
	});

	test("archive accepted stores the groups only for the requesting command", () => {
		usePlayStore.setState({
			archiveLoading: true,
			archiveCommandId: "cmd-archive",
		});

		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			commandId: "cmd-archive",
			type: "command:accepted",
			payload: { groups: [archiveGroup] },
		});

		let state = usePlayStore.getState();
		expect(state.archiveGroups).toEqual([archiveGroup]);
		expect(state.archiveLoading).toBe(false);
		expect(state.archiveCommandId).toBeNull();

		usePlayStore.setState({
			archiveLoading: true,
			archiveCommandId: "cmd-stale",
		});
		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			commandId: "cmd-other",
			type: "command:accepted",
			payload: { groups: [] },
		});
		state = usePlayStore.getState();
		expect(state.archiveGroups).toEqual([archiveGroup]);
		expect(state.archiveLoading).toBe(true);
	});

	test("archive items replace on the first page and prepend older pages", () => {
		usePlayStore.setState({
			archiveItemsLoading: true,
			archiveItemsCommandId: "cmd-a1",
		});
		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			commandId: "cmd-a1",
			type: "command:accepted",
			payload: {
				items: [chatItem(20, "较新")],
				hasMore: true,
				beforeEventId: 10,
			},
		});
		expect(
			usePlayStore.getState().archiveItems.map((item) => item.eventId),
		).toEqual([20]);

		usePlayStore.setState({
			archiveItemsLoading: true,
			archiveItemsCommandId: "cmd-a2",
			archiveItemsBeforeId: 10,
		});
		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			commandId: "cmd-a2",
			type: "command:accepted",
			payload: {
				items: [chatItem(5, "更早")],
				hasMore: false,
				beforeEventId: null,
			},
		});

		const state = usePlayStore.getState();
		expect(state.archiveItems.map((item) => item.eventId)).toEqual([5, 20]);
		expect(state.archiveItemsLoading).toBe(false);
		expect(state.archiveItemsCommandId).toBeNull();
		expect(state.archiveItemsBeforeId).toBeNull();
	});

	test("audit pages replace then append raw chat messages", () => {
		usePlayStore.setState({ auditLoading: true, auditCommandId: "cmd-d1" });
		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			commandId: "cmd-d1",
			type: "command:accepted",
			payload: {
				items: [auditDto("a1", 1_700_000_000_020)],
				hasMore: true,
				beforeCreatedAt: 1_700_000_000_010,
			},
		});
		expect(usePlayStore.getState().auditItems.map((item) => item.id)).toEqual([
			"a1",
		]);

		usePlayStore.setState({
			auditLoading: true,
			auditCommandId: "cmd-d2",
			auditBeforeAt: 1_700_000_000_010,
		});
		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			commandId: "cmd-d2",
			type: "command:accepted",
			payload: {
				items: [auditDto("a2", 1_700_000_000_005)],
				hasMore: false,
				beforeCreatedAt: null,
			},
		});

		const state = usePlayStore.getState();
		expect(state.auditItems.map((item) => item.id)).toEqual(["a1", "a2"]);
		expect(state.auditLoading).toBe(false);
		expect(state.auditCommandId).toBeNull();
		expect(state.auditBeforeAt).toBeNull();
	});

	test("session:rewound writes the rewind notice and the seen watermark", () => {
		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			eventId: 30,
			occurredAt: 1_700_000_000_030,
			type: "session:rewound",
			payload: rewindEvent,
		});

		const state = usePlayStore.getState();
		expect(state.lastRewind).toEqual({
			id: "r1",
			action: "rewind",
			eventId: 30,
			anchorEventId: 12,
			occurredAt: 1_700_000_000_030,
		});
		expect(state.lastRewindSeenId).toBe(30);
		expect(state.lastEventId).toBe(30);
	});

	test("rewind accepted clears the loading flag and the stale preview", () => {
		usePlayStore.setState({
			rewindLoading: true,
			rewindCommandId: "cmd-rewind",
			historyPreview: rewindPreview,
		});

		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			commandId: "cmd-rewind",
			type: "command:accepted",
			payload: { rewindId: "r1", action: "rewind" },
		});

		const state = usePlayStore.getState();
		expect(state.rewindLoading).toBe(false);
		expect(state.rewindCommandId).toBeNull();
		expect(state.historyPreview).toBeNull();
	});

	test("undo accepted reports the undo wording", () => {
		const success = spyOn(toast, "success").mockImplementation(() => "id");
		try {
			usePlayStore.setState({
				rewindLoading: true,
				rewindCommandId: "cmd-undo",
			});

			usePlayStore.getState().applyMessage({
				protocolVersion: 1,
				commandId: "cmd-undo",
				type: "command:accepted",
				payload: { rewindId: "r1", action: "undo" },
			});

			expect(usePlayStore.getState().rewindLoading).toBe(false);
			expect(success).toHaveBeenCalledWith("已撤销回溯，正在重新同步现场");
		} finally {
			success.mockRestore();
		}
	});

	test("a snapshot rewind notice prompts once and is then remembered", () => {
		const info = spyOn(toast, "info").mockImplementation(() => "id");
		try {
			const payload = {
				...snapshotPayload,
				lastRewind: {
					id: "r1",
					action: "rewind" as const,
					eventId: 30,
					anchorEventId: 12,
					occurredAt: 1_700_000_000_030,
				},
			};

			usePlayStore.getState().applySnapshot(payload, 30);
			expect(usePlayStore.getState().lastRewind?.id).toBe("r1");
			expect(usePlayStore.getState().lastRewindSeenId).toBe(30);
			expect(info).toHaveBeenCalledTimes(1);

			usePlayStore.getState().applySnapshot(payload, 30);
			expect(info).toHaveBeenCalledTimes(1);
		} finally {
			info.mockRestore();
		}
	});

	test("reset clears the rewind and archive state", () => {
		usePlayStore.setState({
			lastRewind: {
				id: "r1",
				action: "rewind",
				eventId: 30,
				anchorEventId: 12,
				occurredAt: 1_700_000_000_030,
			},
			lastRewindSeenId: 30,
			historyPreview: rewindPreview,
			archiveGroups: [archiveGroup],
			archiveItems: [chatItem(20, "较新")],
			auditItems: [auditDto("a1", 1_700_000_000_020)],
		});

		usePlayStore.getState().reset();

		const state = usePlayStore.getState();
		expect(state.lastRewind).toBeNull();
		expect(state.lastRewindSeenId).toBe(0);
		expect(state.historyPreview).toBeNull();
		expect(state.archiveGroups).toEqual([]);
		expect(state.archiveItems).toEqual([]);
		expect(state.auditItems).toEqual([]);
	});
});
