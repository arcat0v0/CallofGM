import { coc7e, type SnapshotCharacter } from "@cogm/shared";
import { t } from "@/i18n";

const COC7E_ATTRIBUTE_ORDER: ReadonlyArray<{ key: string }> = [
	{ key: "str" },
	{ key: "con" },
	{ key: "siz" },
	{ key: "dex" },
	{ key: "app" },
	{ key: "int" },
	{ key: "pow" },
	{ key: "edu" },
	{ key: "luck" },
];

function readAttributes(sheet: unknown): Record<string, number> {
	if (!sheet || typeof sheet !== "object") {
		return {};
	}
	const attributes = (sheet as { attributes?: unknown }).attributes;
	return attributes && typeof attributes === "object"
		? (attributes as Record<string, number>)
		: {};
}

function readSkills(sheet: unknown): Record<string, number> {
	if (!sheet || typeof sheet !== "object") {
		return {};
	}
	const skills = (sheet as { skills?: unknown }).skills;
	return skills && typeof skills === "object"
		? (skills as Record<string, number>)
		: {};
}

export function parseCocSheet(value: unknown) {
	const parsed = coc7e.Coc7eCharacterSheet.safeParse(value);
	return parsed.success ? parsed.data : null;
}

export function parseCocState(state: unknown) {
	const parsed = coc7e.CharacterSessionState.safeParse(state);
	return parsed.success ? parsed.data : null;
}

export const cocAttributeKeys = COC7E_ATTRIBUTE_ORDER.map(({ key }) => key);
export function cocAttributeEntries(sheet: unknown) {
	const attributes = readAttributes(sheet);
	return COC7E_ATTRIBUTE_ORDER.map(({ key }) => ({
		key,
		label: coc7e.COC7E_ATTRIBUTE_LABELS[key]?.label ?? key,
		value: attributes[key] ?? 0,
	}));
}

export function cocSkillEntries(sheet: unknown) {
	return Object.entries(readSkills(sheet)).map(([key, value]) => ({
		key,
		value,
	}));
}

const catalogKeys = coc7e.COC7E_SKILL_CATALOG.map(({ key }) => key);
export function skillKeysFor(
	character: SnapshotCharacter | null | undefined,
): string[] {
	const extras = Object.keys(readSkills(character?.sheet)).filter(
		(key) => !catalogKeys.includes(key) && !cocAttributeKeys.includes(key),
	);
	return [...cocAttributeKeys, ...catalogKeys, ...extras];
}

export function skillValue(
	character: SnapshotCharacter | null | undefined,
	key: string,
): number | null {
	const parsed = parseCocSheet(character?.sheet);
	return parsed ? coc7e.coc7eSkillTargetValue(parsed, key) : null;
}

export const difficultyLabel = (value: string) =>
	(coc7e.CheckDifficultyLabel as Record<string, string>)[value] ?? value;
export function difficultyThreshold(
	target: number,
	difficulty: coc7e.CheckDifficulty,
) {
	return coc7e.coc7eDifficultyThreshold(target, difficulty);
}
export const outcomeLabel = (value: string) =>
	(coc7e.CheckOutcomeLabel as Record<string, string>)[value] ?? value;
export const cocStatusLabels = coc7e.CharacterStatusFlagLabel as Record<
	string,
	string
>;
export const statusLabels = (statuses: string[]) =>
	statuses.map((flag) => cocStatusLabels[flag] ?? flag);

export function deriveStats(sheet: unknown) {
	const parsed = coc7e.Coc7eCharacterSheet.safeParse(sheet);
	if (!parsed.success) {
		return {
			hp: { current: 1, max: 1 },
			mp: { current: 0, max: 0 },
			san: { current: 0, max: 0 },
			luck: 0,
			mov: 1,
		};
	}
	const derived = coc7e.deriveCoc7eSheetStats(parsed.data);
	return {
		hp: { current: derived.maxHp, max: derived.maxHp },
		mp: { current: derived.maxMp, max: derived.maxMp },
		san: { current: derived.initialSan, max: derived.maxSan },
		luck: parsed.data.attributes.luck,
		mov: derived.mov,
		damageBonus: derived.damageBonus,
		build: derived.build,
		majorWound: derived.majorWoundThreshold,
	};
}

export function cocOverview(sheet: unknown, includeAge = false) {
	const parsed = parseCocSheet(sheet);
	if (!parsed) return [];
	const detail = [];
	if (parsed.occupation.name)
		detail.push({
			label: t("characterCreation.occupation"),
			value: parsed.occupation.name,
		});
	if (parsed.era === "modern")
		detail.push({ label: t("characterCreation.era"), value: "现代" });
	if (parsed.era === "1920s")
		detail.push({ label: t("characterCreation.era"), value: "1920 年代" });
	if (includeAge)
		detail.push({
			label: t("characterCreation.age"),
			value: `${parsed.age} 岁`,
		});
	return detail;
}

export function sheetSections(sheet: unknown) {
	const parsed = coc7e.Coc7eCharacterSheet.safeParse(sheet);
	if (!parsed.success) {
		return [];
	}
	const value = parsed.data;
	const sections: Array<{
		id: string;
		title: string;
		rows: Array<{ label: string; value: string }>;
		items: Array<{ name: string; lines: string[] }>;
	}> = [];
	const combatItems = value.weapons.map((weapon) => ({
		name: weapon.name,
		lines: [
			`${weapon.skillKey} · ${weapon.damage}`,
			[
				weapon.range,
				weapon.attacks ? `${weapon.attacks} 次` : "",
				weapon.ammo === null ? "" : `装弹 ${weapon.ammo}`,
				weapon.malfunction === null ? "" : `故障 ${weapon.malfunction}`,
			]
				.filter(Boolean)
				.join(" · "),
		].filter(Boolean),
	}));
	if (combatItems.length > 0 || value.armor.name) {
		sections.push({
			id: "combat",
			title: "战斗与装备",
			rows: [
				{ label: "护甲", value: value.armor.name || "无" },
				{ label: "护甲值", value: String(value.armor.value) },
				{ label: "覆盖部位", value: value.armor.locations || "—" },
			],
			items: [
				...combatItems,
				...value.gear.map((item) => ({
					name: item.name,
					lines: [`数量 ${item.quantity}`],
				})),
			],
		});
	}
	const assetRows = [
		{ label: "货币", value: value.assets.currency },
		{ label: "消费水平", value: String(value.assets.spendingLevel) },
		{ label: "现金", value: String(value.assets.cash) },
		{ label: "其他资产", value: String(value.assets.otherAssets) },
	];
	const assetItems = value.assets.details.map((detail) => ({
		name: detail.name,
		lines: [detail.category, String(detail.value)],
	}));
	if (
		value.assets.cash > 0 ||
		value.assets.otherAssets > 0 ||
		assetItems.length > 0
	) {
		sections.push({
			id: "assets",
			title: "信用与资产",
			rows: assetRows,
			items: assetItems,
		});
	}
	const magicItems = [
		...value.spells.map((spell) => ({
			name: spell.name,
			lines: [
				[
					spell.mpCost ? `${spell.mpCost} MP` : "",
					spell.sanCost ? `${spell.sanCost} SAN` : "",
				]
					.filter(Boolean)
					.join(" · "),
				spell.castingTime,
				spell.effect,
			].filter(Boolean),
		})),
		...value.mythosTomes.map((tome) => ({
			name: tome.name,
			lines: [
				`SAN ${tome.sanLoss} · 神话 +${tome.mythosGain}`,
				tome.spells,
			].filter(Boolean),
		})),
		...value.encounters.map((encounter) => ({
			name: encounter.name,
			lines: [
				`SAN ${encounter.sanLoss} · 神话 +${encounter.mythosGain}`,
				encounter.notes,
			].filter(Boolean),
		})),
	];
	if (magicItems.length > 0) {
		sections.push({
			id: "magic",
			title: "法术与神话",
			rows: [],
			items: magicItems,
		});
	}
	return sections;
}
