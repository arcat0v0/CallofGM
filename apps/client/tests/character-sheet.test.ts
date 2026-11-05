import { describe, expect, test } from "bun:test";
import type { CharacterDetailDto } from "@cogm/shared";
import { mapCharacterRow } from "../src/lib/character-sheet";
import { getRuleComponent } from "../src/rules/registry";

const detail: CharacterDetailDto = {
	id: "char-label",
	ownerId: "gm-1",
	ownerKind: "gm",
	name: "礼帽男子",
	background: "",
	kind: "npc",
	ruleId: "coc7e",
	sheetJson: JSON.stringify(getRuleComponent("coc7e").createEmptySheet()),
	sheetVersion: 1,
	profileVersion: 1,
	version: 1,
	originType: null,
	originRefId: null,
	createdAt: 1,
	updatedAt: 1,
	portraits: [
		{
			id: "portrait-smile",
			characterId: "char-label",
			expressionKey: "smile",
			label: null,
			portraitAssetId: "asset-a",
			isDefault: 1,
			sortOrder: 0,
			createdAt: 1,
		},
		{
			id: "portrait-toast",
			characterId: "char-label",
			expressionKey: "toast_glass",
			label: "举杯",
			portraitAssetId: "asset-b",
			isDefault: 0,
			sortOrder: 1,
			createdAt: 2,
		},
	],
};

describe("character-sheet label mapping", () => {
	test("expression names keep the portrait label and translate built-ins", () => {
		const character = mapCharacterRow(detail);
		expect(character.expressions).toContain("举杯");
		expect(character.expressions).toContain("微笑");
	});

	test("portraits preserve the label on the mapped row", () => {
		const character = mapCharacterRow(detail);
		expect(character.portraits[1]?.label).toBe("举杯");
		expect(character.portraits[0]?.label).toBeNull();
	});
});
