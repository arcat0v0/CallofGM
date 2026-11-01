import { coc7e, type SnapshotCharacter } from "@cogm/shared";

const ATTR_KEYS = ["str", "con", "siz", "dex", "app", "int", "pow", "edu", "luck"] as const;

export function parseCocSheet(sheet: unknown) {
  const parsed = coc7e.Coc7eCharacterSheet.safeParse(sheet);
  return parsed.success ? parsed.data : null;
}

export function parseCocState(state: unknown) {
  const parsed = coc7e.CharacterSessionState.safeParse(state);
  return parsed.success ? parsed.data : null;
}

export function skillKeysFor(character: SnapshotCharacter | undefined): string[] {
  const sheet = parseCocSheet(character?.sheet);
  const catalogKeys = coc7e.COC7E_SKILL_CATALOG.map((skill) => skill.key);
  const sheetKeys = sheet ? Object.keys(sheet.skills) : [];
  const extras = sheetKeys.filter((key) => !catalogKeys.includes(key) && !ATTR_KEYS.includes(key as (typeof ATTR_KEYS)[number]));
  return [...ATTR_KEYS, ...catalogKeys, ...extras];
}

export function skillValue(character: SnapshotCharacter | undefined, skillKey: string): number | null {
  const sheet = parseCocSheet(character?.sheet);
  return sheet ? coc7e.coc7eSkillTargetValue(sheet, skillKey) : null;
}
