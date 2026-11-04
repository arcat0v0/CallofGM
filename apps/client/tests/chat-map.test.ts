import { describe, expect, test } from "bun:test";
import type {
	ChatMessageDto,
	HistoryItem,
	SnapshotCharacter,
} from "@cogm/shared";
import {
	mapActivityEvent,
	mapChatMessage,
	mapHistoryItem,
	obSpeakerLabel,
	speakerNameOf,
	speakerRoleLabelOf,
} from "../src/lib/chat-map";

function dto(overrides: Partial<ChatMessageDto> = {}): ChatMessageDto {
	return {
		id: "m1",
		sessionId: "s1",
		senderId: "b4e0d065-9ec6-4924-986a-839796f688ce",
		senderType: "player",
		characterId: null,
		characterName: null,
		channel: "ooc",
		content: "（举着手电筒踏上台阶）",
		expressionKey: null,
		queueOrder: 0,
		eventId: 1,
		presentedAt: 1_700_000_000_000,
		createdAt: 1_700_000_000_000,
		...overrides,
	};
}

describe("chat speaker identity", () => {
	test("observers are labelled by a stable short player id", () => {
		expect(obSpeakerLabel("b4e0d065-9ec6-4924-986a-839796f688ce")).toBe(
			"观战 · b4e0d0",
		);
		expect(obSpeakerLabel(null)).toBe("观战");
	});

	test("an observer message never renders as the generic player label", () => {
		const message = dto();
		expect(speakerNameOf(message)).toBe("观战 · b4e0d0");
		expect(speakerRoleLabelOf(message)).toBe("观战");
		const mapped = mapChatMessage(message);
		expect(mapped.speakerName).toBe("观战 · b4e0d0");
		expect(mapped.avatarInitials).toBe("观");
	});

	test("two observers with different ids stay distinguishable", () => {
		const first = speakerNameOf(dto());
		const second = speakerNameOf(
			dto({ senderId: "11111111-2222-3333-4444-555555555555" }),
		);
		expect(first).not.toBe(second);
	});

	test("PC names and GM identity use the host label", () => {
		const pc = dto({
			characterId: "c1",
			characterName: "林雨桐",
			channel: "roleplay",
		});
		expect(speakerNameOf(pc)).toBe("林雨桐");
		expect(speakerRoleLabelOf(pc)).toBe("PC");
		expect(speakerRoleLabelOf({ ...pc, channel: "ooc" })).toBe("场外");

		const gm = dto({
			senderType: "gm",
			senderId: null,
			characterId: null,
			characterName: null,
		});
		expect(speakerNameOf(gm)).toBe("主持人");
		expect(speakerRoleLabelOf(gm)).toBe("场外");
		expect(speakerRoleLabelOf({ ...gm, channel: "roleplay" })).toBe("");
	});

	test("GM speaking as an NPC renders the NPC identity", () => {
		const npc = dto({
			senderType: "gm",
			senderId: null,
			characterId: "npc1",
			characterName: "馆长 · 乌有",
			channel: "roleplay",
		});
		expect(speakerNameOf(npc)).toBe("馆长 · 乌有");
		expect(speakerRoleLabelOf(npc)).toBe("NPC");
		const mapped = mapChatMessage(npc);
		expect(mapped.avatarInitials).toBe("乌");
		expect(mapped.avatarBg).toBe("bg-default");
	});

	test("chat messages keep the expression used at speaking time", () => {
		const mapped = mapChatMessage(
			dto({
				characterId: "npc1",
				characterName: "礼帽男子",
				channel: "roleplay",
				expressionKey: "tip_hat_smile",
			}),
		);
		expect(mapped.expressionLabel).toBe("tip_hat_smile");
	});

	test("observer dice rolls use the same short id instead of a generic label", () => {
		const event = mapActivityEvent(
			"dice:rolled",
			{
				rollerType: "player",
				rollerId: "b4e0d065-9ec6-4924-986a-839796f688ce",
				result: { expression: "1d100", total: 42 },
			},
			7,
			1_700_000_000_000,
		);
		expect(event?.speakerName).toBe("观战 · b4e0d0");
	});
});

describe("check result clarity", () => {
	function resolved(result: Record<string, unknown>) {
		return mapActivityEvent(
			"check:resolved",
			{
				characterId: "c1",
				characterName: "陈默",
				skillKey: "侦查",
				hidden: false,
				result,
			},
			9,
			1_700_000_000_000,
		);
	}

	test("a hard check states the target value and the hard threshold", () => {
		const event = resolved({
			roll: 25,
			targetValue: 70,
			difficulty: "hard",
			outcome: "hard_success",
			success: true,
		});
		expect(event?.body).toBe(
			"侦查 25/70 · 困难成功（目标值 70 · 困难阈值 35）",
		);
	});

	test("a regular check states the target value only", () => {
		const event = resolved({
			roll: 25,
			targetValue: 60,
			difficulty: "regular",
			outcome: "regular_success",
			success: true,
		});
		expect(event?.body).toBe("侦查 25/60 · 常规成功（目标值 60）");
	});

	test("a failed hard check keeps the requested difficulty context", () => {
		const event = resolved({
			roll: 80,
			targetValue: 70,
			difficulty: "hard",
			outcome: "failure",
			success: false,
		});
		expect(event?.body).toBe("侦查 80/70 · 失败（目标值 70 · 困难阈值 35）");
	});
});

function character(
	overrides: Partial<SnapshotCharacter> = {},
): SnapshotCharacter {
	return {
		characterId: "c1",
		name: "陈默",
		kind: "pc",
		ruleId: "coc7e",
		currentExpressionKey: null,
		state: null,
		portraits: [],
		claim: null,
		sheet: null,
		...overrides,
	};
}

describe("history activity mapping", () => {
	test("phase changes render the shared phase label and stay anchorable", () => {
		const event = mapActivityEvent(
			"session:phase-changed",
			{ phase: "performance_time" },
			21,
			1_700_000_000_021,
			[],
		);
		expect(event?.body).toBe("演绎时间");
		expect(event?.speakerName).toBe("阶段");
		expect(event?.isSystem).toBe(true);
		expect(event?.tone).toBe("ooc");
		expect(event?.eventId).toBe(21);
		expect(event?.sortKey).toBe(21);
		expect(event?.anchorable).toBe(true);
		expect(event?.activityType).toBe("session:phase-changed");
		expect(
			mapActivityEvent("session:phase-changed", { phase: "not-a-phase" }, 21),
		).toBeNull();
	});

	test("scene changes carry the scene name", () => {
		const event = mapActivityEvent(
			"scene:changed",
			{ sceneId: "sc1", name: "灯塔" },
			22,
		);
		expect(event?.body).toBe("灯塔");
		expect(event?.speakerName).toBe("场景");
		expect(event?.anchorable).toBe(true);
	});

	test("expression changes resolve the character name from the roster", () => {
		const event = mapActivityEvent(
			"expression:changed",
			{ characterId: "c1", expressionKey: "smile" },
			23,
			1_700_000_000_023,
			[character()],
		);
		expect(event?.speakerName).toBe("陈默");
		expect(event?.body).toBe("表情切换为「smile」");

		const unknown = mapActivityEvent(
			"expression:changed",
			{ characterId: "ghost", expressionKey: "smile" },
			23,
		);
		expect(unknown?.speakerName).toBe("角色");

		const messageTied = mapActivityEvent(
			"expression:changed",
			{ characterId: "c1", expressionKey: "smile", messageId: "m1" },
			25,
			1_700_000_000_025,
			[character()],
		);
		expect(messageTied).toBeNull();
	});

	test("handouts use the title, falling back to the generic label", () => {
		const titled = mapActivityEvent(
			"handout:granted",
			{ grant: { grantId: "g1", handout: { id: "h1", title: "潮汐日志" } } },
			24,
		);
		expect(titled?.body).toBe("潮汐日志");
		expect(titled?.speakerName).toBe("情报");

		const untitled = mapActivityEvent(
			"handout:granted",
			{ grant: { grantId: "g2" } },
			24,
		);
		expect(untitled?.body).toBe("情报");
	});

	test("state changes summarise HP/MP/SAN through the rule system schema", () => {
		const event = mapActivityEvent(
			"state:changed",
			{
				characterId: "c1",
				state: {
					schemaVersion: 1,
					sessionId: "s1",
					characterId: "c1",
					hp: 8,
					maxHp: 12,
					mp: 3,
					maxMp: 9,
					san: 45,
					maxSan: 60,
					statuses: [],
					tags: [],
					growthMarks: [],
					hiddenGrowthMarks: [],
				},
			},
			25,
			1_700_000_000_025,
			[character()],
		);
		expect(event?.speakerName).toBe("陈默");
		expect(event?.body).toBe("HP 8/12 · MP 3/9 · SAN 45/60");

		const sparse = mapActivityEvent(
			"state:changed",
			{ characterId: "c1", state: { hp: 8 } },
			25,
			1_700_000_000_025,
			[character()],
		);
		expect(sparse?.body).toBe("状态变更");
	});

	test("rewind events are never usable as anchors", () => {
		const rewound = mapActivityEvent(
			"session:rewound",
			{
				action: "rewind",
				rewindId: "r1",
				anchorEventId: 12,
				anchorOccurredAt: 1_700_000_000_012,
				archivedMessageCount: 3,
				archivedEventCount: 5,
				discardedPendingCount: 0,
				reason: null,
			},
			26,
			1_700_000_000_026,
		);
		expect(rewound?.speakerName).toBe("回溯");
		expect(rewound?.body).toContain("已回溯至");
		expect(rewound?.anchorable).toBe(false);
		expect(rewound?.activityType).toBe("session:rewound");

		const undone = mapActivityEvent(
			"session:rewound",
			{
				action: "undo",
				rewindId: "r2",
				anchorEventId: 12,
				anchorOccurredAt: 1_700_000_000_012,
				archivedMessageCount: 0,
				archivedEventCount: 0,
				discardedPendingCount: 0,
				reason: null,
			},
			27,
		);
		expect(undone?.body).toBe("已撤销上一次回溯");
		expect(undone?.anchorable).toBe(false);
	});

	test("chat items take the history event id as their anchor", () => {
		const item: HistoryItem = {
			kind: "chat",
			eventId: 30,
			message: dto({ id: "m30", eventId: null, createdAt: 1_700_000_000_030 }),
		};
		const message = mapHistoryItem(item, []);
		expect(message?.eventId).toBe(30);
		expect(message?.anchorable).toBe(true);
		expect(message?.sortKey).toBe(1_700_000_000_030);

		const live = mapChatMessage(dto({ eventId: null }));
		expect(live.eventId).toBeUndefined();
		expect(live.anchorable).toBe(false);
		expect(live.activityType).toBeUndefined();

		const mapped = mapChatMessage(dto({ eventId: 12 }));
		expect(mapped.eventId).toBe(12);
		expect(mapped.anchorable).toBe(true);
	});

	test("dice and check messages carry their event type for history filtering", () => {
		const dice = mapActivityEvent(
			"dice:rolled",
			{ rollerType: "gm", result: { expression: "1d100", total: 42 } },
			40,
			1_700_000_000_040,
		);
		expect(dice?.eventId).toBe(40);
		expect(dice?.anchorable).toBe(true);
		expect(dice?.activityType).toBe("dice:rolled");

		const check = mapActivityEvent(
			"check:resolved",
			{
				characterId: "c1",
				characterName: "陈默",
				skillKey: "侦查",
				hidden: false,
				result: {
					roll: 25,
					targetValue: 60,
					difficulty: "regular",
					outcome: "regular_success",
				},
			},
			41,
			1_700_000_000_041,
		);
		expect(check?.eventId).toBe(41);
		expect(check?.anchorable).toBe(true);
		expect(check?.activityType).toBe("check:resolved");
	});

	test("history activity items forward the roster to the mapper", () => {
		const item: HistoryItem = {
			kind: "activity",
			eventId: 31,
			type: "expression:changed",
			occurredAt: 1_700_000_000_031,
			payload: { characterId: "c1", expressionKey: "worried" },
		};
		expect(mapHistoryItem(item, [character()])?.speakerName).toBe("陈默");
	});
});
