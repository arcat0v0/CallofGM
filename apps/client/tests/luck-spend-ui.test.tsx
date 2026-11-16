import { beforeEach, describe, expect, test } from "bun:test";
import type { SnapshotCharacter } from "@cogm/shared";
import { render } from "@testing-library/react";
import { SystemMessageCard } from "../src/features/chat/system-message-card";
import type { ChatMessage } from "../src/features/chat/types";
import { usePlayStore } from "../src/stores/play-store";

function character(): SnapshotCharacter {
	return {
		characterId: "c1",
		name: "陈默",
		kind: "pc",
		ruleId: "coc7e",
		currentExpressionKey: null,
		state: {
			schemaVersion: 1,
			sessionId: "s1",
			characterId: "c1",
			hp: 10,
			maxHp: 10,
			mp: 5,
			maxMp: 5,
			san: 50,
			maxSan: 60,
			luck: 50,
			statuses: [],
			tags: [],
			growthMarks: [],
			hiddenGrowthMarks: [],
		},
		portraits: [],
		claim: {
			holderKind: "user",
			holderId: "user-1",
			displayName: null,
			role: "pc",
		},
		sheet: null,
	};
}

function checkMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
	return {
		id: "check-9",
		sortKey: 9,
		eventId: 9,
		characterId: "c1",
		anchorable: true,
		activityType: "check:resolved",
		speakerName: "陈默",
		speakerRoleLabel: "鉴定",
		avatarInitials: "陈",
		avatarBg: "bg-default",
		avatarFg: "text-foreground",
		time: "21:00",
		body: "侦查 63/60 · 失败",
		tone: "ooc",
		isSystem: true,
		outcome: "failure",
		check: {
			skill: "侦查",
			skillKey: "侦查",
			characterId: "c1",
			baseTarget: 60,
			target: 60,
			difficulty: "常规",
			difficultyKey: "regular",
			outcomeKey: "failure",
			outcome: "failure",
			label: "失败",
			roll: 63,
		},
		...overrides,
	};
}

beforeEach(() => {
	usePlayStore.getState().reset();
	usePlayStore.setState({
		viewer: {
			isGm: false,
			seatRole: "pc",
			holderKind: "user",
			holderId: "user-1",
		},
		characters: [character()],
		messages: [checkMessage()],
	});
});

describe("luck spend ticket UI", () => {
	test("offers only affordable tiers on the owner's latest check", () => {
		const view = render(
			<SystemMessageCard message={checkMessage()} allowLuckSpend />,
		);
		expect(view.getByText("花费天命")).toBeTruthy();
		expect(view.getByText("−3 · 常规成功")).toBeTruthy();
		expect(view.getByText("−33 · 困难成功")).toBeTruthy();
		expect(view.queryByText("−51 · 极难成功")).toBeNull();
	});

	test("stays hidden on another player's ticket", () => {
		usePlayStore.setState({
			characters: [
				{
					...character(),
					claim: {
						holderKind: "user",
						holderId: "user-2",
						displayName: null,
						role: "pc",
					},
				},
			],
		});
		const view = render(
			<SystemMessageCard message={checkMessage()} allowLuckSpend />,
		);
		expect(view.queryByText("花费天命")).toBeNull();
	});

	test("stays hidden on luck checks and already amended checks", () => {
		const luckMessage = checkMessage({
			check: {
				...checkMessage().check!,
				skill: "天命检定",
				skillKey: "luck",
			},
		});
		usePlayStore.setState({ messages: [luckMessage] });
		const first = render(
			<SystemMessageCard message={luckMessage} allowLuckSpend />,
		);
		expect(first.queryByText("花费天命")).toBeNull();
		first.unmount();

		const amended = checkMessage({
			check: {
				...checkMessage().check!,
				luckSpent: 33,
				originalRoll: 63,
				roll: 30,
			},
		});
		usePlayStore.setState({ messages: [amended] });
		const second = render(
			<SystemMessageCard message={amended} allowLuckSpend />,
		);
		expect(second.queryByText("花费天命")).toBeNull();
		expect(second.getByText("花费 33 点天命")).toBeTruthy();
	});
});
