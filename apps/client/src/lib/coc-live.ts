import type { SnapshotCharacter } from "@cogm/shared";
import { getRuleComponent } from "@/rules/registry";

const ATTR_KEYS = [
	"str",
	"con",
	"siz",
	"dex",
	"app",
	"int",
	"pow",
	"edu",
	"luck",
] as const;

export function parseCocSheet(sheet: unknown, ruleId?: string | null) {
	return getRuleComponent(ruleId).parseSheet(sheet);
}

export function parseCocState(state: unknown, ruleId?: string | null) {
	return getRuleComponent(ruleId).parseState(state);
}

export function skillKeysFor(
	character: SnapshotCharacter | undefined,
): string[] {
	const rule = getRuleComponent(character?.ruleId);
	const catalogKeys = rule.skillCatalog.map((skill) => skill.key);
	const sheetKeys = character?.sheet ? rule.skillKeys(character.sheet) : [];
	const extras = sheetKeys.filter(
		(key) =>
			!catalogKeys.includes(key) &&
			!ATTR_KEYS.includes(key as (typeof ATTR_KEYS)[number]),
	);
	return [...ATTR_KEYS, ...catalogKeys, ...extras];
}

export function skillValue(
	character: SnapshotCharacter | undefined,
	skillKey: string,
): number | null {
	if (!character?.sheet) {
		return null;
	}
	return getRuleComponent(character.ruleId).skillTarget(
		character.sheet,
		skillKey,
	);
}
