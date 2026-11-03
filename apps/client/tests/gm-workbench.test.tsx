import { beforeEach, describe, expect, test } from "bun:test";
import type { SnapshotCharacter } from "@cogm/shared";
import { render } from "@testing-library/react";
import { GmChatPanel } from "../src/features/gm-console/gm-chat-panel";
import { CharacterStateCard } from "../src/features/gm-console/gm-panel-stage";
import { GmToolProvider } from "../src/features/gm-console/gm-tool-context";
import { GmToolDock } from "../src/features/gm-console/gm-tool-dock";
import { usePlayStore } from "../src/stores/play-store";

function character(
	overrides: Partial<SnapshotCharacter> = {},
): SnapshotCharacter {
	return {
		characterId: "c1",
		name: "远野 澪",
		kind: "pc",
		ruleId: "coc7e",
		currentExpressionKey: "default",
		state: {
			schemaVersion: 1,
			sessionId: "s1",
			characterId: "c1",
			hp: 9,
			maxHp: 11,
			mp: 8,
			maxMp: 10,
			san: 52,
			maxSan: 58,
			statuses: [],
			tags: [],
			growthMarks: [],
			hiddenGrowthMarks: [],
		},
		portraits: [],
		claim: null,
		...overrides,
	};
}

beforeEach(() => {
	usePlayStore.getState().reset();
	usePlayStore.setState({
		status: "active",
		phase: "performance_time",
		characters: [
			character(),
			character({
				characterId: "c2",
				name: "白石 拓真",
				state: {
					schemaVersion: 1,
					sessionId: "s1",
					characterId: "c2",
					hp: 5,
					maxHp: 12,
					mp: 6,
					maxMp: 6,
					san: 44,
					maxSan: 61,
					statuses: ["major_wound"],
					tags: [],
					growthMarks: [],
					hiddenGrowthMarks: [],
				},
			}),
		],
		messages: [
			{
				id: "m1",
				sortKey: 1,
				speakerName: "主持人",
				speakerRoleLabel: "主持人",
				avatarInitials: "KP",
				avatarBg: "bg-accent",
				avatarFg: "text-accent-foreground",
				time: "21:02",
				body: "雨声忽然变大了。",
				tone: "ic",
			},
		],
	});
});

describe("GM workbench B2 composition", () => {
	test("chat card renders the floating dialogue workspace", () => {
		const view = render(
			<GmToolProvider>
				<GmChatPanel />
			</GmToolProvider>,
		);
		expect(view.getByText("桌边对话")).toBeTruthy();
		expect(view.getByText("全部消息")).toBeTruthy();
		expect(view.getByText("主持人")).toBeTruthy();
		expect(view.getByText("雨声忽然变大了。")).toBeTruthy();
		expect(view.getByText("KP · 旁白")).toBeTruthy();
		expect(view.getByPlaceholderText("描述接下来发生的事…")).toBeTruthy();
	});

	test("state reminder leads with the most urgent character", () => {
		const view = render(
			<GmToolProvider>
				<CharacterStateCard />
			</GmToolProvider>,
		);
		expect(view.getByText("角色状态")).toBeTruthy();
		expect(view.getByText("白石 拓真")).toBeTruthy();
		expect(view.getByText("重伤 · HP 5 / 12 · SAN 44 / 61")).toBeTruthy();
	});

	test("dock exposes all five director tools", () => {
		const view = render(
			<GmToolProvider>
				<GmToolDock />
			</GmToolProvider>,
		);
		for (const label of ["场景", "人物", "情报", "鉴定", "声音"]) {
			expect(view.getByRole("button", { name: label })).toBeTruthy();
		}
	});
});
