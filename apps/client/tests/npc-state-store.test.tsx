import { beforeEach, describe, expect, test } from "bun:test";
import type { SnapshotCharacter } from "@cogm/shared";
import { render } from "@testing-library/react";
import { PortraitLayer } from "../src/features/session-stage/portrait-layer";
import { usePlayStore } from "../src/stores/play-store";

function npcCharacter(
	state: unknown,
	publicState: unknown,
	publicStateFields: string[],
): SnapshotCharacter {
	return {
		characterId: "npc-1",
		name: "礼帽男子",
		kind: "npc",
		ruleId: "coc7e",
		currentExpressionKey: "default",
		state,
		publicState,
		publicStateFields,
		portraits: [],
		claim: null,
		sheet: null,
	};
}

function applyCharacters(characters: SnapshotCharacter[]) {
	usePlayStore.setState({ characters });
}

describe("NPC public state in play store", () => {
	beforeEach(() => {
		usePlayStore.getState().reset();
		applyCharacters([
			npcCharacter(
				{
					hp: 7,
					maxHp: 10,
					mp: 3,
					maxMp: 5,
					san: 50,
					maxSan: 60,
					statuses: [],
					tags: ["secret"],
					growthMarks: [],
					hiddenGrowthMarks: [],
				},
				{ hp: 7, maxHp: 10 },
				["hp"],
			),
		]);
	});

	test("state:changed keeps the GM public projection in sync", () => {
		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			eventId: 2,
			type: "state:changed",
			occurredAt: 1,
			payload: {
				characterId: "npc-1",
				kind: "npc",
				state: { hp: 4, maxHp: 10, mp: 3, maxMp: 5, san: 50, maxSan: 60 },
				publicState: { hp: 4, maxHp: 10 },
				publicStateFields: ["hp"],
			},
		});
		const character = usePlayStore.getState().characters.at(0);
		expect(character).toBeDefined();
		expect(character?.state).toEqual({
			hp: 4,
			maxHp: 10,
			mp: 3,
			maxMp: 5,
			san: 50,
			maxSan: 60,
		});
		expect(character?.publicState).toEqual({ hp: 4, maxHp: 10 });
	});

	test("state:public-changed replaces the player-visible state, including null", () => {
		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			eventId: 3,
			type: "state:public-changed",
			occurredAt: 1,
			payload: {
				characterId: "npc-1",
				kind: "npc",
				state: { hp: 2, maxHp: 10 },
			},
		});
		expect(usePlayStore.getState().characters.at(0)?.state).toEqual({
			hp: 2,
			maxHp: 10,
		});

		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			eventId: 4,
			type: "state:public-changed",
			occurredAt: 1,
			payload: { characterId: "npc-1", kind: "npc", state: null },
		});
		expect(usePlayStore.getState().characters.at(0)?.state).toBeNull();
	});

	test("npc:state-visibility-changed updates the GM config and public view", () => {
		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			eventId: 5,
			type: "npc:state-visibility-changed",
			occurredAt: 1,
			payload: {
				characterId: "npc-1",
				kind: "npc",
				state: { hp: 7, maxHp: 10 },
				publicState: null,
				publicStateFields: [],
			},
		});
		const character = usePlayStore.getState().characters.at(0);
		expect(character).toBeDefined();
		expect(character?.state).toEqual({ hp: 7, maxHp: 10 });
		expect(character?.publicState).toBeNull();
		expect(character?.publicStateFields).toEqual([]);
	});
});

describe("portrait lightweight state bars", () => {
	beforeEach(() => {
		usePlayStore.getState().reset();
	});

	test("renders only the public NPC fields", () => {
		applyCharacters([
			npcCharacter(
				{ hp: 7, maxHp: 10, mp: 3, maxMp: 5 },
				{ hp: 7, maxHp: 10 },
				["hp"],
			),
		]);
		const view = render(<PortraitLayer audience="player" />);
		expect(view.getByText("HP")).toBeTruthy();
		expect(view.getByText("7/10")).toBeTruthy();
		expect(view.queryByText("MP")).toBeNull();
		expect(view.queryByText("SAN")).toBeNull();
	});

	test("renders only the name when no NPC field is public", () => {
		applyCharacters([npcCharacter({ hp: 7, maxHp: 10 }, null, [])]);
		const view = render(<PortraitLayer audience="player" />);
		expect(view.getByText("礼帽男子")).toBeTruthy();
		expect(view.getByText("NPC")).toBeTruthy();
		expect(view.queryByText("HP")).toBeNull();
	});
});
