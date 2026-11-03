import type { CharacterDetailDto } from "@cogm/shared";
import { t } from "@/i18n";
import { mediaUrl } from "@/lib/api";
import { expressionLabel, initialsOf } from "@/lib/format";
import { getRuleComponent } from "@/rules/registry";

export type CharacterKind = "PC" | "NPC";

export type DerivedStats = {
	hp: { current: number; max: number };
	mp: { current: number; max: number };
	san: { current: number; max: number };
	luck: number;
	mov: number;
};

export type Attribute = { label: string; abbr: string; value: number };

export type Skill = { label: string; value: number; highlighted: boolean };

export type CharacterPortrait = {
	id?: string;
	expressionKey: string;
	portraitAssetId: string;
	isDefault: boolean;
};

export type GameCharacter = {
	id: string;
	name: string;
	initial: string;
	profession: string;
	kind: CharacterKind;
	meta: string;
	claim?: string;
	portrait?: string;
	expressions: string[];
	portraits: CharacterPortrait[];
	sheet: unknown;
	derived: DerivedStats;
	attributes: Attribute[];
	skills: Skill[];
};

export type CharacterRow = Pick<
	CharacterDetailDto,
	"id" | "name" | "kind" | "ruleId" | "sheetJson"
> & {
	portraits?: CharacterDetailDto["portraits"];
};

export function mapCharacterRow(row: CharacterRow): GameCharacter {
	const rule = getRuleComponent(row.ruleId);
	const sheet = rule.parseSheetJson(row.sheetJson);
	const portraits: CharacterPortrait[] = (row.portraits ?? []).map((item) => ({
		id: item.id,
		expressionKey: item.expressionKey,
		portraitAssetId: item.portraitAssetId,
		isDefault: item.isDefault === 1,
	}));
	const defaultPortrait =
		portraits.find((item) => item.isDefault) ?? portraits[0];
	const skills = (sheet ? rule.skillEntries(sheet) : [])
		.map(({ key, value }) => ({ key, value }))
		.sort((a, b) => b.value - a.value)
		.map(({ key, value }, index) => ({
			label: rule.skillLabel(key),
			value,
			highlighted: index < 6,
		}));

	return {
		id: row.id,
		name: row.name,
		initial: initialsOf(row.name),
		profession: "—",
		kind: row.kind === "npc" ? "NPC" : "PC",
		meta: row.ruleId,
		portrait: mediaUrl(defaultPortrait?.portraitAssetId) ?? undefined,
		expressions:
			portraits.length > 0
				? portraits.map((item) => expressionLabel(item.expressionKey))
				: [t("expression.default")],
		portraits,
		sheet,
		derived: sheet
			? rule.deriveStats(sheet)
			: {
					hp: { current: 1, max: 1 },
					mp: { current: 0, max: 0 },
					san: { current: 0, max: 0 },
					luck: 0,
					mov: 8,
				},
		attributes: rule.attributeEntries(sheet).map(({ key, label, value }) => ({
			label,
			abbr: rule.attributePair(key)?.abbr ?? key.toUpperCase(),
			value,
		})),
		skills,
	};
}
