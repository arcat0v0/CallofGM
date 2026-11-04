import { beforeEach, describe, expect, test } from "bun:test";
import type {
	CatalogHandoutDto,
	HandoutGrantDetailDto,
	SnapshotCharacter,
} from "@cogm/shared";
import { render } from "@testing-library/react";
import { HandoutPanel } from "../src/features/gm-console/handout-panel";
import { usePlayStore } from "../src/stores/play-store";

const handout: CatalogHandoutDto = {
	id: "h1",
	title: "旧照片",
	content: "背面有一行褪色的字。",
	imageAssetId: null,
	moduleId: "m1",
	createdAt: 1_700_000_000_000,
};

function character(
	characterId: string,
	name: string,
	overrides: Partial<SnapshotCharacter> = {},
): SnapshotCharacter {
	return {
		characterId,
		name,
		kind: "pc",
		ruleId: "coc7e",
		currentExpressionKey: null,
		state: {
			schemaVersion: 1,
			sessionId: "s1",
			characterId,
			hp: 10,
			maxHp: 10,
			mp: 10,
			maxMp: 10,
			san: 50,
			maxSan: 50,
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

function secretGrant(
	overrides: Partial<HandoutGrantDetailDto> = {},
): HandoutGrantDetailDto {
	return {
		grantId: "g1",
		handoutId: "h1",
		title: "旧照片",
		isPublic: false,
		grantedAt: 1_700_000_000_000,
		recipients: [
			{
				characterId: "c1",
				name: "远山 澪",
				read: false,
			},
		],
		readCount: 0,
		audienceCount: 1,
		...overrides,
	};
}

beforeEach(() => {
	usePlayStore.getState().reset();
	usePlayStore.setState({
		sessionId: "s1",
		status: "active",
		phase: "performance_time",
		ruleId: "coc7e",
		moduleId: null,
		catalogHandouts: [handout],
		characters: [character("c1", "远山 澪"), character("c2", "白石 拓真")],
		handoutGrants: [],
		presence: [],
	});
});

describe("GM handout panel", () => {
	test("secret grant shows recipients, unread counts and already-received state", () => {
		usePlayStore.setState({ handoutGrants: [secretGrant()] });
		const view = render(<HandoutPanel onClose={() => undefined} />);

		expect(view.getByText("秘密 1 人")).toBeTruthy();
		expect(view.getByText("1 条未读")).toBeTruthy();
		expect(view.getByText("秘密发放 · 1 人 · 0 已读")).toBeTruthy();
		expect(view.getByText("已收到此情报")).toBeTruthy();
		expect(view.getByText("白石 拓真")).toBeTruthy();
	});

	test("public grant locks the scope and reports read progress", () => {
		usePlayStore.setState({
			handoutGrants: [
				secretGrant({
					isPublic: true,
					recipients: [],
					readCount: 1,
					audienceCount: 2,
				}),
			],
		});
		const view = render(<HandoutPanel onClose={() => undefined} />);

		expect(view.getAllByText("已公开").length).toBeGreaterThan(0);
		expect(view.getAllByText("1/2 已读").length).toBeGreaterThan(0);
		expect(view.queryByText("秘密发放")).toBeNull();
	});

	test("applies GM grant overview messages to the store", () => {
		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			type: "handout:grants",
			payload: { grants: [secretGrant()] },
		});

		expect(usePlayStore.getState().handoutGrants[0]?.grantId).toBe("g1");
	});
});
