import type { CharacterDetailDto } from "@cogm/shared";
import { t } from "@/i18n";
import { mediaUrl } from "@/lib/api";
import { expressionLabel, initialsOf } from "@/lib/format";
import { getRuleComponent } from "@/rules/registry";
import type { RuleSummaryMetric } from "@/rules/types";

export type CharacterKind = "PC" | "NPC";

export type Attribute = { label: string; abbr: string; value: number };

export type Skill = { label: string; value: number; highlighted: boolean };

export type CharacterPortrait = {
	id?: string;
	expressionKey: string;
	label: string | null;
	portraitAssetId: string;
	isDefault: boolean;
};

export type GameCharacter = {
	id: string;
	name: string;
	initial: string;
	profession: string;
	ruleId: string;
	kind: CharacterKind;
	meta: string;
	claim?: string;
	portrait?: string;
	expressions: string[];
	portraits: CharacterPortrait[];
	sheet: unknown;
	metrics: RuleSummaryMetric[];
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
		label: item.label ?? null,
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
		ruleId: row.ruleId,
		meta: row.ruleId,
		portrait: mediaUrl(defaultPortrait?.portraitAssetId) ?? undefined,
		expressions:
			portraits.length > 0
				? portraits.map((item) =>
						expressionLabel(item.expressionKey, item.label),
					)
				: [t("expression.default")],
		portraits,
		sheet,
		metrics: rule.summaryMetrics(sheet),
		attributes: rule.attributeEntries(sheet).map(({ key, label, value }) => ({
			label,
			abbr: rule.attributePair(key)?.abbr ?? key.toUpperCase(),
			value,
		})),
		skills,
	};
}
