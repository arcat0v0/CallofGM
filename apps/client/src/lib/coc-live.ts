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
  const skills = sheet ? Object.keys(sheet.skills) : [];
  const keys = [...ATTR_KEYS, ...skills.filter((key) => !ATTR_KEYS.includes(key as (typeof ATTR_KEYS)[number]))];
  if (keys.length > ATTR_KEYS.length) {
    return keys;
  }
  return [...ATTR_KEYS, ...coc7e.COC7E_SKILL_CATALOG.map((skill) => skill.key)];
}

export function skillValue(character: SnapshotCharacter | undefined, skillKey: string): number | null {
  const sheet = parseCocSheet(character?.sheet);
  return sheet ? coc7e.coc7eSkillTargetValue(sheet, skillKey) : null;
}
